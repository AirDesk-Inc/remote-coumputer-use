"""Deterministic local test double. Never contacts a network or a real computer."""

import json
from pathlib import Path
import sys
import time

MODE = sys.argv[1]
LOG = Path(sys.argv[2]) if len(sys.argv) > 2 else None
NAMES = (
    "remote_list_computers remote_connect remote_status remote_disconnect "
    "remote_screenshot remote_select_display remote_mouse_move remote_mouse_button "
    "remote_scroll remote_key remote_type_text terminal_open terminal_write "
    "terminal_read terminal_resize terminal_close"
).split()
PRIVATE = "PRIVATE_SENTINEL_MUST_NOT_APPEAR"


def emit(data):
    print(json.dumps(data), flush=True)


for line in sys.stdin:
    message = json.loads(line)
    if LOG:
        with LOG.open("a", encoding="utf-8") as output:
            output.write(json.dumps(message) + "\n")
    if "id" not in message:
        continue
    method = message["method"]
    if method == "initialize":
        if MODE == "timeout":
            time.sleep(60)
        if MODE == "eof":
            sys.exit(0)
        if MODE == "invalid_utf8":
            sys.stdout.buffer.write(b"\xff\n")
            sys.stdout.buffer.flush()
            continue
        if MODE == "invalid_json":
            print(PRIVATE, flush=True)
            continue
        if MODE == "oversize":
            print("x" * (1024 * 1024 + 1), flush=True)
            continue
        if MODE == "array":
            emit([])
            continue
        if MODE == "flood":
            for _ in range(64):
                emit({"jsonrpc": "2.0", "method": "notifications/message", "params": {"data": PRIVATE}})
        result = {"protocolVersion": "bad" if MODE == "protocol" else "2025-11-25",
                  "capabilities": {} if MODE == "no_tools_capability" else {"tools": {}},
                  "serverInfo": {"name": "test-double", "version": "1"}}
    elif method == "tools/list":
        if MODE == "missing_tool":
            names = NAMES[:-1]
        elif MODE == "pages":
            names = NAMES[:8] if not message["params"].get("cursor") else NAMES[8:]
        else:
            names = NAMES
        result = {"tools": [{"name": name, "inputSchema": {"type": "object"}} for name in names]}
        if MODE == "pages" and not message["params"].get("cursor"):
            result["nextCursor"] = "page-2"
        if MODE == "cursor_loop":
            result["nextCursor"] = "same"
        if MODE == "invalid_catalog":
            result["tools"] = [{}]
    elif method == "tools/call":
        assert message["params"] == {"name": "remote_status", "arguments": {}}
        status = {"mcpEnabled": True, "mcpServerEnabled": True,
                  "remoteTerminalEnabled": True, "credentialAvailable": True,
                  "sessionId": PRIVATE, "hostId": PRIVATE, "token": PRIVATE}
        if MODE.startswith("off:"):
            status[MODE.split(":", 1)[1]] = False
        if MODE == "string_bool":
            status["mcpEnabled"] = "true"
        if MODE == "missing_flag":
            del status["credentialAvailable"]
        result = {"structuredContent": status, "content": [{"type": "text", "text": json.dumps(status)}]}
        if MODE == "text_only":
            del result["structuredContent"]
        if MODE == "tool_error":
            result["isError"] = True
        if MODE == "payload_error":
            status["error"] = PRIVATE
        if MODE == "null_structured":
            result["structuredContent"] = None
        if MODE == "rpc_error":
            emit({"jsonrpc": "2.0", "id": message["id"], "error": {"code": -32603, "message": PRIVATE}})
            continue
    else:
        raise AssertionError("Unexpected method")
    if MODE == "notification":
        emit({"jsonrpc": "2.0", "method": "notifications/message", "params": {"data": PRIVATE}})
    emit({"jsonrpc": "2.0", "id": 999 if MODE == "wrong_id" else message["id"], "result": result})

if MODE == "shutdown_hang":
    time.sleep(60)
if MODE == "bad_exit":
    sys.exit(3)
