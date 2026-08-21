# Glossary

> Domain terms — user-facing names, internal names, what they mean.
> The scribe adds new terms as they appear in commits, but you own the canonical wording.

| Term | Definition | Aliases |
|---|---|---|
<!-- scribe-glossary-start -->
| Menu chord | The rebindable set of physical controller button indices (`S.menuChord`) that, held together, opens the Selene settings overlay | — |
| Controller test | Settings-overlay page showing a live readout of controller button/axis state and key events, for debugging pad mapping | — |
| Force standard mapping | Toggle that relabels the reported gamepad as the W3C "standard" mapping so Luna accepts D-input controllers | — |
| Stats HUD | On-screen overlay showing live WebRTC stream metrics (fps, bitrate, rtt, dropped frames, loss, jitter, codec, decode time, freezes) | — |
| Session recorder | Background loop that samples `RTCPeerConnection.getStats()` every second during a stream and stores a per-session summary to `localStorage` | — |
| Session report | Settings-overlay page listing the last 3 recorded session summaries (rtt/jitter/decode/fps/loss/freezes, incl. freezes-per-minute) | — |
| `isStreaming()` / streamActive | Internal flag, true only while WebRTC video frames are actively decoding (not just when a peer connection exists) | frame-flow detection |
| `SeleneNative` | The `@JavascriptInterface` bridge (`showKeyboard`/`hideKeyboard`) exposed by `MainActivity.kt` for forcing the Android TV soft keyboard from JS | soft-keyboard bridge |
<!-- scribe-glossary-end -->
