# Validation and Compatibility

## Automated Coverage

The standard-library test suite uses deterministic local MCP subprocess fixtures:

- Initialization order, protocol version, tool discovery and pagination.
- Exactly one allowed tool call: `remote_status`; no remote discovery or control.
- Each required flag OFF, missing/invalid flags, and missing tools.
- Controller MCP ON with local Remote Terminal OFF remains ready.
- Current consent is required separately from the saved switch; missing consent
  status is unverified, not ready. Blocked reasons are allowlisted.
- Required screenshot-bound pointer schemas and optional controller tool groups.
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
enable failures, known terms errors before writes, bounded partial-install
recovery, official-release upgrades with backups, Python cache handling,
concurrent file edits, selected JSON clients, path escaping, and CLI validation.
Codex TOML remains append-only; JSON merges retain unrelated entries and a prior-file
backup. Desktop/generic skill import is not asserted by a successful MCP config write.
Tests use temporary files
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
Remote Terminal for shell tools are still required. Desktop/browser automation
uses approved host access and input permissions, independently of the shell setting.

## Native Enhancements, 2026-10-25

At the 2026-10-25 source checkpoint the native registry exposed 32 tools; current
tool availability must be discovered rather than inferred from that historical
count. The focused tests at that checkpoint covered
screenshot bindings/automatic coordinate mapping, stale display/session/size
rejection, frame wait timeout, named chords, MCP revocation and terminal ownership.
A disposable sandboxed headless Chrome profile verifies actual CDP tab discovery,
navigation, DOM text input/click, password redaction and stale snapshot rejection.
The Mac native fixture tests worker framing/cancellation and uses a temporary
owned window to test AX discovery, password redaction and value updates when OS
Accessibility permission is available; permission-denial coverage is distinct.
These checks do not certify Windows runtime or installed two-computer acceptance.
Browser DOM requires an explicitly enabled target loopback debugging browser;
installing this skill does not enable browser debugging or update the native app.

## Source improvements, 2026-10-29

The prepared 0.1.2 skill describes PNG-bound click/drag/scroll, region zoom that
retains full-PNG coordinates, actual cursor telemetry, bounded key repeat/hold,
and Windows/macOS window coordinates separately. New tools require the matching
native app and negotiated target capability. Browser traversal exclusions, tab
activation, bounded semantic editing and persistent local/remote debug settings
are explicit. This package change does not install a native app, modify in-app
consent, configure a real user profile, publish npm or prove two-computer input.

Official 0.1.0/0.1.1 npm archive files were read from the public registry and checked
against their SHA-512 integrity values to generate the shipped SHA-256 upgrade
manifests. A known 0.1.0 Git source variant is separately identified. The complete
previous skill directory is retained during upgrades; customization is rejected
instead of overwritten.

## Opt-In Acceptance Checklist

Only perform these with the owner's explicit authorization and both-computer
setup complete. Use a disposable app/document, not a live production workflow.

- [ ] Verify AirDesk on both PCs, controller MCP ON and local terminal OFF.
- [ ] Leave target MCP OFF; confirm desktop/browser automation with approved input.
- [ ] With target Remote Terminal OFF, ask its owner to enable it before shell work only.
- [ ] Authenticate/approve the intended user; select the exact authorized target.
- [ ] Connect, verify current session/display and a changing screenshot.
- [ ] Test resized-image-to-source coordinate mapping at center and corners.
- [ ] Switch a display, wait for completion, and discard old coordinates.
- [ ] Test click, key, composed text and key/button release in a test document.
- [ ] Open/read/write/resize/close a terminal and verify a harmless command's
      shell exit status, not merely transport acknowledgment.
- [ ] On supported Windows/macOS targets, discover an app/window and use a fresh UI
      snapshot; check stale-ID and unsupported-control behavior.
- [ ] Disable MCP in the controller app and verify controls stop. Check target
      permission revocation separately; do not claim remote attestation.
- [ ] Confirm owned terminal/session cleanup, including cancellation/timeouts.

Record app/skill versions, OS, action, expected/observed result and limitations
without saving credentials, host/session IDs, personal screens, or private logs.
