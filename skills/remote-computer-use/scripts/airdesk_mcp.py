#!/usr/bin/env python3
"""Print native AirDesk MCP configuration or inspect local prerequisites only."""

import argparse
import json
import math
import os
from pathlib import Path
import queue
import re
import subprocess
import sys
import threading
import time

VERSION = "0.1.2"
PROTOCOL = "2025-11-25"
MAX_LINE = 1024 * 1024
REQUIRED_TOOLS = frozenset({
    "remote_list_computers", "remote_connect", "remote_status", "remote_disconnect",
    "remote_screenshot", "remote_select_display", "remote_mouse_move",
    "remote_click", "remote_press_key", "remote_observe",
    "remote_mouse_button", "remote_scroll", "remote_key", "remote_type_text",
    "terminal_open", "terminal_write", "terminal_read", "terminal_resize", "terminal_close",
})
FLAGS = ("mcpEnabled", "mcpServerEnabled", "credentialAvailable")
STATUS_FLAGS = FLAGS + ("remoteTerminalEnabled",)
OPTIONAL_TOOLS = {
    "screenGestures": frozenset({"remote_zoom", "remote_drag", "remote_cursor_position"}),
    "desktopAutomation": frozenset({"remote_list_apps", "remote_launch_app", "remote_list_windows",
        "remote_get_window", "remote_activate_window", "remote_get_window_state", "remote_set_value",
        "remote_element_action", "remote_window_input"}),
    "browserAutomation": frozenset({"remote_browser_list_tabs", "remote_browser_activate_tab",
        "remote_browser_navigate", "remote_browser_get_state", "remote_browser_element_action"}),
    "debugLogging": frozenset({"local_debug_mode", "remote_debug_mode"}),
}
BLOCKED_REASONS = frozenset({"", "policy_unavailable", "ai_remote_access_terms_required", "mcp_disabled"})


class DiagnosticError(Exception):
    """Only fixed, non-sensitive error codes may reach the CLI."""


def find_binary(value=None):
    if value:
        path = Path(value).expanduser()
        if not path.is_absolute():
            raise DiagnosticError("absolute_binary_path_required")
    elif sys.platform == "darwin":
        path = Path("/Applications/AirDesk.app/Contents/MacOS/AirDesk")
    else:
        raise DiagnosticError("explicit_binary_path_required")
    if path.name == "AirDesk.app":
        path = path / "Contents" / "MacOS" / "AirDesk"
    if path.name not in ("AirDesk", "AirDesk.exe"):
        raise DiagnosticError("expected_airdesk_executable")
    if not path.is_file():
        raise DiagnosticError("airdesk_not_installed_at_path")
    if os.name != "nt" and not os.access(path, os.X_OK):
        raise DiagnosticError("airdesk_not_executable")
    return path.absolute()


def configuration(binary, client):
    command = str(binary)
    if any(ord(character) < 32 or ord(character) == 127 for character in command):
        raise DiagnosticError("invalid_binary_path_characters")
    if client == "codex":
        # JSON string escaping is valid for TOML basic strings with ASCII escapes.
        quoted = json.dumps(command, ensure_ascii=False)
        return ("[mcp_servers.airdesk]\n"
                f"command = {quoted}\n"
                'args = ["--mcp-server"]\n'
                "startup_timeout_sec = 20\n"
                "tool_timeout_sec = 60\n")
    return json.dumps({"mcpServers": {"airdesk": {
        "command": command, "args": ["--mcp-server"],
    }}}, indent=2, ensure_ascii=False) + "\n"


