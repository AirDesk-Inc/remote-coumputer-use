# Windows and macOS Desktop Automation

These tools require a compatible Windows/macOS target, approved host access and
keyboard/mouse permission, AirDesk on both computers and MCP ON on the controller.
Neither target MCP mode nor Remote Terminal is required for automation. Shell
access remains separate: if Remote Terminal is OFF, ask before using terminal tools.
macOS requires OS Accessibility permission for the host app; do not grant it silently.
Discovery of a tool on the controller alone does not prove target support.

| Tool | Use |
| --- | --- |
| `remote_list_apps` | Windows installed apps / macOS running apps and opaque appIds; use pagination. |
| `remote_launch_app` | Launch a discovered `appId`; not arbitrary paths, URLs or shell commands. |
| `remote_list_windows` | Discover windows and opaque `windowId` values. |
| `remote_get_window` | Inspect one discovered `windowId`. |
| `remote_activate_window` | Activate the intended discovered window. |
| `remote_get_window_state` | Get a fresh UI snapshot (`snapshotId`, elements); bound depth/count. |
| `remote_set_value` | Set `value` using current `windowId`, `snapshotId`, `elementId`. |
| `remote_element_action` | Supported semantic action on an element from that snapshot. |
| `remote_window_input` | Snapshot-scoped click/double-click/drag/scroll/key/text input. |

All require the task's `sessionId`. Use the exact current schemas for optional
parameters and action enums. IDs are opaque: never build a window ID from a title,
guess an element index, or reuse stale IDs after a disconnect/helper restart.
Window IDs represent host-validated native windows; returned metadata includes
titles, process IDs, bounds and state. Do not construct or pass guessed HWNDs.

On macOS the same tools use AXUIElement, not Windows UIA. App launch activates an
already running discovered app. Supported semantic mutations are `invoke` and
`focus`, plus writable non-password values. Other actions fail explicitly.
Window gestures use Quartz logical points relative to the returned window bounds,
not Retina pixels; display screenshot tools still map their own native-pixel space.
Never mix these coordinate contracts. macOS snapshots expire after 30 seconds;
Windows snapshots retain their existing shorter lifetime. Reobserve after mutation.

Prefer supported semantic actions (`invoke`, `select`, `toggle`, etc.) over
coordinate input. For `remote_window_input`, use its window-relative coordinate
contract, not the display-relative `remote_mouse_move` contract. Obtain a fresh
window state after navigation, resizing, app changes, or uncertain results.

A timeout may mean the action ran but its response was lost. Reinspect before
retrying. UIA cannot make elevated/secure desktops or inaccessible controls
automatically controllable. Do not bypass elevation, privacy, host consent, or
security controls. Password values should not be exposed; never try to extract
them through alternate tools.
