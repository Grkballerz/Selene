# Design

> Architecture overview + lightweight ADR log. The scribe appends entries on
> architectural shifts; structural rewrites pause for your OK.

## What this project does
Selene: a thin Android/Google TV WebView wrapper (Kotlin) plus an injected JS shim (selene-inject.js, doubling as a Tampermonkey userscript) that unlocks Amazon Luna cloud gaming on unsupported devices (Google TV Streamer, Chromecast with Google TV, NVIDIA Shield, Walmart Onn) by spoofing a desktop Chrome UA and answering Luna's low-latency capability probes correctly. Also adds a WebRTC stats HUD and controller deadzone/remap tuning. Unofficial, does not bypass auth/DRM/paywalls.

## Key abstractions
- _to be filled in by scribe as code lands_

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
<!-- scribe-adr-end -->