class StdioProbe:
    """Bounded, sequential JSON-RPC reader; not a general-purpose MCP client."""

    def __init__(self, command, timeout):
        self.timeout = timeout
        self.next_id = 0
        self.messages = queue.Queue(maxsize=16)
        self.overflow = threading.Event()
        env = os.environ.copy()
        # Inspect the installed app's normal profile, never injected test credentials.
        for key in ("REPC_STATE_DIR", "REPC_MCP_AUTH_TOKEN", "REPC_BACKEND_URL",
                    "AIRDESK_STATE_DIR", "AIRDESK_MCP_AUTH_TOKEN", "AIRDESK_BACKEND_URL"):
            env.pop(key, None)
        try:
            self.process = subprocess.Popen(
                command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL, shell=False, env=env,
            )
        except OSError:
            raise DiagnosticError("airdesk_start_failed") from None
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.reader.start()

    def _enqueue(self, value):
        try:
            self.messages.put_nowait(value)
            return True
        except queue.Full:
            self.overflow.set()
            return False

    def _read(self):
        try:
            while True:
                line = self.process.stdout.readline(MAX_LINE + 1)
                if not line:
                    self._enqueue(DiagnosticError("server_closed_stdout"))
                    return
                if len(line) > MAX_LINE or not line.endswith(b"\n"):
                    self._enqueue(DiagnosticError("invalid_message_size"))
                    return
                try:
                    message = json.loads(line.decode("utf-8"))
                except (UnicodeError, ValueError, RecursionError):
                    self._enqueue(DiagnosticError("invalid_json_message"))
                    return
                if not self._enqueue(message):
                    return
        except (OSError, ValueError):
            self._enqueue(DiagnosticError("server_read_failed"))

    def send(self, method, params=None, notification=False):
        message = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            message["params"] = params
        if not notification:
            self.next_id += 1
            message["id"] = self.next_id
        try:
            self.process.stdin.write((json.dumps(message) + "\n").encode("utf-8"))
            self.process.stdin.flush()
        except (OSError, ValueError):
            raise DiagnosticError("server_write_failed") from None
        if notification:
            return None
        deadline = time.monotonic() + self.timeout
        notifications = 0
        while True:
            if self.overflow.is_set():
                raise DiagnosticError("too_many_messages")
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise DiagnosticError("response_timeout")
            try:
                reply = self.messages.get(timeout=remaining)
            except queue.Empty:
                raise DiagnosticError("response_timeout") from None
            if isinstance(reply, DiagnosticError):
                raise reply
            if not isinstance(reply, dict) or reply.get("jsonrpc") != "2.0":
                raise DiagnosticError("invalid_rpc_message")
            if "id" not in reply and isinstance(reply.get("method"), str):
                notifications += 1
                if notifications > 32:
                    raise DiagnosticError("too_many_notifications")
                continue
            if type(reply.get("id")) is not int or reply["id"] != self.next_id:
                raise DiagnosticError("unexpected_response_id")
            if "error" in reply:
                raise DiagnosticError("server_rpc_error")
            if not isinstance(reply.get("result"), dict):
                raise DiagnosticError("invalid_rpc_result")
            return reply["result"]

    def close(self):
        try:
            self.process.stdin.close()
        except OSError:
            pass
        try:
            self.process.wait(timeout=1)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            try:
                self.process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=2)
        self.reader.join(timeout=1)
        self.process.stdout.close()
        return self.process.returncode


