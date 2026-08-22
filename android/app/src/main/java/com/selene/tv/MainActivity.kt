package com.selene.tv

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
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

    // Fullscreen-video state (WebChromeClient custom view).
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    // Reads as desktop Chrome, which Luna officially supports.
    private val desktopUa =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

    private val lunaUrl = "https://luna.amazon.com"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        // Pan the view up for the soft keyboard so the focused field stays visible.
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN)
        goImmersive()

        web = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                userAgentString = desktopUa
                // WebRTC needs these; Luna streams over it.
                setSupportMultipleWindows(false)
                // Let Luna's own responsive layout size to the display, and pin
                // textZoom so the TV's system font scale can't inflate the UI.
                // Fine UI sizing is done in-page by Selene's zoom control.
                useWideViewPort = true
                loadWithOverviewMode = true
                textZoom = 100
            }

            // Android TV suppresses the soft keyboard while a game controller is
            // connected (assumes you'll type on "hardware"). selene-inject.js
            // calls this bridge on text-field focus to force the IME up.
            isFocusableInTouchMode = true
            addJavascriptInterface(KeyboardBridge(), "SeleneNative")

            webViewClient = object : WebViewClient() {
                // keep all navigation inside the app
                override fun shouldOverrideUrlLoading(v: WebView, url: String) = false
            }

            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    // Grant protected media (DRM) and any A/V capture Luna asks for.
                    request.grant(request.resources)
                }

                // Route Selene's own console logs (and page errors) to logcat so
                // they're visible in release builds. Tag: SeleneWeb.
                override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                    val msg = m.message()
                    if (msg.startsWith("[SELENE]") ||
                        m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                        Log.i("SeleneWeb", "$msg (${m.sourceId()}:${m.lineNumber()})")
                    }
                    return true
                }

                // Fullscreen video: selene-inject.js calls the Fullscreen API on the
                // <video>; Chromium then hands us its native surface here. Hosting it
                // directly (WebView hidden underneath) lets it land on a hardware
                // overlay plane instead of being GPU-composited inside the page —
                // the fix for decode back-pressure/freezes. Web overlays (HUD/panel)
                // are hidden while this is active; exit with Back.
                override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                    if (customView != null) { callback.onCustomViewHidden(); return }
                    customView = view
                    customViewCallback = callback
                    // Do NOT hide the WebView (View.GONE). A hidden WebView is
                    // treated as a background page and Chromium throttles its JS
                    // timers to ~1Hz — which throttles Luna's controller polling
                    // and sending, causing severe input lag. Keep it VISIBLE
                    // (occluded by the opaque video overlay on top) so input
                    // stays at full rate; the video plays on the hardware overlay.
                    (window.decorView as ViewGroup).addView(view, ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
                    goImmersive()
                    Log.i("SeleneWeb", "[native] onShowCustomView (fullscreen video)")
                }

                override fun onHideCustomView() {
                    val v = customView ?: return
                    (window.decorView as ViewGroup).removeView(v)
                    customView = null
                    customViewCallback?.onCustomViewHidden()
                    customViewCallback = null
                    goImmersive()
                    Log.i("SeleneWeb", "[native] onHideCustomView")
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

    // Back button: exit fullscreen video first, else navigate web history.
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (customView != null) {
                // Exit via the Fullscreen API so Chromium fires onHideCustomView
                // and cleans up its own state consistently.
                web.evaluateJavascript("document.exitFullscreen && document.exitFullscreen();", null)
                return true
            }
            if (web.canGoBack()) {
                web.goBack()
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) goImmersive()
    }

    /**
     * JS bridge so the injected shim can force the soft keyboard up/down. Android
     * TV hides the IME when a controller is connected; SHOW_FORCED overrides that.
     * Only these two annotated methods are exposed to page JS.
     */
    inner class KeyboardBridge {
        @JavascriptInterface
        fun showKeyboard() {
            runOnUiThread {
                val focused = web.requestFocus()
                val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                @Suppress("DEPRECATION")
                val shown = imm.showSoftInput(web, InputMethodManager.SHOW_FORCED)
                Log.i("SeleneWeb", "[native] showKeyboard: requestFocus=$focused showSoftInput=$shown")
            }
        }

        @JavascriptInterface
        fun hideKeyboard() {
            runOnUiThread {
                val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                imm.hideSoftInputFromWindow(web.windowToken, 0)
            }
        }
    }
}
