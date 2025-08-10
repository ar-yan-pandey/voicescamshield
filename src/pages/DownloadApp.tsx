import { useEffect } from "react";
import JSZip from "jszip";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
const DownloadApp = () => {
  const navigate = useNavigate();
  const startCall = () => {
    const id = Date.now().toString(36);
    navigate(`/call/${id}`);
  };

  const buildChromeExtensionZip = async () => {
    try {
      const zip = new JSZip();

      const manifest = {
        manifest_version: 3,
        name: "Voice Scam Shield",
        version: "0.1.0",
        description: "Transcribe meetings and display a scam risk meter.",
        permissions: ["storage"],
        host_permissions: ["https://meet.google.com/*", "https://*.zoom.us/*"],
        content_scripts: [
          {
            matches: ["https://meet.google.com/*", "https://*.zoom.us/*"],
            js: ["content.js"],
            css: ["style.css"],
            run_at: "document_idle",
          },
        ],
      } as const;

      const contentJs = `(() => {
  if ((window as any).__vss_injected) return; (window as any).__vss_injected = true;
  const root = document.createElement('div');
  root.id = 'vss-overlay-root';
  root.innerHTML = '<div class="vss-card">\
<div class="vss-h">Voice Scam Shield<button id="vss-close" title="Close" class="vss-btn" style="flex:0 0 auto;padding:4px 8px;margin-left:8px">×</button></div>\
<div class="vss-status" id="vss-status">Idle</div>\
<div class="vss-meter"><div class="vss-meter-bar" id="vss-meter"></div></div>\
<div class="vss-controls"><button class="vss-btn" id="vss-toggle">Start Transcribing</button></div>\
<div class="vss-body" id="vss-log"></div>\
</div>';
  document.body.appendChild(root);

  const meter = root.querySelector('#vss-meter') as HTMLDivElement;
  const statusEl = root.querySelector('#vss-status') as HTMLDivElement;
  const btn = root.querySelector('#vss-toggle') as HTMLButtonElement;
  const closeBtn = root.querySelector('#vss-close') as HTMLButtonElement;
  const log = root.querySelector('#vss-log') as HTMLDivElement;

  closeBtn?.addEventListener('click', () => root.remove());

  let recog: any = null; let active = false; let score = 0;
  const keywords = [
    'gift card','wire transfer','crypto','bitcoin','apple card','google play','bank account','password','verification code',
    'remote desktop','anydesk','teamviewer','refund','overcharge','ssn','social security','urgent','immediate action','do not tell','confidential','law enforcement','warrant','arrest'
  ];

  function riskEval(text: string){
    let s = 0; const t = text.toLowerCase();
    for (const k of keywords) { if (t.includes(k)) s += 8; }
    if (/\b(otp|one[- ]time code)\b/i.test(text)) s += 10;
    return Math.min(100, s);
  }

  function updateMeter(val: number){
    meter.style.width = val + '%';
    meter.setAttribute('aria-valuenow', String(val));
    meter.style.background = val < 40 ? '#16a34a' : (val < 70 ? '#f59e0b' : '#ef4444');
  }

  function stop(){
    active = false; if (recog) { try { recog.stop(); } catch {} }
    btn.textContent = 'Start Transcribing';
    statusEl.textContent = 'Idle';
  }

  function start(){
    const w: any = window as any;
    if (!("webkitSpeechRecognition" in w)) { statusEl.textContent = 'Speech recognition not supported in this browser.'; return; }
    score = 0; updateMeter(0); active = true; btn.textContent = 'Stop'; statusEl.textContent = 'Listening...';
    recog = new w.webkitSpeechRecognition();
    recog.continuous = true; recog.interimResults = true; recog.lang = 'en-US';

    recog.onresult = (e: any) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]; const txt = r[0].transcript;
        if (r.isFinal) { final += txt + ' '; }
      }
      if (final) {
        const p = document.createElement('p'); p.textContent = final; p.style.margin = '6px 0'; p.style.color = '#e5e7eb';
        log.appendChild(p); log.scrollTop = log.scrollHeight;
        const v = riskEval(final); score = Math.min(100, score + v / 4);
        updateMeter(Math.round(score));
      }
    };
    recog.onerror = (ev: any) => { statusEl.textContent = 'Error: ' + ev.error; };
    recog.onend = () => { if (active) { try { recog.start(); } catch {} } else { statusEl.textContent = 'Stopped'; } };
    try { recog.start(); } catch (err) { statusEl.textContent = 'Cannot start: ' + err; }
  }

  btn.addEventListener('click', () => { if (active) { stop(); } else { start(); } });
})();`;

      const styleCss = `#vss-overlay-root{position:fixed;top:16px;right:16px;z-index:2147483647;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif} .vss-card{background:#0f172aeb;color:white;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.3);width:320px;max-width:90vw;overflow:hidden;border:1px solid rgba(255,255,255,.1)} .vss-h{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;font-weight:600;font-size:14px;background:linear-gradient(135deg,#111827,#0b1220)} .vss-meter{height:10px;background:#111827;border-radius:999px;margin:8px 12px;overflow:hidden;border:1px solid rgba(255,255,255,.1)} .vss-meter-bar{height:100%;width:0%;transition:width .3s ease,background .3s ease} .vss-controls{display:flex;gap:8px;padding:8px 12px} .vss-btn{flex:1;border:0;border-radius:8px;padding:8px 10px;background:#1f2937;color:#e5e7eb;cursor:pointer;font-weight:600} .vss-btn:hover{background:#374151} .vss-body{padding:0 12px 12px 12px;max-height:200px;overflow:auto;background:#0b1220} .vss-status{padding:8px 12px;color:#cbd5e1;font-size:12px}`;

      

      zip.file("manifest.json", JSON.stringify(manifest, null, 2));
      zip.file("content.js", contentJs);
      zip.file("style.css", styleCss);
      

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "voice-scam-shield-extension.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to generate ZIP", e);
      alert("Failed to generate ZIP. Please try again.");
    }
  };

  useEffect(() => {
    const title = "Download Voice Scam Shield Overlay";
    const description = "Download the Voice Scam Shield overlay app to transcribe calls in real time and detect scams.";
    document.title = title;
    const ensureTag = (selector: string, create: () => HTMLElement) => {
      let el = document.head.querySelector(selector) as HTMLElement | null;
      if (!el) {
        el = create();
        document.head.appendChild(el);
      }
      return el;
    };
    const metaDesc = ensureTag('meta[name="description"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      return m;
    }) as HTMLMetaElement;
    metaDesc.setAttribute("content", description);
    const linkCanonical = ensureTag('link[rel="canonical"]', () => {
      const l = document.createElement("link");
      l.setAttribute("rel", "canonical");
      return l;
    }) as HTMLLinkElement;
    linkCanonical.setAttribute("href", window.location.origin + "/download-app");
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Voice Scam Shield Overlay",
      applicationCategory: "CommunicationApplication",
      operatingSystem: "Windows, Android, Chrome",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD"
      },
      description,
      url: window.location.origin + "/download-app"
    };
    const ldTag = ensureTag('script[type="application/ld+json"]#downloadAppLd', () => {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.id = "downloadAppLd";
      return s;
    }) as HTMLScriptElement;
    ldTag.textContent = JSON.stringify(jsonLd);
  }, []);
  return <main className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-primary opacity-20 pointer-events-none" />
      <header className="container py-10">
        <nav className="flex items-center justify-between">
          <a href="/" className="font-semibold tracking-tight">
            Voice Scam Shield
          </a>
          <div className="flex gap-3">
            <a href="/" className="inline-flex"><Button variant="ghost">Home</Button></a>
          </div>
        </nav>
      </header>

      <section className="container pb-16 pt-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Download Scam Shield Overlay</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Install the lightweight overlay to transcribe conversations in real time and alert you about potential scams.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button onClick={startCall} className="inline-flex" aria-label="Use on Windows">
            Use on Windows
          </Button>
          <a href="/downloads/overlay-android.txt" download="VoiceScamSheild.apk" className="inline-flex" aria-label="Download Android APK">
            <Button variant="secondary">Download for Android</Button>
          </a>
          <Button variant="outline" onClick={buildChromeExtensionZip} aria-label="Download Chrome Extension as ZIP">
            Download Chrome Extension (.zip)
          </Button>
        </div>
      </section>

      <section className="container grid md:grid-cols-3 gap-6 pb-24">
        <Card>
          <CardHeader>
            <CardTitle>Real-time Transcription</CardTitle>
          </CardHeader>
          <CardContent>
            Live captions overlay your call window, so you can read along as you talk.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Scam Risk Scoring</CardTitle>
          </CardHeader>
          <CardContent>
            Our on-device analyzer flags typical scam patterns and displays a clear risk score.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Private & Lightweight</CardTitle>
          </CardHeader>
          <CardContent>
            Designed to be privacy-first and fast, with optional cloud features disabled by default.
          </CardContent>
        </Card>
      </section>

      <section className="container pb-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <ol className="mt-4 space-y-3 list-decimal list-inside text-muted-foreground">
            <li>Download and install the overlay for your platform.</li>
            <li>Start your call as usual (Zoom, Meet, Phone-to-PC, etc.).</li>
            <li>The overlay transcribes audio in real time and highlights risk cues.</li>
            <li>Get a simple on-screen alert if a scam pattern is detected.</li>
          </ol>
        </div>
      </section>
    </main>;
};
export default DownloadApp;