# Screen and Input

Follow the two-computer gate in SKILL.md first. The connected server's current
schemas and returned values override these interface notes.

| Tool | Purpose / important arguments |
| --- | --- |
| `remote_list_computers` | Authorized computers; optional exact nine-digit `remoteId`. |
| `remote_connect` | Exact `hostId`; `video: true` for screenshots. Retain returned `sessionId`. |
| `remote_status` | Local prerequisites and current connection state; no arguments. |
| `remote_screenshot` | `sessionId`, optional `maxWidth` (64-1920), `maxHeight` (64-1080), `afterFrameId`, `waitMs` (0-10000). |
| `remote_observe` | Same screenshot options plus optional discovered `windowId`, `maxDepth`, `maxElements`, `includeText`; PNG and accessibility state in one call. |
| `remote_select_display` | `sessionId`, discovered `displayIndex`. |
| `remote_mouse_move` | `sessionId`, integer `x`, `y`; pass `screenshotId` to use PNG pixels, otherwise native source pixels. |
| `remote_click` | `sessionId`, latest `screenshotId`, full-PNG `x`, `y`, optional `button`, `clickCount` (1–3), `modifiers` (protocol mask). One bounded gesture. |
| `remote_drag` | `sessionId`, latest `screenshotId`, `points` (2–128 full-PNG `{x,y}` points), optional `durationMs` (0–2000), `button`, `modifiers`. Releases its own inputs on success/failure. |
| `remote_cursor_position` | `sessionId`, optional current `screenshotId`. Reads actual host cursor telemetry; fails if unavailable, never guesses from a previous command. |
| `remote_zoom` | `sessionId`, current `screenshotId`, full-PNG `x`, `y`, `width`, `height`, optional `maxWidth` / `maxHeight`. Returns a region image without replacing the full-PNG coordinate binding. |
| `remote_mouse_button` | `sessionId`, `button` (1 left, 2 middle, 3 right, 4 X1, 5 X2), `action` (`click`, `down`, `up`). |
| `remote_scroll` | `sessionId`, signed `amount` (120 units per notch), optional `horizontal` / `modifiers`. For targeted scrolling supply all of `x`, `y`, `screenshotId` in full-PNG pixels; omission uses the current cursor. |
| `remote_key` | `sessionId`, Windows virtual `keyCode`, optional modifier mask, `action` (`press`, `down`, `up`). |
| `remote_press_key` | `sessionId`, named `key` such as `Ctrl+L`, `Cmd+C`, `Ctrl+Alt+Shift+Backtick`; optional `repeat` (1–100) / `holdMs` (0–2000), total bounded to 10 seconds. Releases its own chord. |
| `remote_type_text` | `sessionId`, Unicode `text` (up to 4096 bytes in the native validation). |
| `remote_disconnect` | The `sessionId` owned by this task. |
| `local_debug_mode` | Controller only; omit `enabled` to read. Setting it persists local file logging. No remote session is implied. |
| `remote_debug_mode` | Selected target `sessionId`; omit `enabled` to read. Setting it persists target file logging and requires task authorization for that change. No target MCP/terminal toggle or log upload. |

## Coordinate Mapping

`remote_screenshot` returns PNG plus `width`, `height`, `sourceWidth`,
`sourceHeight`, `displayIndex`, `frameId`, `generation` and opaque `screenshotId`.
The PNG can be smaller than the native display. Prefer passing this screenshotId
to `remote_click` or `remote_mouse_move`: x/y are then PNG pixels and the server
maps them automatically. The latest binding expires after 60 seconds or a new
screenshot, connection/display generation or geometry change. A stale binding
fails before input; recapture rather than dropping the ID to bypass validation.

`remote_zoom` magnifies a region for inspection. Subsequent pointer coordinates
are still relative to the **original full PNG**, never to the zoom image. Use the
returned affine mapping, including offsets (native crop rounding can make these
different from the requested region origin):

```text
fullX = imageToFullOffsetX + zoomImageX * imageToFullScaleX
fullY = imageToFullOffsetY + zoomImageY * imageToFullScaleY
```

Choose integer full-PNG coordinates within the reported full-image bounds for
pointer input. Do not substitute the requested `region.x/y` for the returned offsets.
Zoom does not create a new pointer binding. Cursor coordinates are meaningful only
in the coordinate space returned by `remote_cursor_position`; supply screenshotId
when you need the matching full-PNG space.

Only a deliberately unbound `remote_mouse_move` uses native source pixels. Do not
apply this conversion before screenshot-bound click, drag or scroll. If the
required screenshot binding is unavailable, update the app; never drop a stale
ID just to make input pass.

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

`remote_observe` can combine a screenshot with `windowState` in one tool call.
It captures first, then reads accessibility; `atomic:false` explicitly means the
two observations are not an atomic snapshot. Keep display PNG coordinates and
window-relative bounds separate and use each returned ID for its own action.

Screenshots wait up to 3000ms by default for initial video and for a newer decoded
frame after input. `afterFrameId` explicitly requires a greater frame counter;
`waitMs:0` never waits. Counters are session/display-generation scoped. After
reconnect/display changes discard previous counters and IDs. A later decoded
frame is NOT a host acknowledgment that input was applied, nor proof the app
finished loading; inspect its actual contents. `frame_wait_timeout` can indicate
stalled video or an unchanged stream: inspect status, never repeat mutations blindly.
To inspect the current decoded frame without requiring one newer than the last
input, explicitly pass `afterFrameId:0` (and `waitMs:0` if no waiting is wanted).
That observation does not prove the preceding input reached or changed the app.
`waitMs:0` alone keeps the default after-input frame requirement and can time out.
`allowCurrentFrame:true` is another explicit current-frame mode; combining it with
a nonzero `afterFrameId` fails with `invalid_observation_mode`. When either mode
returns `freshAfterInput:false`, it preserves the pending input marker, so a later
default observation still waits for a frame newer than that input.

1. Read a new frame, identify the intended target, and confirm `inputReady`.
2. Prefer `remote_click` / `remote_drag` with the latest screenshotId. If a legacy
   server only offers raw drag, pair `down` with `up` even when a later step fails.
   Use focused actions, not an unbounded input stream.
3. Check a new frame for the expected result. A queued/accepted response does not
   prove that the target received or acted on it.
4. For text, focus the correct field before `remote_type_text`. Prefer text input
   over synthesizing individual character keys, especially for composed Unicode.

Virtual key codes are the protocol's Windows VK values, not macOS hardware
scancodes or character code points. Consult the current schema/native mapping for
modifiers: Shift=1, Ctrl=2, Alt=4 and Meta/Cmd=8, combined with bitwise OR.
Do not guess shortcut mappings across platforms. Never type credentials
into an uncertain field or include them in public traces.

Raw manual holds share input ownership with bounded gestures. While a raw hold is
active, `remote_window_input` returns `input_busy`; release it with its original
button or `keyCode` before retrying. Generic/left Shift, Ctrl and Alt aliases share
ownership. On macOS, physical-key aliases VK 92/93, 45/47 and 12/144/254 cannot be
held or chorded together; Windows keeps its distinct keys separate. Releasing a
different alias is rejected and reports the original held code: use that exact
code for `up`.

Text limits are UTF-8 **bytes**, not visible characters: screen text is at most
4096 bytes and terminal input at most 16384 bytes per call. Current schemas expose
`x-maxUtf8Bytes` in addition to Unicode `maxLength`. Do not split and retry a failed
terminal write blindly: inspect its queue admission and output first.
