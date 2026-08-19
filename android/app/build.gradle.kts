plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.selene.tv"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.selene.tv"
        minSdk = 24          // DOCUMENT_START_SCRIPT needs WebView 105+ at runtime
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
    }

    // Two-tier signing, both deterministic so APKs update in place instead of
    // forcing an uninstall:
    //  - debug: a committed, non-secret keystore (password is the standard
    //    Android debug convention) used for local dev and as a fallback.
    //  - release: a real key that lives ONLY in CI secrets, decoded to
    //    release.keystore at build time and read from env vars here. Never
    //    committed. If the secrets are absent (e.g. a local `assembleRelease`),
    //    release falls back to the debug key so the build still produces an
    //    installable APK.
    val relStoreFile = System.getenv("SIGNING_KEYSTORE_FILE") ?: "release.keystore"
    val relStorePw = System.getenv("SIGNING_KEYSTORE_PASSWORD")
    val relAlias = System.getenv("SIGNING_KEY_ALIAS")
    val relKeyPw = System.getenv("SIGNING_KEY_PASSWORD")
    val hasReleaseSigning = relStorePw != null && relAlias != null &&
        relKeyPw != null && file(relStoreFile).exists()

    signingConfigs {
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(relStoreFile)
                storePassword = relStorePw
                keyAlias = relAlias
                keyPassword = relKeyPw
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName(if (hasReleaseSigning) "release" else "debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.2")
    // The key dependency: enables addDocumentStartJavaScript().
    implementation("androidx.webkit:webkit:1.11.0")
}

// selene-inject.js lives at the repo root (it doubles as a Tampermonkey
// userscript) — sync it into assets at build time so there is exactly one
// canonical copy. The synced file is gitignored.
val syncInjectScript = tasks.register<Copy>("syncInjectScript") {
    from(rootProject.projectDir.resolve("../selene-inject.js"))
    into(layout.projectDirectory.dir("src/main/assets"))
}
tasks.named("preBuild") { dependsOn(syncInjectScript) }
