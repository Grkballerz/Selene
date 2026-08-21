# Conventions

> How we write code in this project. Auto-seeded from config files; refined by
> the scribe as patterns emerge in review.

## Naming
- _to be filled in as patterns emerge_

## File / directory layout rules
- _to be filled in as patterns emerge_

## Test patterns
- _to be filled in_

## Error handling
- _to be filled in_

## Logging
- `selene-inject.js` logs via `console.*`; `MainActivity.kt`'s `WebChromeClient.onConsoleMessage` mirrors these to Android `Log.i` under tag `SeleneWeb` so they're visible in `adb logcat` for release builds (no debug-only console)

## Imports / module boundaries
- _to be filled in_

## Comments policy
- default to no comments; add only when WHY is non-obvious

## Commit message style
- _to be filled in — scribe will infer from recent commits_
