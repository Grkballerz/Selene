# Preferences

> Your tooling choices. The onboarder writes this once; refine via `/ucw prefs`.
> Skills read these keys before they ever ask you which tool to use.

## Environment

| Key | Value |
|---|---|
| `package_manager` | Gradle 8.7 |
| `runtime` | Android WebView (TV/leanback, minSdk 24, targetSdk/compileSdk 34), browser userscript (Tampermonkey) |
| `linter` | _(none detected)_ |
| `typechecker` | _(none detected)_ |
| `test_runner` | _(none detected)_ |
| `formatter` | _(none detected)_ |

## Generation tools

| Key | Value |
|---|---|
| `image_gen_tool` | Stable Diffusion local (ComfyUI) |
| `video_gen_tool` | _(not set — JIT prompt on first use)_ |
| `svg_tool` | _(not set — JIT prompt on first use)_ |
| `audio_tool` | _(not set — JIT prompt on first use)_ |
| `diagram_tool` | Mermaid |

## Infrastructure

| Key | Value |
|---|---|
| `database` | none |
| `deploy_target` | GitHub Releases via GitHub Actions |
| `browser_automation` | _(not set — JIT prompt on first use)_ |

## UCW

| Key | Value |
|---|---|
| `docs_surface` | Plain `.ucw/knowledge/` |
| `embedding_provider` | Claude Haiku reranking (no Voyage key) |
| `scribe_mode` | auto |
| `notification_channel` | desktop only |

---
_Set via `/ucw init` on 2026-08-19. Update any subset via `/ucw prefs <category>`._
