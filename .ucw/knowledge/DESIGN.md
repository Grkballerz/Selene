# Design

> Architecture overview + lightweight ADR log. The scribe appends entries on
> architectural shifts; structural rewrites pause for your OK.

## What this project does
Selene: a thin Android/Google TV WebView wrapper (Kotlin) plus an injected JS shim (selene-inject.js, doubling as a Tampermonkey userscript) that unlocks Amazon Luna cloud gaming on unsupported devices (Google TV Streamer, Chromecast with Google TV, NVIDIA Shield, Walmart Onn) by spoofing a desktop Chrome UA and answering Luna's low-latency capability probes correctly. Also adds a WebRTC stats HUD and controller deadzone/remap tuning. Unofficial, does not bypass auth/DRM/paywalls.

## Key abstractions
- **Settings overlay** — D-pad navigable in-page menu (`selene-inject.js`), opened by a rebindable **menu chord** (`S.menuChord`, default `[8, 9]`; hold-to-open, captured live via a "Force standard mapping"-style capture UI). Pages: Stats HUD toggles, zoom, controller remap, **Controller test** (live button/axis + key readout), **Session report**.
- **Streaming detection** (`isStreaming()` / `streamActive`) — true only while WebRTC video frames are actually flowing (driven off `framesDecoded` deltas on the active `peer`), not merely while a `peer` object exists. Drives auto-behaviors that must not run mid-game.
- **Whole-page zoom** (`S.uiZoom`, `document.documentElement.style.zoom`) — shrinks Luna's TV UI to taste on menus, but is forced to 100% while `isStreaming()` is true, because CSS zoom during an active stream stalls the video decode pipeline (observed freeze source).
- **Stats HUD** — WebRTC `getStats()` polling loop; tracks fps, bitrate, rtt, dropped frames, packet loss, jitter, codec, decode time (`totalDecodeTime` delta), and freeze count (`freezeCount`).
- **Session recorder** — samples `RTCPeerConnection.getStats()` every second for the lifetime of a stream, aggregates per-session summaries (rtt/jitter/decode/fps p95-style stats, loss max, drop max, freezes, freezes-per-minute) and persists the last 3 sessions to `localStorage` (`selene.sessions.v1`), viewable via the **Session report** page.
- **Soft-keyboard bridge** (`SeleneNative`) — a minimal `@JavascriptInterface` (`showKeyboard`/`hideKeyboard`) exposed by `MainActivity.kt`'s `KeyboardBridge`, invoked from `selene-inject.js` on focus/blur of editable HTML fields. Needed because Android TV suppresses the IME when a game controller is connected. **Known limitation**: in-game text entry (inside the streamed video itself) has no HTML `<input>` for the bridge to hook, so it cannot help there.
- **Force standard mapping** toggle — relabels the reported gamepad as the W3C "standard" mapping so Luna accepts D-input (non-XInput) controllers it would otherwise ignore.
- **UA Client Hints spoof** — in addition to the desktop Chrome UA string, `navigator.userAgentData` (`platform`, `mobile`, brands, prototype) is overridden to report Windows, clearing Luna's "unsupported OS" gate which checks Client Hints separately from the UA string.
- **Console-to-logcat bridge** — `WebChromeClient.onConsoleMessage` in `MainActivity.kt` forwards WebView console output to Android `Log.i` under tag `SeleneWeb`, so `selene-inject.js` logging is visible in release builds via `adb logcat`.

## Module / package layout
```
_run `tree -L 2 -I node_modules` and paste here_
```

## External dependencies & boundaries
- _to be filled in_

## Cross-cutting concerns (auth, logging, errors, config)
- _to be filled in_

---

## Decision Log (ADR-lite)

Format: `YYYY-MM-DD — Decision — Because …`

<!-- scribe-adr-start -->
- 2026-08-20 — Gate whole-page zoom on frame-flow-detected streaming, not peer existence — Because CSS zoom during an active stream stalled the video decode pipeline; a peer can exist without frames flowing yet
- 2026-08-20 — Added `SeleneNative` JavascriptInterface for soft-keyboard show/hide — Because Android TV suppresses the IME entirely when a game controller is connected, blocking text entry in HTML fields
- 2026-08-20 — Spoof `navigator.userAgentData` alongside the UA string — Because Luna's "unsupported OS" check reads Client Hints independently of the legacy UA string
<!-- scribe-adr-end -->
