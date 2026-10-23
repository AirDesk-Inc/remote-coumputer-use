# Validation and Compatibility

## Automated Coverage

The standard-library test suite uses deterministic local MCP subprocess fixtures:

- Initialization order, protocol version, tool discovery and pagination.
- Exactly one allowed tool call: `remote_status`; no remote discovery or control.
- Each required flag OFF, missing/invalid flags, and missing tools.
- Structured results and the legacy text-JSON fallback.
- JSON-RPC errors and tool-level errors without raw message disclosure.
- Invalid JSON/UTF-8, oversized messages, wrong response IDs, EOF, notifications,
  queue flood, timeouts, failed exits, and child-process cleanup.
- Ignoring injected test credentials/profile overrides.
- Configuration escaping, binary path checks, and no process launch for `config`.

Run from the repository root:

```sh
python3 -m unittest discover -s tests -v
```

CI is configured for Python 3.10 and 3.13 on macOS, Windows, and Linux. A configured
matrix is not evidence that those jobs have passed; inspect the actual Actions
run. Linux here tests the helper and fixture, not a Linux AirDesk host.

## Initial Native Check

On 2026-10-24, the helper was run against the installed macOS AirDesk release:
MCP initialization, discovery of 25 tools, and the local status call succeeded.
The local MCP and Remote Terminal settings were OFF, so the diagnostic correctly
returned a non-ready result. Those settings were not changed. No account secrets,
target identities, or raw app state are included in this repository.

This proves compatibility of that installed build's local stdio/status contract.
It does **not** prove end-to-end remote screen, mouse, keyboard, terminal, Windows
UI Automation, or target MCP enforcement. No remote session was opened as part
of publication. The target's MCP setting is not remotely attested by this helper.

## Opt-In Acceptance Checklist

Only perform these with the owner's explicit authorization and both-computer
setup complete. Use a disposable app/document, not a live production workflow.

- [ ] Verify AirDesk installed, MCP ON, Remote Terminal ON locally on each PC.
- [ ] Authenticate/approve the intended user; select the exact authorized target.
- [ ] Connect, verify current session/display and a changing screenshot.
- [ ] Test resized-image-to-source coordinate mapping at center and corners.
- [ ] Switch a display, wait for completion, and discard old coordinates.
- [ ] Test click, key, composed text and key/button release in a test document.
- [ ] Open/read/write/resize/close a terminal and verify a harmless command's
      shell exit status, not merely transport acknowledgment.
- [ ] On supported Windows targets, discover an app/window and use a fresh UI
      snapshot; check stale-ID and unsupported-control behavior.
- [ ] Disable MCP in the controller app and verify controls stop. Check target
      permission revocation separately; do not claim remote attestation.
- [ ] Confirm owned terminal/session cleanup, including cancellation/timeouts.

Record app/skill versions, OS, action, expected/observed result and limitations
without saving credentials, host/session IDs, personal screens, or private logs.
