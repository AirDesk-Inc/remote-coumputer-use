# Windows Desktop Automation

These optional tools require a compatible **Windows target** and approved remote
terminal access, in addition to AirDesk installed and MCP ON at both ends.
Discovery of a tool on the controller alone does not prove target support.
Do not advertise these as macOS accessibility APIs.

| Tool | Use |
| --- | --- |
| `remote_list_apps` | Discover launchable apps and opaque `appId` values; use returned pagination. |
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

Prefer supported semantic actions (`invoke`, `select`, `toggle`, etc.) over
coordinate input. For `remote_window_input`, use its window-relative coordinate
contract, not the display-relative `remote_mouse_move` contract. Obtain a fresh
window state after navigation, resizing, app changes, or uncertain results.

A timeout may mean the action ran but its response was lost. Reinspect before
retrying. UIA cannot make elevated/secure desktops or inaccessible controls
automatically controllable. Do not bypass elevation, privacy, host consent, or
security controls. Password values should not be exposed; never try to extract
them through alternate tools.
