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
are explicit. The observation-only window guidance at that checkpoint is
superseded by the interactive-window policy below. Native runtime behavior must
be verified separately from documentation/package checks.
This package change does not install a native app, modify in-app
consent, configure a real user profile, publish npm or prove two-computer input.

Official 0.1.0/0.1.1 npm archive files were read from the public registry and checked
against their SHA-512 integrity values to generate the shipped SHA-256 upgrade
manifests. A known 0.1.0 Git source variant is separately identified. The complete
previous skill directory is retained during upgrades; customization is rejected
instead of overwritten.

## Interactive Window Policy, 2026-10-31

The default MCP/RCU remote-desktop policy and skill explicitly use
`video:true,showWindow:true`. Visible connections must open a real interactive
remote window with local mouse/keyboard forwarding and the normal toolbar,
subject to existing host input permissions, not an observation-only window.
Manual and AI input share it; pause AI input during user interaction and
re-observe after handback. Native MCP/agent ownership, returned session IDs,
owned-terminal/held-input cleanup and window-close session termination remain.
Headless/no-video modes require the user's explicit request; an older build must
not silently fall back or be treated as satisfying this policy.

Authentication, current consent, host/input permissions and the target's shell
terminal permission gate are unchanged. Clipboard is independent and remains
disabled for MCP ownership, including automatic capture/sync. Window visibility
does not enable audio; microphone, overlay and recording settings are unchanged.
Do not promise automatic clipboard or audio. This documentation/installed-skill
update does not change or verify native runtime behavior. Package checks cannot
prove an interactive window, manual input forwarding, toolbar behavior or native
ownership/cleanup; those require the opt-in checks below.

Native checkpoint (2026-10-31, separate from npm publication): the macOS source
implementation and signed installed app were updated. A fresh native stdio
session returned the interactive connection description, `interactiveWindow:true`,
`localInputReady:true`, input/video readiness and a STEAMDECK PNG. Focused input,
policy, clipboard, close, cursor, stdio and GUI-lifetime tests passed. The user
subsequently confirmed STEAMDECK remote interactions work. Repeated IDRs were
reported separately and remain under investigation; input acceptance does not
prove stable video recovery. No AI input was sent during the manual handoff.
Linux's no-display SDL idle fixture passed,
but live Linux/Windows controller acceptance and npm publication remain undone.

## Opt-In Acceptance Checklist

Only perform these with the owner's explicit authorization and both-computer
setup complete. Use a disposable app/document, not a live production workflow.

- [ ] Verify AirDesk on both PCs, controller MCP ON and local terminal OFF.
- [ ] Leave target MCP OFF; confirm desktop/browser automation with approved input.
- [ ] With target Remote Terminal OFF, ask its owner to enable it before shell work only.
- [ ] Authenticate/approve the intended user; select the exact authorized target.
- [ ] Verify omitted connection options default to `video:true,showWindow:true`;
      verify the skill explicitly passes both true. Check separate video/window
      status, current session/display and a changing screenshot.
- [ ] Verify a real interactive remote window with the normal toolbar, not an
      observation-only window. With AI input paused, test the controller's physical
      mouse and keyboard under existing host input permissions. Hand back to AI,
      take a fresh observation and verify MCP input on the same owned session.
- [ ] Confirm native MCP/agent ownership and session ID continuity; closing the
      window must not leave a separate unowned/manual session.
- [ ] Verify clipboard remains independent/disabled for MCP ownership and the
      visible window does not auto-enable audio or change microphone/overlay/recording.
- [ ] Verify headless (`video:true,showWindow:false`) and no-video (`video:false`)
      modes only when the user explicitly requests those acceptance tests.
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
- [ ] Close the owned real remote window and verify session end, held-input
      release and owned-terminal cleanup without automatic reconnect.

Record app/skill versions, OS, action, expected/observed result and limitations
without saving credentials, host/session IDs, personal screens, or private logs.
