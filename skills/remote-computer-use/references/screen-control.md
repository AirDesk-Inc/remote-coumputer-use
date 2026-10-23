# Screen and Input

Follow the two-computer gate in SKILL.md first. The connected server's current
schemas and returned values override these interface notes.

| Tool | Purpose / important arguments |
| --- | --- |
| `remote_list_computers` | Authorized computers; optional exact nine-digit `remoteId`. |
| `remote_connect` | Exact `hostId`; `video: true` for screenshots. Retain returned `sessionId`. |
| `remote_status` | Local prerequisites and current connection state; no arguments. |
| `remote_screenshot` | `sessionId`, optional `maxWidth` (64-1920), `maxHeight` (64-1080). |
| `remote_select_display` | `sessionId`, discovered `displayIndex`. |
| `remote_mouse_move` | `sessionId`, integer `x`, `y` in native source pixels. |
| `remote_mouse_button` | `sessionId`, `button` (1 left, 2 middle, 3 right), `action` (`click`, `down`, `up`). |
| `remote_scroll` | `sessionId`, signed `amount` (120 units per notch), optional `horizontal`. |
| `remote_key` | `sessionId`, Windows virtual `keyCode`, optional modifier mask, `action` (`press`, `down`, `up`). |
| `remote_type_text` | `sessionId`, Unicode `text` (up to 4096 bytes in the native validation). |
| `remote_disconnect` | The `sessionId` owned by this task. |

## Coordinate Mapping

`remote_screenshot` returns PNG plus `width`, `height`, `sourceWidth`,
`sourceHeight`, and `displayIndex`. The PNG can be smaller than the native display.

For a point `(imageX, imageY)` measured in that PNG's pixel dimensions:

```text
nativeX = min(sourceWidth - 1, floor(imageX * sourceWidth / width))
nativeY = min(sourceHeight - 1, floor(imageY * sourceHeight / height))
```

First ensure dimensions are positive and the point lies inside the PNG. If the
viewer scaled, cropped, or letterboxed the image, first map the visible point
back into the actual PNG pixel coordinates. Never use the controller's screen
resolution or an older display's dimensions. Values must also fit the current
tool schema; do not silently clamp an unsupported large display to 32766.

After `remote_select_display`, wait until `displaySwitchPending` is false and
obtain a fresh screenshot for the selected index. Recalculate all coordinates.
If an overview/composite image lacks an explicit per-display mapping, do not
guess its layout: select one discovered display and recapture.

## Reliable Actions

1. Read a new frame, identify the intended target, and confirm `inputReady`.
2. Move to native coordinates, then click. For drag, pair `down` with `up` even
   when a later step fails. Use focused actions, not an unbounded input stream.
3. Check a new frame for the expected result. A queued/accepted response does not
   prove that the target received or acted on it.
4. For text, focus the correct field before `remote_type_text`. Prefer text input
   over synthesizing individual character keys, especially for composed Unicode.

Virtual key codes are the protocol's Windows VK values, not macOS hardware
scancodes or character code points. Consult the current schema/native mapping for
modifiers; do not guess shortcut mappings across platforms. Never type credentials
into an uncertain field or include them in public traces.