def status_payload(result):
    if result.get("isError", False) is not False:
        raise DiagnosticError("status_tool_error")
    if "structuredContent" in result:
        payload = result["structuredContent"]
    else:
        content = result.get("content", [])
        if not isinstance(content, list):
            raise DiagnosticError("invalid_status_payload")
        texts = [item.get("text") for item in content
                 if isinstance(item, dict) and item.get("type") == "text"]
        if len(texts) != 1 or not isinstance(texts[0], str):
            raise DiagnosticError("invalid_status_payload")
        try:
            payload = json.loads(texts[0])
        except (ValueError, RecursionError):
            raise DiagnosticError("invalid_status_payload") from None
    if not isinstance(payload, dict) or any(type(payload.get(flag)) is not bool for flag in STATUS_FLAGS):
        raise DiagnosticError("missing_or_invalid_status_flags")
    if "error" in payload:
        raise DiagnosticError("status_tool_error")
    flags = {flag: payload[flag] for flag in STATUS_FLAGS}
    version = payload.get("termsVersion")
    version_valid = isinstance(version, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", version)
    known_terms = type(payload.get("termsAccepted")) is bool and type(payload.get("termsRequired")) is bool and bool(version_valid)
    flags["termsVerified"] = known_terms
    if known_terms:
        flags["termsAccepted"] = payload["termsAccepted"]
        flags["termsRequired"] = payload["termsRequired"]
    if type(payload.get("mcpConfigured")) is bool:
        flags["mcpConfigured"] = payload["mcpConfigured"]
    if version_valid:
        flags["termsVersion"] = version
    reason = payload.get("blockedReason", "")
    flags["blockedReason"] = reason if isinstance(reason, str) and reason in BLOCKED_REASONS else "policy_unavailable"
    return flags


def diagnose(command, timeout=5):
    probe = StdioProbe(command, timeout)
    try:
        initialized = probe.send("initialize", {
            "protocolVersion": PROTOCOL, "capabilities": {},
            "clientInfo": {"name": "airdesk-skill-doctor", "version": VERSION},
        })
        if initialized.get("protocolVersion") != PROTOCOL:
            raise DiagnosticError("unsupported_protocol_version")
        capabilities = initialized.get("capabilities")
        if not isinstance(capabilities, dict) or not isinstance(capabilities.get("tools"), dict):
            raise DiagnosticError("tools_capability_missing")
        probe.send("notifications/initialized", notification=True)
        names = set()
        schemas = {}
        cursor = None
        seen_cursors = set()
        for _ in range(8):
            catalog = probe.send("tools/list", {"cursor": cursor} if cursor else {})
            tools = catalog.get("tools")
            if not isinstance(tools, list) or len(tools) > 512:
                raise DiagnosticError("invalid_tool_catalog")
            for tool in tools:
                if not isinstance(tool, dict) or not isinstance(tool.get("name"), str):
                    raise DiagnosticError("invalid_tool_catalog")
                names.add(tool["name"])
                schemas[tool["name"]] = tool.get("inputSchema")
            cursor = catalog.get("nextCursor")
            if cursor is None:
                break
            if not isinstance(cursor, str) or not cursor or len(cursor) > 4096 or cursor in seen_cursors:
                raise DiagnosticError("invalid_catalog_cursor")
            seen_cursors.add(cursor)
        else:
            raise DiagnosticError("too_many_catalog_pages")
        missing = sorted(REQUIRED_TOOLS - names)
        capabilities = {name: {"toolsAvailable": not bool(group - names), "missingTools": sorted(group - names)}
                        for name, group in OPTIONAL_TOOLS.items()}
        if missing:
            report = {"localPrerequisitesReady": False, "targetVerified": False,
                      "error": "required_tools_missing", "missingTools": missing,
                      "coreToolsAvailable": False, "controllerCapabilities": capabilities}
        else:
            click = schemas.get("remote_click")
            required = click.get("required") if isinstance(click, dict) else None
            bound_click = isinstance(required, list) and "screenshotId" in required
            if not bound_click:
                report = {"localPrerequisitesReady": False, "targetVerified": False,
                          "error": "required_tool_schema_missing", "missingSchemaFeatures": ["remote_click.screenshotId"],
                          "coreToolsAvailable": True, "controllerCapabilities": capabilities}
            else:
                flags = status_payload(probe.send("tools/call", {"name": "remote_status", "arguments": {}}))
                ready = all(flags[flag] for flag in FLAGS) and flags["termsVerified"] and flags["termsAccepted"] and not flags["termsRequired"] and not flags["blockedReason"]
                blocked = flags["blockedReason"]
                if blocked == "policy_unavailable":
                    pass
                elif not flags["termsVerified"]:
                    blocked = "terms_status_unavailable"
                elif flags["termsRequired"] or not flags["termsAccepted"]:
                    blocked = "ai_remote_access_terms_required"
                elif not flags["credentialAvailable"]:
                    blocked = "login_required"
                elif not all(flags[flag] for flag in ("mcpEnabled", "mcpServerEnabled")):
                    blocked = blocked or "mcp_disabled"
                report = {"localPrerequisitesReady": ready, "targetVerified": False,
                          "checks": flags, "toolCount": len(names), "coreToolsAvailable": True,
                          "controllerCapabilities": capabilities, "blockedReason": blocked}
    finally:
        returncode = probe.close()
    if returncode != 0:
        raise DiagnosticError("server_exit_failed")
    return report


def seconds(value):
    try:
        number = float(value)
    except ValueError:
        raise argparse.ArgumentTypeError("timeout must be a number") from None
    if not math.isfinite(number) or not 0.1 <= number <= 30:
        raise argparse.ArgumentTypeError("timeout must be between 0.1 and 30 seconds")
    return number


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    config = commands.add_parser("config", help="Print configuration; do not modify any files")
    config.add_argument("--client", choices=("codex", "claude-code", "claude-desktop", "generic"), default="codex")
    doctor = commands.add_parser("doctor", help="Inspect local prerequisites; never connect to a target")
    doctor.add_argument("--timeout", type=seconds, default=5, help="Seconds per response (default: 5)")
    for command in (config, doctor):
        command.add_argument("--binary", help="Absolute path to a trusted installed AirDesk executable")
    args = parser.parse_args(argv)
    try:
        binary = find_binary(args.binary)
        if args.command == "config":
            print(configuration(binary, args.client), end="")
            return 0
        report = diagnose([str(binary), "--mcp-server"], args.timeout)
        print(json.dumps(report, indent=2))
        return 0 if report["localPrerequisitesReady"] else 1
    except DiagnosticError as error:
        print(json.dumps({"localPrerequisitesReady": False, "targetVerified": False,
                          "error": str(error)}))
        return 2
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
