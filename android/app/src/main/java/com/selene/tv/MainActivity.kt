package com.selene.tv

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * SELENE — Luna, unlocked for unsupported Android/Google TV devices.
 *
 * The whole trick lives here:
 *   1. Desktop Chrome user-agent  -> Luna serves the supported code path.
 *   2. addDocumentStartJavaScript -> our shim runs BEFORE Luna's scripts,
 *      so the capability gate is already answered "yes" when Luna checks.
 *   3. onPermissionRequest grants PROTECTED_MEDIA_ID so Widevine/DRM works.
 * Everything else (stats HUD, deadzone) is inside selene-inject.js.
 */
class MainActivity : ComponentActivity() {

    private lateinit var web: WebView

    // Reads as desktop Chrome, which Luna officially supports.
    private val desktopUa =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

    private val lunaUrl = "https://luna.amazon.com"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        goImmersive()

        web = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                userAgentString = desktopUa
                // WebRTC needs these; Luna streams over it.
                setSupportMultipleWindows(false)
                // Desktop web apps default to a ~980px layout in a TV WebView,
                // which the big screen magnifies. Wide-viewport + overview mode
                // lets Selene's injected viewport width lay out at desktop
                // density and scale to fit; textZoom is pinned so the TV's
                // system font scale can't re-inflate everything.
                useWideViewPort = true
                loadWithOverviewMode = true
                textZoom = 100
            }

            webViewClient = object : WebViewClient() {
                // keep all navigation inside the app
                override fun shouldOverrideUrlLoading(v: WebView, url: String) = false
            }

            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    // Grant protected media (DRM) and any A/V capture Luna asks for.
                    request.grant(request.resources)
                }
            }
        }

        injectShimAtDocumentStart(web)
        setContentView(web)
        web.loadUrl(lunaUrl)
    }

    /**
     * Injects selene-inject.js (from assets) so it executes before every page's
     * own scripts. Requires WebView 105+; androidx.webkit gates the feature.
     */
    private fun injectShimAtDocumentStart(v: WebView) {
        val js = runCatching {
            assets.open("selene-inject.js").bufferedReader().use { it.readText() }
        }.getOrNull() ?: return

        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(v, js, setOf("*"))
        } else {
            // Fallback for old WebView: inject on page start (a bit late, but works
            // for most gate checks). Prompt user to update Android System WebView.
            v.webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                    view.evaluateJavascript(js, null)
                }
                override fun shouldOverrideUrlLoading(view: WebView, url: String) = false
            }
        }
    }

    private fun goImmersive() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
    }

    // Let the D-pad BACK button navigate web history before exiting.
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && web.canGoBack()) {
            web.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) goImmersive()
    }
}
