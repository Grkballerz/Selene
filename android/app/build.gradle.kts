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

    // A committed, fixed keystore so every build — local or CI — signs with the
    // SAME certificate. Without this, CI's per-run debug key changes each build
    // and the APK can't update the installed app in place (signature mismatch),
    // forcing an uninstall that wipes saved settings. Password is the standard
    // Android debug convention ("android"): a signing-consistency key, not a
    // secret. For Play Store distribution, swap in a real release key from CI
    // secrets — never commit that one.
    signingConfigs {
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
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
