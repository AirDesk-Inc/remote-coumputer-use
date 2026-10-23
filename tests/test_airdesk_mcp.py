import contextlib
import argparse
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "skills/remote-computer-use/scripts/airdesk_mcp.py"
SPEC = importlib.util.spec_from_file_location("airdesk_mcp", SCRIPT)
app = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(app)
FAKE = ROOT / "tests/fixtures/fake_mcp.py"


def command(mode, log=None):
    return [sys.executable, str(FAKE), mode] + ([str(log)] if log else [])


class ProtocolTests(unittest.TestCase):
    def test_happy_path_is_local_read_only(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "requests.jsonl"
            report = app.diagnose(command("ok", log), 2)
            messages = [json.loads(line) for line in log.read_text().splitlines()]
        self.assertEqual([item["method"] for item in messages], [
            "initialize", "notifications/initialized", "tools/list", "tools/call"])
        self.assertEqual(messages[-1]["params"], {"name": "remote_status", "arguments": {}})
        self.assertTrue(report["localPrerequisitesReady"])
        self.assertFalse(report["targetVerified"])
        self.assertEqual(report["toolCount"], 16)
        self.assertNotIn("PRIVATE_SENTINEL", json.dumps(report))

    def test_flags_fail_closed_individually(self):
        for flag in app.FLAGS:
            with self.subTest(flag=flag):
                result = app.diagnose(command("off:" + flag), 2)
                self.assertFalse(result["localPrerequisitesReady"])
                self.assertFalse(result["checks"][flag])
                self.assertFalse(result["targetVerified"])

    def test_compatible_text_fallback(self):
        self.assertTrue(app.diagnose(command("text_only"), 2)["localPrerequisitesReady"])

    def test_notifications_do_not_replace_responses(self):
        self.assertTrue(app.diagnose(command("notification"), 2)["localPrerequisitesReady"])

    def test_pagination(self):
        self.assertEqual(app.diagnose(command("pages"), 2)["toolCount"], 16)

    def test_missing_tool_stops_before_status(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "requests.jsonl"
            result = app.diagnose(command("missing_tool", log), 2)
            self.assertNotIn('"tools/call"', log.read_text())
        self.assertEqual(result["missingTools"], ["terminal_close"])
        self.assertFalse(result["localPrerequisitesReady"])

    def test_protocol_failures_are_sanitized_and_child_reaped(self):
        cases = {
            "protocol": "unsupported_protocol_version",
            "no_tools_capability": "tools_capability_missing",
            "invalid_utf8": "invalid_json_message", "invalid_json": "invalid_json_message",
            "oversize": "invalid_message_size", "array": "invalid_rpc_message",
            "wrong_id": "unexpected_response_id", "rpc_error": "server_rpc_error",
            "invalid_catalog": "invalid_tool_catalog", "cursor_loop": "invalid_catalog_cursor",
            "tool_error": "status_tool_error", "payload_error": "status_tool_error",
            "string_bool": "missing_or_invalid_status_flags",
            "missing_flag": "missing_or_invalid_status_flags",
            "null_structured": "missing_or_invalid_status_flags",
            "eof": "server_closed_stdout", "bad_exit": "server_exit_failed",
        }
        original = app.StdioProbe
        for mode, expected in cases.items():
            with self.subTest(mode=mode):
                probes = []

                def track(*args):
                    probe = original(*args)
                    probes.append(probe)
                    return probe

                with mock.patch.object(app, "StdioProbe", side_effect=track):
                    with self.assertRaises(app.DiagnosticError) as error:
                        app.diagnose(command(mode), 2)
                self.assertEqual(str(error.exception), expected)
                self.assertNotIn("PRIVATE_SENTINEL", str(error.exception))
                self.assertIsNotNone(probes[0].process.poll())

    def test_timeout_is_bounded_and_reaped(self):
        started = time.monotonic()
        with self.assertRaisesRegex(app.DiagnosticError, "response_timeout"):
            app.diagnose(command("timeout"), 0.2)
        self.assertLess(time.monotonic() - started, 5)

    def test_shutdown_timeout_is_not_success(self):
        with self.assertRaisesRegex(app.DiagnosticError, "server_exit_failed"):
            app.diagnose(command("shutdown_hang"), 2)

    def test_flood_is_bounded(self):
        with self.assertRaises(app.DiagnosticError) as error:
            app.diagnose(command("flood"), 2)
        self.assertIn(str(error.exception), ("too_many_messages", "too_many_notifications"))

    def test_cli_does_not_expose_remote_errors(self):
        output = io.StringIO()
        diagnose = app.diagnose
        with mock.patch.object(app, "find_binary", return_value=Path("AirDesk")), \
                mock.patch.object(app, "diagnose", side_effect=lambda *args: diagnose(command("rpc_error"), 2)), \
                contextlib.redirect_stdout(output):
            code = app.main(["doctor"])
        self.assertEqual(code, 2)
        result = json.loads(output.getvalue())
        self.assertEqual(result["error"], "server_rpc_error")
        self.assertNotIn("PRIVATE_SENTINEL", output.getvalue())

    def test_profile_overrides_are_not_forwarded(self):
        with mock.patch.dict(os.environ, {"REPC_MCP_AUTH_TOKEN": "test-token",
                                         "REPC_STATE_DIR": "test-state", "REPC_BACKEND_URL": "https://example.invalid"}):
            with mock.patch.object(app.subprocess, "Popen", wraps=subprocess.Popen) as popen:
                app.diagnose(command("ok"), 2)
        forwarded = popen.call_args.kwargs["env"]
        for key in ("REPC_STATE_DIR", "REPC_BACKEND_URL", "REPC_MCP_AUTH_TOKEN"):
            self.assertNotIn(key, forwarded)
        self.assertFalse(popen.call_args.kwargs["shell"])


class ConfigTests(unittest.TestCase):
    def test_rejects_control_characters_in_configuration(self):
        for path in ("/Applications/line\nbreak/AirDesk", "/Applications/\x7f/AirDesk"):
            with self.subTest(path=path), self.assertRaisesRegex(app.DiagnosticError, "invalid_binary_path_characters"):
                app.configuration(path, "codex")

    def test_json_escaping(self):
        path = 'C:\\Users\\Example Name\\AirDesk\\app-1\\AirDesk.exe'
        result = json.loads(app.configuration(path, "generic"))
        self.assertEqual(result, {"mcpServers": {"airdesk": {"command": path, "args": ["--mcp-server"]}}})

    def test_toml_escaping(self):
        try:
            import tomllib
        except ImportError:
            self.skipTest("TOML parser is in the standard library on Python 3.11+")
        for path in ('C:\\Users\\Example Name\\AirDesk.exe', '/Applications/이름 "AirDesk"/AirDesk'):
            config = tomllib.loads(app.configuration(path, "codex"))
            self.assertEqual(config["mcp_servers"]["airdesk"]["command"], path)
            self.assertEqual(config["mcp_servers"]["airdesk"]["args"], ["--mcp-server"])

    def test_config_never_launches_binary(self):
        with mock.patch.object(app, "find_binary", return_value=Path("/trusted/AirDesk")), \
                mock.patch.object(app.subprocess, "Popen") as popen, \
                contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(app.main(["config"]), 0)
        popen.assert_not_called()

    def test_refuses_relative_or_wrong_binary(self):
        for path in ("AirDesk", "./AirDesk", "/bin/sh", "/Applications/AirDesk;echo secret"):
            with self.subTest(path=path), self.assertRaises(app.DiagnosticError):
                app.find_binary(path)

    def test_bundle_path(self):
        with tempfile.TemporaryDirectory() as directory:
            bundle = Path(directory) / "AirDesk.app"
            binary = bundle / "Contents/MacOS/AirDesk"
            binary.parent.mkdir(parents=True)
            binary.touch()
            binary.chmod(0o700)
            self.assertEqual(app.find_binary(str(bundle)), binary)

    def test_timeout_validation(self):
        for value in ("nan", "inf", "-1", "0", "31", "nope"):
            with self.subTest(value=value), self.assertRaises(argparse.ArgumentTypeError):
                app.seconds(value)
        self.assertEqual(app.seconds("0.5"), 0.5)


if __name__ == "__main__":
    unittest.main()
