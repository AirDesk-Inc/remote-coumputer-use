# Validation and Compatibility

## Automated Coverage

The standard-library test suite uses deterministic local MCP subprocess fixtures:

- Initialization order, protocol version, tool discovery and pagination.
- Exactly one allowed tool call: `remote_status`; no remote discovery or control.
- Each required flag OFF, missing/invalid flags, and missing tools.
- Controller MCP ON with local Remote Terminal OFF remains ready.
- Structured results and the legacy text-JSON fallback.
- JSON-RPC errors and tool-level errors without raw message disclosure.
- Invalid JSON/UTF-8, oversized messages, wrong response IDs, EOF, notifications,
  queue flood, timeouts, failed exits, and child-process cleanup.
- Ignoring injected test credentials/profile overrides.
- Configuration escaping, binary path checks, and no process launch for `config`.

Run from the repository root:

```sh
npm ci --ignore-scripts
npm test
npm run check:package
python3 -m unittest discover -s tests -v
```

The Node installer suite covers safe config merging, repeated installs,
conflicting existing data, dry-run/skill-only behavior, native compatibility and
enable failures, path escaping, and CLI validation. Tests use temporary files
and stub native setup; they do not change real AirDesk settings. The package
check validates the allowlisted archive contents and size without publishing.

CI is configured for Python 3.10 and 3.13 on macOS, Windows, and Linux. A configured
matrix is not evidence that those jobs have passed; inspect the actual Actions
run. Node.js 22/24 installer jobs cover the same OS matrix. Linux here tests
packaging/helpers, not a Linux AirDesk host.

## Initial Native Check

On 2026-10-24, the helper was run against the installed macOS AirDesk release:
MCP initialization, discovery of 25 tools, and the local status call succeeded.
The local MCP and Remote Terminal settings were OFF, so the diagnostic correctly
returned a non-ready result. Those settings were not changed. No account secrets,
target identities, or raw app state are included in this repository.

This proves compatibility of that installed build's local stdio/status contract.
It does **not** prove end-to-end remote screen, mouse, keyboard, terminal, Windows
UI Automation, or host permission enforcement. No remote session was opened as
part of publication. Target MCP is not a prerequisite; approved host access and
Remote Terminal for terminal/window tools are still required.

## Opt-In Acceptance Checklist

Only perform these with the owner's explicit authorization and both-computer
setup complete. Use a disposable app/document, not a live production workflow.

- [ ] Verify AirDesk on both PCs, controller MCP ON and local terminal OFF.
- [ ] Leave target MCP OFF; confirm target Remote Terminal ON for terminal/window tools.
- [ ] With target Remote Terminal OFF, confirm the agent asks its owner to enable it before retrying those tools.
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
