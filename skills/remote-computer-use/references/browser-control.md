# Remote Browser Control

These tools execute on the authorized target, inside AirDesk's authenticated
automation worker. They are not local browser tools and require approved input.
Target MCP and Remote Terminal toggles are not required.

Supported: Chromium-based browsers, including Chrome and Edge, with an already
enabled loopback CDP endpoint. Safari, Firefox, closed shadow roots and out-of-process
iframe targeting are not implemented. Ordinary screenshot/UI automation remains
available without browser debugging.

If no debugging browser is available, explain the requirement and ask the user
to enable a dedicated browser/profile. Do not relaunch their normal browser,
change its settings, expose a port on the LAN, or disable browser security.
Current Chromium versions may require a non-default profile for debugging.

| Tool | Contract |
| --- | --- |
| `remote_browser_list_tabs` | `sessionId`, optional `port` (default 9222). Exact loopback port, no scan. Returns opaque tabIds. |
| `remote_browser_navigate` | `sessionId`, discovered `tabId`, HTTP(S) `url`. No script/file/data URLs or embedded credentials. |
| `remote_browser_get_state` | `sessionId`, `tabId`, optional `maxDepth` / `maxElements`. Bounded DOM with snapshotId and elementIds; values omitted. |
| `remote_browser_element_action` | `sessionId`, `tabId`, fresh `snapshotId`, `elementId`, `action`: click/focus/type. Only type accepts `text`. |

Discover the exact tab, read state, act on a returned element, then read state and
verify the result. Type inserts text at focus; it does not replace the whole value
or press Enter. No arbitrary JavaScript, cookies, credential extraction or shell
fallback is exposed. Password DOM controls reject mutation through these tools.
Use the user's normal authenticated workflow for protected inputs.

Snapshots expire after 30 seconds and are invalidated by actions, tab changes or
document updates. Large pages may be truncated; increase bounded depth/count or
use screenshot/accessibility controls. A timeout does not prove an action failed:
reobserve before retrying. CDP navigation acceptance is not page readiness.

The browser connection remains on 127.0.0.1 on the target. AirDesk only transfers
bounded results over its existing direct BUD connection; it never exposes CDP as
a network service or sends browser data through the backend.
