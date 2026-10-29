# Remote Browser Control

These tools execute on the authorized target, inside AirDesk's authenticated
automation worker. They are not local browser tools and require approved input.
Target MCP and Remote Terminal toggles are not required.

Supported: Chromium-based browsers, including Chrome and Edge, with an already
enabled loopback CDP endpoint. Safari, Firefox, shadow DOM (open or closed) and
iframe contents are not traversed. State reports these traversal capabilities and
unsupported subtrees; do not infer that an omitted control does not exist.
Ordinary screenshot/UI automation remains
available without browser debugging.

If no debugging browser is available, explain the requirement and ask the user
to enable a dedicated browser/profile. Do not relaunch their normal browser,
change its settings, expose a port on the LAN, or disable browser security.
Current Chromium versions may require a non-default profile for debugging.

| Tool | Contract |
| --- | --- |
| `remote_browser_list_tabs` | `sessionId`, optional `port` (default 9222). Exact loopback port, no scan. Returns opaque tabIds. |
| `remote_browser_activate_tab` | `sessionId`, discovered `tabId`. Bring the intended target tab forward before comparing DOM actions with display screenshots; verify the result. |
| `remote_browser_navigate` | `sessionId`, discovered `tabId`, HTTP(S) `url`. No script/file/data URLs or embedded credentials. |
| `remote_browser_get_state` | `sessionId`, `tabId`, optional `maxDepth` / `maxElements`. Bounded DOM with snapshotId and elementIds; values omitted. |
| `remote_browser_element_action` | `sessionId`, `tabId`, fresh `snapshotId`, `elementId`. `click`/`focus`; `type`/`replace` with `text`; `press_key` with `key`; `select_option` with observed `optionIndex` (0–255). |

Discover the exact tab, read state, act on a returned element, then read state and
verify the result. Type inserts text at focus; it does not replace the whole value
or press Enter. Use `replace` only when the task authorizes replacing an editable
field's entire value. `press_key` accepts the schema's small navigation-key set,
not arbitrary script or shell syntax: Enter, Tab, Escape, ArrowUp/Down/Left/Right,
Home, End, PageUp and PageDown. An empty replacement clears a non-protected field.
State returns safe labels and sanitized link
destinations; omitted values and protected fields remain private.
No caller-supplied JavaScript, cookies, credential extraction or shell
fallback is exposed. Password DOM controls reject mutation through these tools.
Use the user's normal authenticated workflow for protected inputs.

`select_option` supports a single-selection SELECT only. Use an `index` returned
in that select's bounded `options` list, not a guessed ordinal or option value.
`optionsComplete:false` and `optionCountLowerBound` describe an incomplete list.
Disabled/hidden/inert options, disabled optgroups/fieldsets and protected controls
remain unavailable. The response's `accepted`, `selectionChanged` or
`selectionMatched` describes immediate dispatch/state; a page handler may override
the choice. Read state and verify the user-visible outcome instead of repeating
selection blindly. Values and arbitrary expressions/functions are not arguments.

Snapshots expire after 30 seconds and are invalidated by actions, tab changes or
document updates. Large pages may be truncated; increase bounded depth/count or
use screenshot/accessibility controls. A timeout does not prove an action failed:
reobserve before retrying. CDP navigation acceptance is not page readiness.

The browser connection remains on 127.0.0.1 on the target. AirDesk only transfers
bounded results over its existing direct BUD connection; it never exposes CDP as
a network service or sends browser data through the backend.
