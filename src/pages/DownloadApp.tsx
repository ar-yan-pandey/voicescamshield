import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DownloadApp = () => {
  useEffect(() => {
    const title = "Download Voice Scam Shield Overlay";
    const description =
      "Download the Voice Scam Shield overlay app to transcribe calls in real time and detect scams.";
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
      operatingSystem: "Windows, macOS",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description,
      url: window.location.origin + "/download-app",
    };

    const ldTag = ensureTag('script[type="application/ld+json"]#downloadAppLd', () => {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.id = "downloadAppLd";
      return s;
    }) as HTMLScriptElement;
    ldTag.textContent = JSON.stringify(jsonLd);
  }, []);

  return (
    <main className="min-h-screen relative overflow-hidden">
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
          <a href="/downloads/overlay-windows.txt" download className="inline-flex" aria-label="Download Windows preview package">
            <Button>Download for Windows (Preview)</Button>
          </a>
          <a href="/downloads/overlay-macos.txt" download className="inline-flex" aria-label="Download macOS preview package">
            <Button variant="secondary">Download for macOS (Preview)</Button>
          </a>
          <a href="/downloads/overlay-chrome.txt" download className="inline-flex" aria-label="Download Chrome extension preview">
            <Button variant="outline">Download Chrome Overlay (Preview)</Button>
          </a>
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
    </main>
  );
};

export default DownloadApp;
