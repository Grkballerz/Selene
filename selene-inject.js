// ==UserScript==
// @name         SELENE — Luna unlocked for unsupported TVs
// @namespace    https://github.com/Grkballerz/Selene
// @version      0.4.0
// @description  Unlocks Amazon Luna on unsupported Android/Google TV devices with a polished, D-pad-navigable overlay: stats HUD with telemetry, controller remap/deadzone/vibration, codec + bitrate control, and clarity filter.
// @match        https://luna.amazon.com/*
// @match        https://*.luna.amazon.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// One file, two homes: injected by the Android wrapper via
// addDocumentStartJavaScript() AND usable as a Tampermonkey userscript.
// Must run before Luna's own scripts (handled by both loaders).
//
// Open settings:  hold View + Menu on the controller, or press ` in a browser.
// Navigate: D-pad / arrows.  Adjust: left/right.  Select: A / Enter.
// Back / close: B / Esc.     Quick HUD toggle: H.

(function () {
  "use strict";

  const APP = "SELENE";
  const log = (...a) => console.log(`[${APP}]`, ...a);

  // Lunar palette (also mirrored in CSS tokens below)
  const GOOD = "#6ee7a8", WARN = "#f5c451", BAD = "#fb7185";

  // The crescent: brand mark, selection marker, and HUD indicator — one motif.
  const CRESCENT =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  const ICONS = {
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 2 5 13h6l-1 9 8-11h-6z"/></svg>',
    activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-7 4 14 2.5-7H21"/></svg>',
    pad: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M9 9h6a5 5 0 0 1 5 5 2.5 2.5 0 0 1-4.6 1.4L14.5 14h-5l-.9 1.4A2.5 2.5 0 0 1 4 14a5 5 0 0 1 5-5z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M7.5 11.4v2.2M6.4 12.5h2.2"/><circle cx="16" cy="11.8" r="1" fill="currentColor"/><circle cx="17.3" cy="13.4" r="1" fill="currentColor"/></svg>',
    signal: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M5 12.5a7 7 0 0 1 14 0M8 13a4 4 0 0 1 8 0"/><circle cx="12" cy="14" r="1.4" fill="currentColor"/></svg>',
    contrast: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>',
    monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path stroke-linecap="round" d="M8.5 20h7M12 16.5V20"/></svg>',
  };
  const ico = (n) => ICONS[n] || "";

  // ========================================================================
  // SETTINGS  (defaults merged with whatever is saved in localStorage)
  // ========================================================================
  const DEFAULTS = {
    unlockGate: true,
    forceCodecSupport: true,
    hudEnabled: false,
    hudPosition: "top-left",
    hudOpacity: 92,
    hudMetrics: {
      res: true, fps: true, bitrate: true, rtt: true,
      dropped: true, loss: true, jitter: true, codec: true,
    },
    deadzone: 12,
    vibration: 100,
    remap: {},
    preferredCodec: "auto",
    maxBitrateMbps: 0,
    clarity: 0,
    saturation: 100,
    uiWidth: 1920, // logical viewport width; larger = smaller-looking UI
  };

  const STORE_KEY = "selene.settings.v1";
  let S = loadSettings();

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      return {
        ...DEFAULTS, ...saved,
        hudMetrics: { ...DEFAULTS.hudMetrics, ...(saved.hudMetrics || {}) },
        remap: { ...(saved.remap || {}) },
      };
    } catch (e) { return { ...DEFAULTS }; }
  }
  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
  }
  function resetSettings() {
    S = { ...DEFAULTS, hudMetrics: { ...DEFAULTS.hudMetrics }, remap: {} };
    saveSettings(); applyAll();
  }
  function applyAll() { applyHudStyle(); applyVideoFilter(); applyViewport(); }

  // ========================================================================
  // VIEWPORT — desktop web apps default to a ~980px layout in a TV WebView,
  // which the big screen then magnifies ("everything too big"). Force a wide
  // logical viewport so Luna lays out at desktop density and the WebView
  // scales it down to fit. Tunable via Settings -> Display -> UI size.
  // ========================================================================
  function applyViewport() {
    try {
      document.querySelectorAll('meta[name="viewport"]').forEach((el) => {
        if (el.id !== "selene-vp") el.remove();
      });
      let m = document.getElementById("selene-vp");
      if (!m) {
        m = document.createElement("meta");
        m.name = "viewport"; m.id = "selene-vp";
        (document.head || document.documentElement).appendChild(m);
      }
      m.setAttribute("content", `width=${S.uiWidth}`);
    } catch (e) { log("viewport apply failed", e); }
  }

  // ========================================================================
  // STYLES — the lunar design system, injected as a scoped stylesheet
  // ========================================================================
  const CSS = `
.sel-scope{
  --text:#eef0f8; --muted:#8b93ab; --faint:#6b7488;
  --accent:#b8c0ff; --dim:rgba(184,192,255,.16); --line:rgba(180,190,240,.10);
  --good:#6ee7a8; --warn:#f5c451; --bad:#fb7185; --surface-2:#1a1d2b;
  font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
}
#selene-panel *{box-sizing:border-box}

#selene-panel{
  position:fixed;inset:0;z-index:2147483600;display:none;
  align-items:center;justify-content:center;
  background:rgba(5,6,12,.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
  animation:sel-ov .18s ease-out;
}
@keyframes sel-ov{from{opacity:0}to{opacity:1}}

.sel-card{
  position:relative;width:min(548px,94vw);max-height:88vh;
  border-radius:20px;display:flex;flex-direction:column;overflow:hidden;
  background:linear-gradient(180deg,#141726 0%,#0d0f18 62%);
  border:1px solid var(--line);
  box-shadow:0 30px 90px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05);
  animation:sel-card .22s cubic-bezier(.2,.8,.2,1);
}
@keyframes sel-card{from{opacity:0;transform:translateY(10px) scale(.965)}to{opacity:1;transform:none}}
.sel-card::before{
  content:"";position:absolute;top:-46%;left:50%;transform:translateX(-50%);
  width:72%;height:170px;border-radius:50%;pointer-events:none;
  background:radial-gradient(closest-side,rgba(184,192,255,.16),transparent);
}

.sel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px 12px;position:relative}
.sel-brand{display:flex;align-items:center;gap:10px}
.sel-brand .sel-cr{width:22px;height:22px;color:var(--accent);flex:none;filter:drop-shadow(0 0 7px rgba(184,192,255,.55))}
.sel-word{font-size:15px;font-weight:600;letter-spacing:.34em;color:#fff;padding-left:.34em}
.sel-sub{font-size:11px;color:var(--muted);margin-top:3px}
.sel-hints{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.sel-cap{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--muted)}
.sel-key{min-width:20px;text-align:center;padding:2px 6px;border-radius:6px;
  background:var(--surface-2);border:1px solid var(--line);color:var(--text);
  font-size:10.5px;font-weight:600;line-height:1.2;font-variant-numeric:tabular-nums}
.sel-rule{height:1px;margin:0 18px;background:linear-gradient(90deg,transparent,var(--dim) 18%,var(--dim) 82%,transparent)}

.sel-body{overflow-y:auto;padding:6px 10px 14px;scrollbar-width:thin;scrollbar-color:rgba(184,192,255,.32) transparent}
.sel-body::-webkit-scrollbar{width:9px}
.sel-body::-webkit-scrollbar-thumb{background:rgba(184,192,255,.26);border-radius:9px;border:2px solid transparent;background-clip:content-box}
.sel-body::-webkit-scrollbar-track{background:transparent}

.sel-sec{display:flex;align-items:center;gap:9px;padding:15px 12px 6px}
.sel-ic{width:15px;height:15px;color:var(--accent);flex:none;display:flex}
.sel-ic svg{width:15px;height:15px}
.sel-eye{font-size:10.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);opacity:.92;white-space:nowrap}
.sel-secrule{flex:1;height:1px;background:var(--line)}

.sel-row{display:flex;align-items:center;gap:11px;padding:8px 9px 8px 5px;border-radius:11px;margin:1px 4px;position:relative;transition:background .13s ease,box-shadow .13s ease}
.sel-mk{width:15px;flex:none;color:var(--accent);display:flex;align-items:center;justify-content:center;opacity:0;transform:scale(.55) translateX(-3px);transition:opacity .14s,transform .14s}
.sel-mk svg{width:14px;height:14px;filter:drop-shadow(0 0 6px rgba(184,192,255,.75))}
.sel-row.on{background:rgba(184,192,255,.11);box-shadow:inset 0 0 0 1px rgba(184,192,255,.34)}
.sel-row.on .sel-mk{opacity:1;transform:none}
.sel-lbl{flex:1;color:#d6dae6;font-size:13.5px}
.sel-row.on .sel-lbl{color:#fff}
.sel-note{color:var(--faint);font-size:10.5px;margin-left:8px}
.sel-ctl{display:flex;align-items:center;gap:10px;flex:none}

.sel-sw{width:40px;height:22px;border-radius:999px;background:#2a2e3f;border:1px solid var(--line);position:relative;transition:background .16s}
.sel-sw.y{background:linear-gradient(90deg,#7c86e0,#b8c0ff);border-color:transparent}
.sel-kn{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#e9ebf5;box-shadow:0 1px 3px rgba(0,0,0,.4);transition:left .16s cubic-bezier(.3,1.4,.5,1)}
.sel-sw.y .sel-kn{left:20px}

.sel-sl{display:flex;align-items:center;gap:10px}
.sel-tr{width:104px;height:6px;border-radius:999px;background:#262a3a;position:relative;box-shadow:inset 0 1px 2px rgba(0,0,0,.45)}
.sel-fl{position:absolute;left:0;top:0;height:6px;border-radius:999px;background:linear-gradient(90deg,#7c86e0,#b8c0ff);box-shadow:0 0 8px rgba(184,192,255,.5);transition:width .12s ease}
.sel-kns{position:absolute;top:50%;width:12px;height:12px;border-radius:50%;background:#eef0f8;transform:translate(-50%,-50%);box-shadow:0 1px 3px rgba(0,0,0,.5);transition:left .12s ease}
.sel-vl{min-width:60px;text-align:right;font:12px ui-monospace,monospace;color:var(--text);font-variant-numeric:tabular-nums}

.sel-cy{display:flex;align-items:center;gap:8px}
.sel-ch{color:var(--muted);font-size:16px;line-height:1}
.sel-row.on .sel-ch{color:var(--accent)}
.sel-cv{min-width:72px;text-align:center;color:var(--accent);font-size:13px;font-weight:500}

.sel-chip{font:12px ui-monospace,monospace;color:var(--muted);padding:3px 9px;border-radius:7px;background:var(--surface-2);border:1px solid var(--line);font-variant-numeric:tabular-nums}
.sel-chip.a{color:var(--accent);border-color:rgba(184,192,255,.4)}

.sel-capov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(6,8,16,.86);backdrop-filter:blur(2px);border-radius:20px;animation:sel-ov .14s}
.sel-capm{width:42px;height:42px;color:var(--accent);margin:0 auto 12px;filter:drop-shadow(0 0 13px rgba(184,192,255,.6));animation:sel-pulse 1.6s ease-in-out infinite}
@keyframes sel-pulse{0%,100%{opacity:.72;transform:scale(1)}50%{opacity:1;transform:scale(1.09)}}
.sel-capt{color:#fff;font-size:17px;font-weight:600;margin-bottom:6px;text-align:center}
.sel-caps{color:var(--muted);font-size:12.5px;text-align:center}

#selene-hud{position:fixed;z-index:2147483000;display:none;min-width:192px;border-radius:12px;overflow:hidden;pointer-events:none;
  background:linear-gradient(180deg,rgba(18,20,31,.94),rgba(11,13,20,.94));border:1px solid var(--line);
  box-shadow:0 8px 30px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.04)}
.sel-hh{display:flex;align-items:center;gap:7px;padding:7px 11px;border-bottom:1px solid var(--line);background:rgba(184,192,255,.05)}
.sel-hh .sel-cr{width:13px;height:13px;color:var(--accent);flex:none}
.sel-hn{font-size:10px;font-weight:600;letter-spacing:.22em;color:#eef0f8;padding-left:.22em;flex:1}
.sel-hd{width:7px;height:7px;border-radius:50%;flex:none;box-shadow:0 0 6px currentColor}
.sel-hg{padding:9px 11px 5px;font:11.5px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.sel-hr{display:flex;justify-content:space-between;gap:14px;padding:1.5px 0;line-height:1.55}
.sel-hk{color:#7f889e}
.sel-hv{font-variant-numeric:tabular-nums}
.sel-sp{display:flex;gap:12px;padding:2px 11px 10px}
.sel-spc{flex:1;min-width:0}
.sel-spl{font:9px ui-monospace,monospace;color:var(--faint);letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px}
.sel-spg{width:100%;height:20px;display:block}
.sel-spg polyline{filter:drop-shadow(0 0 3px rgba(184,192,255,.45))}

.selene-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:9px;
  padding:10px 16px 10px 13px;border-radius:999px;pointer-events:none;color:var(--text);font-size:12.5px;
  background:linear-gradient(180deg,rgba(18,20,31,.96),rgba(11,13,20,.96));border:1px solid var(--line);
  box-shadow:0 8px 30px rgba(0,0,0,.5);animation:sel-tin .4s cubic-bezier(.2,.8,.2,1)}
.selene-toast .sel-cr{width:15px;height:15px;color:var(--accent);flex:none;filter:drop-shadow(0 0 5px rgba(184,192,255,.5))}
@keyframes sel-tin{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
.selene-toast.out{opacity:0;transform:translate(-50%,8px);transition:all .5s}

@media (prefers-reduced-motion:reduce){
  #selene-panel,.sel-card,.sel-capov,.sel-capm,.selene-toast,.sel-kn,.sel-fl,.sel-kns,.sel-row,.sel-sw,.sel-mk{animation:none!important;transition:none!important}
}`;
  function injectStyles() {
    if (document.getElementById("selene-styles")) return;
    const st = document.createElement("style");
    st.id = "selene-styles";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  // ========================================================================
  // 0. PLATFORM SPOOF — Luna reads UA Client Hints, not just the UA string.
  //    In an Android WebView, navigator.userAgentData.platform stays
  //    "Android" even under a desktop user-agent, so Luna reports an
  //    "unsupported OS". Present a Windows-desktop identity through the UA-CH
  //    surface Luna actually queries (getHighEntropyValues). No-op in a real
  //    desktop browser, where these already read Windows.
  // ========================================================================
  try {
    const uaBrands = [
      { brand: "Chromium", version: "122" },
      { brand: "Not(A:Brand", version: "24" },
      { brand: "Google Chrome", version: "122" },
    ];
    const uaFull = [
      { brand: "Chromium", version: "122.0.6261.94" },
      { brand: "Not(A:Brand", version: "24.0.0.0" },
      { brand: "Google Chrome", version: "122.0.6261.94" },
    ];
    const highEntropy = {
      architecture: "x86", bitness: "64", brands: uaBrands,
      fullVersionList: uaFull, mobile: false, model: "",
      platform: "Windows", platformVersion: "15.0.0",
      uaFullVersion: "122.0.6261.94", wow64: false,
    };
    const fakeUA = {
      brands: uaBrands, mobile: false, platform: "Windows",
      getHighEntropyValues(hints) {
        const out = { brands: uaBrands, mobile: false, platform: "Windows" };
        if (Array.isArray(hints)) for (const h of hints) if (h in highEntropy) out[h] = highEntropy[h];
        return Promise.resolve(out);
      },
      toJSON() { return { brands: uaBrands, mobile: false, platform: "Windows" }; },
    };
    try {
      Object.defineProperty(navigator, "userAgentData", { value: fakeUA, configurable: true, enumerable: true });
    } catch (e1) {
      // Some WebViews expose it as a non-configurable proto accessor; patch that.
      const p = navigator.userAgentData && Object.getPrototypeOf(navigator.userAgentData);
      if (p) {
        try { Object.defineProperty(p, "platform", { get: () => "Windows", configurable: true }); } catch (e) {}
        try { Object.defineProperty(p, "mobile", { get: () => false, configurable: true }); } catch (e) {}
        try { p.getHighEntropyValues = fakeUA.getHighEntropyValues; } catch (e) {}
      }
    }
    // Classic surface some checks still read.
    try { Object.defineProperty(navigator, "platform", { get: () => "Win32", configurable: true }); } catch (e) {}
  } catch (e) { log("UA-CH spoof failed", e); }

  // ========================================================================
  // 1. PLAYBACK UNLOCK  (installed once; behaviour reads S live)
  // ========================================================================
  try {
    if (navigator.mediaCapabilities && navigator.mediaCapabilities.decodingInfo) {
      const orig = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
      navigator.mediaCapabilities.decodingInfo = async function (cfg) {
        if (!S.unlockGate) return orig(cfg);
        try {
          const r = await orig(cfg);
          return { ...r, supported: true, smooth: true, powerEfficient: true };
        } catch (e) {
          return { supported: true, smooth: true, powerEfficient: true };
        }
      };
    }
  } catch (e) { log("mediaCapabilities patch failed", e); }

  try {
    if (window.MediaSource && MediaSource.isTypeSupported) {
      const origMSE = MediaSource.isTypeSupported.bind(MediaSource);
      MediaSource.isTypeSupported = function (t) {
        if (!S.forceCodecSupport) return origMSE(t);
        const real = origMSE(t);
        if (!real) log("MSE claimed-supported (was false):", t);
        return true;
      };
    }
    const proto = window.HTMLMediaElement && HTMLMediaElement.prototype;
    if (proto && proto.canPlayType) {
      const origCPT = proto.canPlayType;
      proto.canPlayType = function (t) {
        const real = origCPT.call(this, t);
        return S.forceCodecSupport ? (real || "probably") : real;
      };
    }
  } catch (e) { log("codec patch failed", e); }

  // ========================================================================
  // 2. WEBRTC: capture peer for stats + SDP munging for codec / bitrate
  // ========================================================================
  let peer = null;
  const NativePC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
  function codecName(v) { return { h264: "H264", h265: "H265", av1: "AV1" }[v] || null; }

  function preferCodec(sdp, name) {
    try {
      const lines = sdp.split(/\r?\n/);
      const mi = lines.findIndex((l) => l.startsWith("m=video"));
      if (mi < 0) return sdp;
      const pt2name = {};
      lines.forEach((l) => {
        const m = l.match(/^a=rtpmap:(\d+)\s+([A-Za-z0-9\-]+)\//);
        if (m) pt2name[m[1]] = m[2].toUpperCase();
      });
      const parts = lines[mi].split(" ");
      const head = parts.slice(0, 3), pts = parts.slice(3);
      const want = pts.filter((p) => pt2name[p] === name);
      if (!want.length) return sdp;
      const rest = pts.filter((p) => !want.includes(p));
      lines[mi] = head.concat(want, rest).join(" ");
      return lines.join("\r\n");
    } catch (e) { return sdp; }
  }
  function setBitrate(sdp, kbps) {
    try {
      if (!kbps) return sdp;
      let lines = sdp.split(/\r?\n/);
      const out = []; let inVid = false;
      for (const l of lines) {
        if (l.startsWith("m=video")) inVid = true;
        else if (l.startsWith("m=")) inVid = false;
        if (inVid && (l.startsWith("b=AS:") || l.startsWith("b=TIAS:"))) continue;
        out.push(l);
      }
      const mi2 = out.findIndex((l) => l.startsWith("m=video"));
      if (mi2 < 0) return sdp;
      let ci = mi2;
      for (let i = mi2 + 1; i < out.length && !out[i].startsWith("m="); i++) {
        if (out[i].startsWith("c=")) { ci = i; break; }
      }
      out.splice(ci + 1, 0, `b=AS:${kbps}`);
      return out.join("\r\n");
    } catch (e) { return sdp; }
  }
  function mungeSdp(desc) {
    if (!desc || !desc.sdp) return desc;
    let sdp = desc.sdp;
    if (S.preferredCodec !== "auto") {
      const n = codecName(S.preferredCodec);
      if (n) sdp = preferCodec(sdp, n);
    }
    if (S.maxBitrateMbps > 0) sdp = setBitrate(sdp, S.maxBitrateMbps * 1000);
    return { type: desc.type, sdp };
  }
  if (NativePC) {
    const Wrapped = function (...args) {
      const pc = new NativePC(...args);
      peer = pc;
      try {
        const origSLD = pc.setLocalDescription.bind(pc);
        pc.setLocalDescription = function (desc) {
          try { desc = mungeSdp(desc); } catch (e) { log("munge failed", e); }
          return origSLD(desc);
        };
      } catch (e) {}
      return pc;
    };
    Wrapped.prototype = NativePC.prototype;
    window.RTCPeerConnection = Wrapped;
    if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = Wrapped;
  }

  // ========================================================================
  // 3. VIBRATION
  // ========================================================================
  try {
    const HA = window.GamepadHapticActuator;
    if (HA && HA.prototype && HA.prototype.playEffect) {
      const origPlay = HA.prototype.playEffect;
      HA.prototype.playEffect = function (type, params) {
        const v = S.vibration / 100;
        if (v <= 0) return Promise.resolve("complete");
        if (params && v !== 1) {
          params = { ...params,
            strongMagnitude: (params.strongMagnitude || 0) * v,
            weakMagnitude: (params.weakMagnitude || 0) * v };
        }
        return origPlay.call(this, type, params);
      };
    }
  } catch (e) { log("haptic patch failed", e); }

  // ========================================================================
  // 4. CONTROLLER: deadzone + remap, neutralize input while menu open
  // ========================================================================
  const _getGamepads = navigator.getGamepads
    ? navigator.getGamepads.bind(navigator)
    : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads.bind(navigator) : null);

  function applyDeadzone(axes, dzPct) {
    const dz = dzPct / 100;
    if (dz <= 0) return axes;
    const out = axes.slice();
    for (let i = 0; i + 1 < out.length; i += 2) {
      const x = out[i], y = out[i + 1], mag = Math.hypot(x, y);
      if (mag < dz) { out[i] = 0; out[i + 1] = 0; }
      else { const s = (mag - dz) / (1 - dz); out[i] = (x / mag) * s; out[i + 1] = (y / mag) * s; }
    }
    return out;
  }
  function remapButtons(buttons) {
    const src = Array.from(buttons);
    const base = src.map((b) => ({ pressed: b.pressed, touched: b.touched, value: b.value }));
    const map = S.remap || {};
    if (!Object.keys(map).length) return base;
    return base.map((b, i) => {
      const phys = map[i];
      if (phys != null && src[phys]) {
        const p = src[phys];
        return { pressed: p.pressed, touched: p.touched, value: p.value };
      }
      return b;
    });
  }
  function neutralPads(raw) {
    const list = [];
    for (const p of raw) {
      if (!p) { list.push(null); continue; }
      list.push({ id: p.id, index: p.index, connected: p.connected, mapping: p.mapping,
        timestamp: p.timestamp, vibrationActuator: p.vibrationActuator,
        axes: new Array(p.axes.length).fill(0),
        buttons: Array.from(p.buttons).map(() => ({ pressed: false, touched: false, value: 0 })) });
    }
    return list;
  }
  function processPads(raw) {
    const list = [];
    for (const p of raw) {
      if (!p) { list.push(null); continue; }
      list.push({ id: p.id, index: p.index, connected: p.connected, mapping: p.mapping,
        timestamp: p.timestamp, vibrationActuator: p.vibrationActuator,
        axes: applyDeadzone(Array.from(p.axes), S.deadzone),
        buttons: remapButtons(p.buttons) });
    }
    return list;
  }
  if (_getGamepads) {
    const wrapped = function () {
      const raw = _getGamepads();
      if (menuOpen) return neutralPads(raw);
      return processPads(raw);
    };
    navigator.getGamepads = wrapped;
    if (navigator.webkitGetGamepads) navigator.webkitGetGamepads = wrapped;
  }

  // ========================================================================
  // 5. VIDEO FILTER
  // ========================================================================
  function sharpenKernel(a) { return `0 ${-a} 0 ${-a} ${1 + 4 * a} ${-a} 0 ${-a} 0`; }
  function injectSvgFilter() {
    if (document.getElementById("selene-svg")) return;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.id = "selene-svg";
    svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
    svg.style.cssText = "position:absolute;width:0;height:0";
    svg.innerHTML =
      `<defs><filter id="selene-sharpen"><feConvolveMatrix id="selene-fe" order="3" preserveAlpha="true" kernelMatrix="0 0 0 0 1 0 0 0 0"/></filter></defs>`;
    (document.body || document.documentElement).appendChild(svg);
  }
  function applyVideoFilter() {
    const v = document.querySelector("video");
    if (!v) return;
    const fe = document.getElementById("selene-fe");
    if (fe) fe.setAttribute("kernelMatrix", sharpenKernel(S.clarity / 100));
    const parts = [];
    if (S.clarity > 0) parts.push("url(#selene-sharpen)");
    if (S.saturation !== 100) parts.push(`saturate(${S.saturation}%)`);
    v.style.filter = parts.join(" ");
  }

  // ========================================================================
  // 6. STATS HUD  (+ rolling telemetry for sparklines)
  // ========================================================================
  let hud;
  let last = { bytes: 0, ts: 0, framesDropped: 0, framesDecoded: 0 };
  const hist = { mbps: [], fps: [] };
  const HIST_MAX = 48;

  function buildHud() {
    hud = document.createElement("div");
    hud.id = "selene-hud"; hud.className = "sel-scope";
    document.documentElement.appendChild(hud);
    applyHudStyle();
  }
  function applyHudStyle() {
    if (!hud) return;
    hud.style.display = S.hudEnabled ? "block" : "none";
    hud.style.opacity = String(S.hudOpacity / 100);
    hud.style.top = hud.style.bottom = hud.style.left = hud.style.right = "auto";
    const [vy, vx] = S.hudPosition.split("-");
    hud.style[vy] = "16px"; hud.style[vx] = "16px";
  }
  const mColor = (v, warn, bad) => (v >= bad ? BAD : v >= warn ? WARN : GOOD);
  function hrow(k, val, c) {
    return `<div class="sel-hr"><span class="sel-hk">${k}</span><span class="sel-hv" style="color:${c || "#eef0f8"}">${val}</span></div>`;
  }
  function spark(arr) {
    if (arr.length < 2) return `<svg class="sel-spg" viewBox="0 0 64 20"></svg>`;
    const w = 64, h = 20, max = Math.max(...arr), min = Math.min(...arr), rng = (max - min) || 1;
    const pts = arr.map((v, i) => {
      const x = (i / (arr.length - 1)) * w;
      const y = h - 2 - ((v - min) / rng) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `<svg class="sel-spg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="#b8c0ff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  }

  async function pollStats() {
    injectSvgFilter();
    applyVideoFilter();
    if (!(hud && S.hudEnabled && peer && peer.getStats)) return;
    try {
      const stats = await peer.getStats();
      let inbound, pair, codecStat;
      stats.forEach((r) => {
        if (r.type === "inbound-rtp" && r.kind === "video") inbound = r;
        if (r.type === "candidate-pair" && (r.nominated || r.selected)) pair = r;
        if (r.type === "codec") codecStat = codecStat || r;
      });
      let fps = 0, dropPct = 0, lossPct = 0, jitter = 0, mbps = 0, res = "—", codec = "—", rtt = 0;
      const now = performance.now();
      if (inbound) {
        fps = Math.round(inbound.framesPerSecond || 0);
        if (inbound.frameWidth) res = `${inbound.frameWidth}x${inbound.frameHeight}`;
        const dDrop = (inbound.framesDropped || 0) - last.framesDropped;
        const dDec = (inbound.framesDecoded || 0) - last.framesDecoded;
        dropPct = dDec > 0 ? (dDrop / (dDec + dDrop)) * 100 : 0;
        jitter = Math.round((inbound.jitter || 0) * 1000);
        if (last.ts) mbps = ((inbound.bytesReceived - last.bytes) * 8) / ((now - last.ts) / 1000) / 1e6;
        last = { bytes: inbound.bytesReceived, ts: now,
          framesDropped: inbound.framesDropped || 0, framesDecoded: inbound.framesDecoded || 0 };
        if (inbound.packetsLost != null && inbound.packetsReceived != null) {
          const tot = inbound.packetsLost + inbound.packetsReceived;
          lossPct = tot > 0 ? (inbound.packetsLost / tot) * 100 : 0;
        }
      }
      if (pair && pair.currentRoundTripTime != null) rtt = Math.round(pair.currentRoundTripTime * 1000);
      if (codecStat && codecStat.mimeType) codec = codecStat.mimeType.replace("video/", "");

      if (mbps > 0 || hist.mbps.length) { hist.mbps.push(Math.max(0, mbps)); if (hist.mbps.length > HIST_MAX) hist.mbps.shift(); }
      if (fps > 0 || hist.fps.length) { hist.fps.push(fps); if (hist.fps.length > HIST_MAX) hist.fps.shift(); }

      const m = S.hudMetrics;
      const dot = mColor(rtt, 60, 100);
      let grid = "";
      if (m.res) grid += hrow("res", res);
      if (m.fps) grid += hrow("fps", fps, mColor(30 - fps, 12, 20));
      if (m.bitrate) grid += hrow("bitrate", mbps.toFixed(1) + " Mbps");
      if (m.rtt) grid += hrow("rtt", rtt + " ms", mColor(rtt, 60, 100));
      if (m.dropped) grid += hrow("dropped", dropPct.toFixed(1) + "%", mColor(dropPct, 1, 5));
      if (m.loss) grid += hrow("loss", lossPct.toFixed(2) + "%", mColor(lossPct, 0.5, 2));
      if (m.jitter) grid += hrow("jitter", jitter + " ms", mColor(jitter, 20, 40));
      if (m.codec) grid += hrow("codec", codec);

      const sp = [];
      if (m.bitrate) sp.push(`<div class="sel-spc"><div class="sel-spl">bitrate</div>${spark(hist.mbps)}</div>`);
      if (m.fps) sp.push(`<div class="sel-spc"><div class="sel-spl">fps</div>${spark(hist.fps)}</div>`);

      hud.innerHTML =
        `<div class="sel-hh"><span class="sel-cr">${CRESCENT}</span><span class="sel-hn">${APP}</span>` +
        `<span class="sel-hd" style="color:${dot};background:${dot}"></span></div>` +
        `<div class="sel-hg">${grid}</div>` +
        (sp.length ? `<div class="sel-sp">${sp.join("")}</div>` : "");
    } catch (e) { /* not ready */ }
  }

  // ========================================================================
  // 7. SETTINGS PANEL  (data-driven, D-pad / arrow navigable)
  // ========================================================================
  const LOGICAL = [
    ["A", 0], ["B", 1], ["X", 2], ["Y", 3], ["LB", 4], ["RB", 5],
    ["LT", 6], ["RT", 7], ["View", 8], ["Menu", 9], ["LS", 10], ["RS", 11],
    ["D-Up", 12], ["D-Down", 13], ["D-Left", 14], ["D-Right", 15],
  ];
  let panel, menuOpen = false, pageStack = [], focus = 0, capturing = null;

  function pgMetrics() {
    const keys = [["res", "Resolution"], ["fps", "FPS"], ["bitrate", "Bitrate"], ["rtt", "RTT"],
      ["dropped", "Dropped frames"], ["loss", "Packet loss"], ["jitter", "Jitter"], ["codec", "Codec"]];
    return { title: "Choose which metrics show",
      items: keys.map(([k, label]) => ({ type: "toggle", label,
        get: () => S.hudMetrics[k], set: (v) => { S.hudMetrics[k] = v; saveSettings(); } })) };
  }
  function pgRemap() {
    const items = LOGICAL.map(([name, idx]) => ({ type: "rebind", label: name, logical: idx }));
    items.push({ type: "action", label: "Reset to default mapping", run: () => { S.remap = {}; saveSettings(); } });
    return { title: "Press a row, then the button you want", items };
  }
  function rootPage() {
    return { title: "Overlay settings", items: [
      { type: "header", label: "Playback unlock", icon: "bolt" },
      { type: "toggle", label: "Unlock low-latency gate", note: "next stream",
        get: () => S.unlockGate, set: (v) => { S.unlockGate = v; saveSettings(); } },
      { type: "toggle", label: "Force codec support", note: "turn off if black screen",
        get: () => S.forceCodecSupport, set: (v) => { S.forceCodecSupport = v; saveSettings(); } },

      { type: "header", label: "Stats overlay", icon: "activity" },
      { type: "toggle", label: "Show overlay",
        get: () => S.hudEnabled, set: (v) => { S.hudEnabled = v; saveSettings(); applyHudStyle(); } },
      { type: "cycle", label: "Corner",
        options: [["Top left", "top-left"], ["Top right", "top-right"], ["Bottom left", "bottom-left"], ["Bottom right", "bottom-right"]],
        get: () => S.hudPosition, set: (v) => { S.hudPosition = v; saveSettings(); applyHudStyle(); } },
      { type: "slider", label: "Opacity", min: 20, max: 100, step: 5, unit: "%",
        get: () => S.hudOpacity, set: (v) => { S.hudOpacity = v; saveSettings(); applyHudStyle(); } },
      { type: "page", label: "Choose metrics", build: pgMetrics },

      { type: "header", label: "Controller", icon: "pad" },
      { type: "slider", label: "Stick deadzone", min: 0, max: 40, step: 1, unit: "%",
        get: () => S.deadzone, set: (v) => { S.deadzone = v; saveSettings(); } },
      { type: "slider", label: "Vibration", min: 0, max: 100, step: 10, unit: "%",
        get: () => S.vibration, set: (v) => { S.vibration = v; saveSettings(); } },
      { type: "page", label: "Remap buttons", build: pgRemap },

      { type: "header", label: "Streaming quality", icon: "signal" },
      { type: "cycle", label: "Preferred codec", note: "reconnect to apply",
        options: [["Auto", "auto"], ["H.264", "h264"], ["H.265", "h265"], ["AV1", "av1"]],
        get: () => S.preferredCodec, set: (v) => { S.preferredCodec = v; saveSettings(); } },
      { type: "slider", label: "Max bitrate", min: 0, max: 25, step: 1, unit: " Mbps", zero: "Auto",
        note: "reconnect · server may cap",
        get: () => S.maxBitrateMbps, set: (v) => { S.maxBitrateMbps = v; saveSettings(); } },

      { type: "header", label: "Display", icon: "monitor" },
      { type: "cycle", label: "UI size", note: "if Luna looks too big / small",
        options: [["Large", "1280"], ["Medium", "1600"], ["Default", "1920"], ["Small", "2240"], ["Tiny", "2560"]],
        get: () => String(S.uiWidth), set: (v) => { S.uiWidth = parseInt(v, 10) || 1920; saveSettings(); applyViewport(); } },

      { type: "header", label: "Video", icon: "contrast" },
      { type: "slider", label: "Clarity", min: 0, max: 100, step: 5, unit: "%", zero: "Off",
        get: () => S.clarity, set: (v) => { S.clarity = v; saveSettings(); applyVideoFilter(); } },
      { type: "slider", label: "Saturation", min: 50, max: 150, step: 5, unit: "%",
        get: () => S.saturation, set: (v) => { S.saturation = v; saveSettings(); applyVideoFilter(); } },

      { type: "header", label: "" },
      { type: "action", label: "Reset all to defaults", run: () => { resetSettings(); renderPanel(); } },
      { type: "action", label: "Close", run: closeMenu },
    ] };
  }

  function focusableItems() {
    const page = pageStack[pageStack.length - 1];
    return page.items.map((it, i) => ({ it, i })).filter(({ it }) => it.type !== "header");
  }

  function buildPanel() {
    panel = document.createElement("div");
    panel.id = "selene-panel"; panel.className = "sel-scope";
    document.documentElement.appendChild(panel);
  }

  function renderPanel() {
    const page = pageStack[pageStack.length - 1];
    const foc = focusableItems();
    if (focus >= foc.length) focus = foc.length - 1;
    if (focus < 0) focus = 0;
    const focusedRealIdx = foc.length ? foc[focus].i : -1;

    let rows = "";
    page.items.forEach((it, i) => {
      if (it.type === "header") {
        rows += it.label
          ? `<div class="sel-sec"><span class="sel-ic">${ico(it.icon)}</span><span class="sel-eye">${it.label}</span><span class="sel-secrule"></span></div>`
          : `<div style="height:6px"></div>`;
        return;
      }
      const on = i === focusedRealIdx;
      let ctl = "";
      if (it.type === "toggle") {
        ctl = `<span class="sel-sw ${it.get() ? "y" : ""}"><span class="sel-kn"></span></span>`;
      } else if (it.type === "slider") {
        const v = it.get();
        const pct = Math.max(0, Math.min(100, ((v - it.min) / (it.max - it.min)) * 100));
        const disp = (it.zero && v === it.min) ? it.zero : v + (it.unit || "");
        ctl = `<span class="sel-sl"><span class="sel-tr"><span class="sel-fl" style="width:${pct}%"></span><span class="sel-kns" style="left:${pct}%"></span></span><span class="sel-vl">${disp}</span></span>`;
      } else if (it.type === "cycle") {
        const cur = it.options.find((o) => o[1] === it.get());
        ctl = `<span class="sel-cy"><span class="sel-ch">‹</span><span class="sel-cv">${cur ? cur[0] : "?"}</span><span class="sel-ch">›</span></span>`;
      } else if (it.type === "rebind") {
        const phys = (S.remap && S.remap[it.logical] != null) ? S.remap[it.logical] : it.logical;
        const def = phys === it.logical;
        ctl = `<span class="sel-chip ${def ? "" : "a"}">→ ${phys}</span>`;
      }
      const note = it.note ? `<span class="sel-note">${it.note}</span>` : "";
      rows += `<div class="sel-row ${on ? "on" : ""}"><span class="sel-mk">${CRESCENT}</span><span class="sel-lbl">${it.label}${note}</span><span class="sel-ctl">${ctl}</span></div>`;
    });

    const backHint = pageStack.length > 1
      ? `<span class="sel-cap"><span class="sel-key">B</span>Back</span>`
      : `<span class="sel-cap"><span class="sel-key">B</span>Close</span>`;

    const cap = capturing
      ? `<div class="sel-capov"><div><div class="sel-capm">${CRESCENT}</div>` +
        `<div class="sel-capt">Rebind ${LOGICAL[capturing.logical] ? LOGICAL[capturing.logical][0] : capturing.logical}</div>` +
        `<div class="sel-caps">Press a button — B or Esc to cancel</div></div></div>`
      : "";

    panel.innerHTML =
      `<div class="sel-card">` +
        `<div class="sel-head">` +
          `<div><div class="sel-brand"><span class="sel-cr">${CRESCENT}</span><span class="sel-word">${APP}</span></div>` +
            `<div class="sel-sub">${page.title}</div></div>` +
          `<div class="sel-hints">` +
            `<span class="sel-cap"><span class="sel-key">↕</span>Move</span>` +
            `<span class="sel-cap"><span class="sel-key">A</span>Select</span>` +
            backHint +
          `</div>` +
        `</div>` +
        `<div class="sel-rule"></div>` +
        `<div class="sel-body">${rows}</div>` +
        cap +
      `</div>`;

    const focEl = panel.querySelector(".sel-row.on");
    if (focEl && focEl.scrollIntoView) focEl.scrollIntoView({ block: "nearest" });
  }

  function openMenu() {
    if (menuOpen) return;
    menuOpen = true; pageStack = [rootPage()]; focus = 0; capturing = null;
    panel.style.display = "flex"; renderPanel();
  }
  function closeMenu() { menuOpen = false; capturing = null; panel.style.display = "none"; }
  function back() {
    if (capturing) { capturing = null; renderPanel(); return; }
    if (pageStack.length > 1) { pageStack.pop(); focus = 0; renderPanel(); }
    else closeMenu();
  }
  function move(d) {
    const foc = focusableItems(); if (!foc.length) return;
    focus = (focus + d + foc.length) % foc.length; renderPanel();
  }
  function adjust(dir) {
    const foc = focusableItems(); if (!foc.length) return;
    const it = foc[focus].it;
    if (it.type === "slider") {
      let v = it.get() + dir * it.step;
      v = Math.max(it.min, Math.min(it.max, v)); it.set(v); renderPanel();
    } else if (it.type === "cycle") {
      const idx = it.options.findIndex((o) => o[1] === it.get());
      const ni = (idx + dir + it.options.length) % it.options.length;
      it.set(it.options[ni][1]); renderPanel();
    }
  }
  function activate() {
    const foc = focusableItems(); if (!foc.length) return;
    const it = foc[focus].it;
    if (it.type === "toggle") { it.set(!it.get()); renderPanel(); }
    else if (it.type === "action") { it.run(); }
    else if (it.type === "page") { pageStack.push(it.build()); focus = 0; renderPanel(); }
    else if (it.type === "rebind") { capturing = { logical: it.logical }; renderPanel(); }
    else if (it.type === "cycle" || it.type === "slider") { adjust(1); }
  }
  function captureButton(physIdx) {
    if (!capturing) return;
    if (physIdx === capturing.logical) delete S.remap[capturing.logical];
    else S.remap[capturing.logical] = physIdx;
    saveSettings(); capturing = null; renderPanel();
  }

  // ========================================================================
  // 8. INPUT DRIVER
  // ========================================================================
  const NAV = { up: 12, down: 13, left: 14, right: 15, a: 0, b: 1 };
  const REPEAT_DELAY = 320, REPEAT_RATE = 120;
  const held = {};
  let prevBtn = [];
  let chordPrev = false;

  function edge(key, pressed) {
    const wasDown = held[key] && held[key].down;
    if (pressed && !wasDown) { held[key] = { down: true, next: performance.now() + REPEAT_DELAY }; return true; }
    if (pressed && wasDown && performance.now() >= held[key].next) { held[key].next = performance.now() + REPEAT_RATE; return true; }
    if (!pressed) held[key] = { down: false, next: 0 };
    return false;
  }
  function gamepadLoop() {
    if (_getGamepads) {
      const pads = _getGamepads();
      let pad = null;
      for (const p of pads) { if (p) { pad = p; break; } }
      if (pad) {
        const b = pad.buttons;
        const isDown = (i) => b[i] && b[i].pressed;
        const chord = isDown(8) && isDown(9);
        if (chord && !chordPrev) { menuOpen ? closeMenu() : openMenu(); }
        chordPrev = chord;
        if (menuOpen) {
          if (capturing) {
            for (let i = 0; i < b.length; i++) {
              if (b[i] && b[i].pressed && !prevBtn[i] && i !== 8 && i !== 9) { captureButton(i); break; }
            }
          } else {
            if (edge("up", isDown(NAV.up))) move(-1);
            if (edge("down", isDown(NAV.down))) move(1);
            if (edge("left", isDown(NAV.left))) adjust(-1);
            if (edge("right", isDown(NAV.right))) adjust(1);
            if (isDown(NAV.a) && !prevBtn[NAV.a]) activate();
            if (isDown(NAV.b) && !prevBtn[NAV.b]) back();
          }
        }
        prevBtn = b.map((x) => !!(x && x.pressed));
      }
    }
    requestAnimationFrame(gamepadLoop);
  }
  window.addEventListener("keydown", (e) => {
    if (!menuOpen && (e.key === "h" || e.key === "H")) {
      S.hudEnabled = !S.hudEnabled; saveSettings(); applyHudStyle(); return;
    }
    if (e.key === "`") { menuOpen ? closeMenu() : openMenu(); e.preventDefault(); return; }
    if (!menuOpen) return;
    if (capturing) { if (e.key === "Escape") { capturing = null; renderPanel(); } e.preventDefault(); return; }
    switch (e.key) {
      case "ArrowUp": move(-1); e.preventDefault(); break;
      case "ArrowDown": move(1); e.preventDefault(); break;
      case "ArrowLeft": adjust(-1); e.preventDefault(); break;
      case "ArrowRight": adjust(1); e.preventDefault(); break;
      case "Enter": activate(); e.preventDefault(); break;
      case "Escape": case "Backspace": back(); e.preventDefault(); break;
    }
  }, true);

  // ========================================================================
  // 9. BOOT
  // ========================================================================
  function boot() {
    injectStyles();
    buildHud();
    buildPanel();
    injectSvgFilter();
    applyAll();
    setInterval(pollStats, 1000);
    requestAnimationFrame(gamepadLoop);
    // Luna hydrates its own viewport meta during startup; re-assert ours after.
    window.addEventListener("load", applyViewport);
    setTimeout(applyViewport, 1500);
    toast("Selene ready — hold View + Menu for settings");
    const uad = navigator.userAgentData || {};
    log("ready — platform:", uad.platform, "mobile:", uad.mobile, "uiWidth:", S.uiWidth);
  }
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "selene-toast sel-scope";
    t.innerHTML = `<span class="sel-cr">${CRESCENT}</span><span>${msg}</span>`;
    (document.body || document.documentElement).appendChild(t);
    setTimeout(() => t.classList.add("out"), 2600);
    setTimeout(() => t.remove(), 3200);
  }

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
