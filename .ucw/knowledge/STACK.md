# Stack

> What this project is built on. Maintained by the UCW scribe; safe to hand-edit.

## Languages & runtimes
- Kotlin
- JavaScript

## Frameworks
- Android SDK
- androidx.webkit (WebViewCompat / addDocumentStartJavaScript)
- AndroidX core-ktx
- AndroidX activity-ktx

## Package manager
- Gradle 8.7

## Build / task tools
- Gradle 8.7 (Kotlin DSL, build.gradle.kts)
- JDK 17
- Android Gradle Plugin (com.android.application)
- Kotlin Android plugin

## Test framework
- _(none detected)_

## Lint / format
- _(none detected)_

## Key libraries
- androidx.core:core-ktx:1.13.1
- androidx.activity:activity-ktx:1.9.2
- androidx.webkit:webkit:1.11.0

## Infra / deploy
- GitHub Releases via GitHub Actions
- APK signing: committed non-secret `debug.keystore` for local builds; CI-secret release keystore (`SIGNING_KEYSTORE_FILE` env var + related secrets) for release builds — same signing identity across releases enables stable in-place APK updates on device

## Datastores
- none

---
_Detected from: README.md, build.gradle.kts, AndroidManifest.xml, MainActivity.kt, build.yml, selene-inject.js on 2026-08-20_
