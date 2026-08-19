<h1 align="center">🌙 SELENE</h1>
<p align="center"><em>Amazon Luna, unlocked for unsupported Android & Google TV devices.</em></p>

---

Amazon Luna officially runs on Fire TV, Samsung, and LG — but **not** on the
Google TV Streamer, Chromecast with Google TV, NVIDIA Shield, or Walmart Onn
boxes. On those, Luna's web player throws **"low latency video unsupported"**
and refuses to play, because the capability probes that pass on a Fire TV
return `false` in an unsupported TV WebView — even though the decoder is the
same silicon.

Selene is a thin WebView wrapper (plus an injected script) that answers those
probes correctly, so Luna runs on the devices Amazon left out. It also adds a
**live WebRTC stats overlay** and **controller deadzone tuning** — things Luna
itself has never offered.

Inspired by [Better xCloud](https://github.com/redphx/better-xcloud), which
does the same job for Xbox Cloud Gaming.

## What it does

Everything below is configured from an **in-stream settings panel** — no
editing source, no rebuilding. Settings persist in `localStorage`.

- **Clears the low-latency gate** — spoofs `mediaCapabilities.decodingInfo`,
  `MediaSource.isTypeSupported`, and `canPlayType` so Luna serves the playable
  path. Combined with a desktop-Chrome user-agent (Luna's supported browser).
- **Configurable stats HUD** — fps, bitrate, RTT, dropped frames, packet loss,
  jitter, resolution, codec. Pick which metrics show, the corner, and opacity.
  Color-coded thresholds.
- **Controller** — radial stick **deadzone**, **vibration** intensity (0–100%),
  and full **button remapping** with a press-to-bind flow.
- **Streaming quality** — **preferred codec** (Auto / H.264 / H.265 / AV1) and
  a **max-bitrate** cap, applied by rewriting the WebRTC SDP.
- **Video** — a **clarity/sharpen** filter (SVG convolution) and **saturation**,
  applied live to the stream.

### Controls

| Action | Controller | Browser |
|---|---|---|
| Open / close settings | **View + Menu** (together) | **`** (backtick) |
| Navigate | **D-pad** | **arrow keys** |
| Adjust slider / cycle | **D-pad ← →** | **← →** |
| Select / toggle | **A** | **Enter** |
| Back / close | **B** | **Esc** |
| Quick-toggle HUD | (menu item) | **H** |

While the panel is open, controller input is withheld from Luna so the game
doesn't react underneath you.

### Live vs. reconnect

Most settings apply instantly (HUD, deadzone, vibration, clarity, saturation,
and the gate/codec toggles on the next stream start). **Preferred codec** and
**max bitrate** only take effect on the **next stream / reconnect**, because
they change the WebRTC negotiation that already happened. Max bitrate is a
*request* — the server may or may not honor it. Forcing **H.265 / AV1** only
works if Luna offers it and your device can decode it; otherwise you'll get a
black screen, so leave codec on **Auto** unless you know your hardware.

## ⚠️ Scope & boundaries

- **Unofficial.** Not affiliated with, endorsed by, or connected to Amazon.
  "Amazon Luna" is a trademark of Amazon.
- **For paying subscribers.** Selene is an *enhancement layer* for people with
  an active Prime / Luna+ entitlement. It does **not** bypass authentication,
  DRM, paywalls, or geographic restrictions, and it never will. Don't send PRs
  that do.
- **The gate unlock is best-effort.** You're overriding checks on top of
  Amazon's own client. When Amazon changes their web player it may break, and
  you'll need to re-patch the shim. That's expected — same as any userscript.
- **Black screen instead of an error?** The codec unlock is claiming support
  the device genuinely can't decode. Open settings → Playback Unlock → turn
  **Force codec support** off (or set codec back to Auto), then check the
  console log for which codec Luna requested.

## Install (end users)

Sideload the APK onto your Google TV / Android TV device:

1. Install **Downloader** (by AFTVnews) from the Play Store.
2. Enable dev mode: Settings → System → About → tap **Android TV OS build**
   ~7 times until "You are now a developer!" appears.
3. Settings → Apps → Security → allow **Downloader** to install unknown apps.
4. In Downloader, enter the release URL for `selene-debug.apk` (from this
   repo's **Releases**) and install.
5. Launch **Selene** from the home screen, sign into Luna, pair a Bluetooth
   controller in Settings → Remotes & Accessories.

**For best results:** use **Ethernet** (the Streamer has a port), turn on your
TV's **Game Mode**, and don't run Bluetooth headphones at the same time.

## Build from source

The project is complete — icon, TV banner, theme, and Gradle wiring are all
included. Two ways to build:

**Android Studio (easiest).** Open the `android/` folder. Studio generates the
Gradle wrapper on import, then Run or Build → Build APK.

**Command line.** You need JDK 17 and Gradle 8.7 (or let the wrapper handle it):

```bash
git clone https://github.com/Grkballerz/Selene.git
cd Selene/android
gradle wrapper        # one-time: creates ./gradlew  (skip if Studio made it)
./gradlew assembleDebug
# APK -> app/build/outputs/apk/debug/app-debug.apk
```

Every push to `main` also builds the APK via GitHub Actions and attaches it to
the **latest** release — see `.github/workflows/build.yml`. The wrapper jar is
intentionally not committed; CI provisions Gradle directly.

To rebrand the icon and banner, regenerate them or drop your own PNGs into
`app/src/main/res/mipmap-*/ic_launcher.png` and
`app/src/main/res/drawable/banner.png` (banner must be **320×180**).

## Browser bonus

`selene-inject.js` doubles as a **Tampermonkey userscript**. Install it in
desktop Chrome/Edge and it applies the same unlock + stats HUD at
`luna.amazon.com` — no APK needed. (User-agent is already desktop in a real
browser, so only the JS shims matter there.)

## Rename it

Everything keys off one constant. To rebrand from "Selene":

- `selene-inject.js` → the `APP` constant near the top
- `AndroidManifest.xml` → `android:label`
- package dir `com/selene/tv` + `namespace` / `applicationId` in Gradle

## License

MIT — see [LICENSE](LICENSE). Do not relicense in a way that implies Amazon
endorsement.
