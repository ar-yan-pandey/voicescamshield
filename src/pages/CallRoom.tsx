
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TranscriptList, { TranscriptItem, RiskLevel } from "@/components/TranscriptList";
import RiskWidget from "@/components/RiskWidget";
import { toast } from "@/hooks/use-toast";
import { useWebRTCRoom } from "@/hooks/useWebRTCRoom";
import { AudioChunker } from "@/utils/AudioChunker";
import { detectScamLocally, getRiskLevel } from "@/utils/scamDetection";
import LanguageSelector from "@/components/LanguageSelector";
import { detectLanguageFromText, DetectedLanguage } from "@/utils/language";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDistractorAgent } from "@/hooks/useDistractorAgent";
import { Usb, Bluetooth } from "lucide-react";
const CallRoom: React.FC = () => {
  const { id } = useParams();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const chunkerRef = useRef<AudioChunker | null>(null);
  
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [riskValue, setRiskValue] = useState(0);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("low");
  const [aiScamCheckEnabled, setAiScamCheckEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [detectedLang, setDetectedLang] = useState<DetectedLanguage | null>(null);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [showScamAlert, setShowScamAlert] = useState(false);
  const alertShownRef = useRef(false);
  const [sensitiveAlertOpen, setSensitiveAlertOpen] = useState(false);
  const sensitiveAlertShownRef = useRef(false);
  const pendingTextRef = useRef<string>("");
  const { connected, presenceCount, role, start, end, replaceAudioTrack, restoreAudioTrack } = useWebRTCRoom(id || "default", localVideoRef, remoteVideoRef);
  const agent = useDistractorAgent({ transcripts, replaceAudioTrack, restoreAudioTrack, targetLang: selectedLang });
  const [usbDialogOpen, setUsbDialogOpen] = useState(false);
  const [btDialogOpen, setBtDialogOpen] = useState(false);
  const [btAvailable, setBtAvailable] = useState<boolean | null>(null);
  const [btDevices, setBtDevices] = useState<{ id: string; name: string }[]>([]);

  const computeRisk = useCallback((items: TranscriptItem[]) => {
    if (items.length === 0) return { value: 0, level: "low" as RiskLevel };
    const weights = { low: 0.2, medium: 0.6, high: 0.9 } as const;
    const v = items.reduce((acc, it) => acc + weights[it.risk], 0) / items.length;
    let pct = Math.round(v * 100);
    // Demo override: bump score above 50% if keywords appear in any transcript
    const demoRegex = /\b(won|dollars?|rupees?|fee|access|pay)\b/i;
    if (items.some((it) => demoRegex.test(it.text))) {
      pct = Math.max(pct, 51);
    }
    const lvl: RiskLevel = pct >= 70 ? "high" : pct >= 35 ? "medium" : "low";
    return { value: pct, level: lvl };
  }, []);

  const toggleMic = () => {
    const stream = localVideoRef.current?.srcObject as MediaStream | null;
    const next = !micEnabled;
    setMicEnabled(next);

    if (stream) {
      stream.getAudioTracks().forEach((t) => (t.enabled = next));
    }

    // Pause/resume transcription when mic is muted/unmuted
    if (chunkerRef.current) {
      chunkerRef.current.setPaused(!next);
    }

    toast({ title: next ? "Mic unmuted" : "Mic muted" });
  };

  const toggleCam = () => {
    const stream = localVideoRef.current?.srcObject as MediaStream | null;
    const next = !camEnabled;
    setCamEnabled(next);

    if (stream) {
      stream.getVideoTracks().forEach((t) => (t.enabled = next));
    }

    toast({ title: next ? "Camera On" : "Camera Off" });
  };

  const handleStart = async () => {
    try {
      await start();
      // apply current mic/camera state to local stream
      const stream = localVideoRef.current?.srcObject as MediaStream | null;
      if (stream) {
        stream.getAudioTracks().forEach((t) => (t.enabled = micEnabled));
        stream.getVideoTracks().forEach((t) => (t.enabled = camEnabled));
      }
      if (!chunkerRef.current) {
        const chunker = new AudioChunker(async (base64Wav) => {
          try {
            // First, get basic transcription from Gemini
            const res = await fetch(
              "https://qmgjplrejeslnqyoagvu.functions.supabase.co/functions/v1/gemini-transcribe",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  audio: base64Wav,
                  analyzeScam: aiScamCheckEnabled,
                  language: selectedLang || detectedLang?.code || undefined
                }),
              }
            );
            const data = await res.json();
            
            if (data?.text) {
              const text = String(data.text || '').trim();
              // Auto-detect language from transcript when not manually set
              if (!selectedLang) {
                const det = detectLanguageFromText(text);
                if (det) setDetectedLang(det);
              }

              const combined = (pendingTextRef.current + ' ' + text).trim();
              const parts = combined.split(/(?<=[.!?…])\s+/);
              const endsWithTerminator = /[.!?…]$/.test(combined);
              const fullSentences = endsWithTerminator ? parts : parts.slice(0, -1);
              pendingTextRef.current = endsWithTerminator ? '' : (parts[parts.length - 1] || '');

              if (fullSentences.length > 0) {
                setTranscripts((prev) => {
                  let next = prev;
                  for (const s of fullSentences) {
                    const sentence = s.trim();
                    if (sentence.length < 4) continue;

                    // Sensitive terms: auto-mute and warn once per room
                    if (!sensitiveAlertShownRef.current && /\b(otp|password)s?\b/i.test(sentence)) {
                      if (micEnabled) toggleMic();
                      sensitiveAlertShownRef.current = true;
                      setSensitiveAlertOpen(true);
                    }

                    // Local score for sentence
                    const local = detectScamLocally(sentence);
                    let riskScore = local.score;

                    // If AI enabled and has score for this chunk, take max
                    if (aiScamCheckEnabled && data.risk_score != null) {
                      riskScore = Math.max(riskScore, Number(data.risk_score));
                    }
                    const riskLabel = getRiskLevel(riskScore);

                    const item: TranscriptItem = {
                      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                      text: sentence,
                      timestamp: new Date().toLocaleTimeString(),
                      risk: riskLabel,
                      score: riskScore,
                    };
                    next = [item, ...next].slice(0, 100);
                  }

                  const { value, level } = computeRisk(next);
                  setRiskValue(value);
                  setRiskLevel(level);
                  if (value > 50 && !alertShownRef.current) {
                    alertShownRef.current = true;
                    setShowScamAlert(true);
                  }
                  return next;
                });
              }
            }
          } catch (e) {
            console.error("Transcription error", e);
          }
        }, 1000, { vadEnabled: true, vadThreshold: 0.02, vadHangoverMs: 500 });
        chunkerRef.current = chunker;
        await chunker.start();
        toast({ 
          title: "Transcribing", 
          description: aiScamCheckEnabled ? "Live transcription with AI scam analysis started" : "Live transcription with local scam detection started" 
        });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to start", variant: "destructive" });
    }
  };

  const handleEnd = () => {
    try { agent.stop(); } catch {}
    chunkerRef.current?.stop();
    chunkerRef.current = null;
    end();
  };

  const toggleAiScamCheck = () => {
    setAiScamCheckEnabled(!aiScamCheckEnabled);
    toast({
      title: aiScamCheckEnabled ? "AI Scam Check Disabled" : "AI Scam Check Enabled",
      description: aiScamCheckEnabled 
        ? "Using local scam detection only" 
        : "Using AI-enhanced scam analysis"
    });
  };

  useEffect(() => {
    return () => {
      chunkerRef.current?.stop();
      chunkerRef.current = null;
    };
  }, []);

  // Ensure popup opens whenever risk goes above 50%
  useEffect(() => {
    if (riskValue > 50 && !alertShownRef.current) {
      alertShownRef.current = true;
      setShowScamAlert(true);
    }
  }, [riskValue]);

  // Reset popup state when switching rooms
  useEffect(() => {
    alertShownRef.current = false;
    setShowScamAlert(false);
    sensitiveAlertShownRef.current = false;
    setSensitiveAlertOpen(false);
  }, [id]);

  useEffect(() => {
    if (!btDialogOpen) return;
    const check = async () => {
      try {
        const avail = await (navigator as any).bluetooth?.getAvailability?.();
        setBtAvailable(!!avail);
      } catch {
        setBtAvailable(false);
      }
    };
    check();
  }, [btDialogOpen]);

  return (
    <main className="min-h-screen container py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Call Room</h1>
      <p className="text-muted-foreground mt-1">Room ID: {id}</p>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Live Call</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-lg overflow-hidden border bg-card">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full aspect-video bg-muted" />
                <div className="p-3 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Local</div>
                  <Button variant="secondary" onClick={handleStart}>Enable Camera & Connect</Button>
                </div>
              </div>
              <div className="rounded-lg overflow-hidden border bg-card">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full aspect-video bg-muted" />
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Remote</div>
                    <div className="text-xs text-muted-foreground">{connected ? "Connected" : "Not connected"}</div>
                  </div>
                  {!connected && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        aria-label="Connect via USB"
                        title="Connect via USB"
                        onClick={() => setUsbDialogOpen(true)}
                      >
                        <Usb />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        aria-label="Connect via Bluetooth"
                        title="Connect via Bluetooth"
                        onClick={() => setBtDialogOpen(true)}
                      >
                        <Bluetooth />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Call Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleStart}>Enable Camera & Connect</Button>
                    <Button variant={micEnabled ? "secondary" : "destructive"} onClick={toggleMic}>
                      {micEnabled ? "Mute Mic" : "Unmute Mic"}
                    </Button>
                    <Button variant={camEnabled ? "secondary" : "destructive"} onClick={toggleCam}>
                      {camEnabled ? "Turn Off Camera" : "Turn On Camera"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(window.location.href);
                          toast({ title: "Link copied", description: "Share this link to invite" });
                        } catch {}
                      }}
                    >
                      Copy Call Link
                    </Button>
                    <Button variant="destructive" onClick={handleEnd}>End Call</Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Status: {connected ? "Connected" : "Waiting..."} • Participants: {presenceCount} {role ? `• You are ${role}` : ""}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 flex justify-end">
              <Button variant="destructive" onClick={handleEnd}>End</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Language</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Detected: {detectedLang ? `${detectedLang.name} (${detectedLang.code})` : "Detecting..."}
              </div>
              <LanguageSelector
                detected={detectedLang}
                selected={selectedLang}
                onChange={(code) => setSelectedLang(code)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live Transcript</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto pr-2">
              <TranscriptList items={transcripts} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scam Detection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {aiScamCheckEnabled 
                  ? "Using AI-enhanced scam detection with Gemini" 
                  : "Using local scam pattern database"}
              </p>
              <Button 
                onClick={toggleAiScamCheck}
                variant={aiScamCheckEnabled ? "destructive" : "default"}
                className="w-full"
              >
                {aiScamCheckEnabled ? "Disable AI Scam Check" : "Activate Scam AI"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distractor Agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                {!agent.active ? (
                  <Button onClick={agent.start} className="w-full">Start Distracting Agent</Button>
                ) : (
                  <>
                    <Button variant="destructive" onClick={agent.stop}>Stop Agent</Button>
                    <Button variant="secondary" onClick={agent.replyNow}>Speak Now</Button>
                  </>
                )}
              </div>
              <div className="max-h-60 overflow-y-auto rounded-md border bg-card/50 p-2">
                {agent.messages.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No agent activity yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {agent.messages.map((m) => (
                      <li key={m.id} className="text-sm">
                        <span className={m.who === 'agent' ? 'text-primary font-medium' : 'text-muted-foreground'}>
                          {m.who === 'agent' ? 'Agent' : 'Scammer'}:
                        </span>
                        <span className="ml-2">{m.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Online (Gemini via Supabase) when available; falls back to local LLM+TTS. Replaces your mic while speaking.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="fixed top-6 right-6 z-50 flex flex-row gap-3">
        <Button 
          onClick={toggleAiScamCheck}
          variant={aiScamCheckEnabled ? "destructive" : "default"}
          aria-label={aiScamCheckEnabled ? "Disable Scam AI" : "Activate Scam AI"}
        >
          {aiScamCheckEnabled ? "Disable Scam AI" : "Activate Scam AI"}
        </Button>
        <Button 
          variant={agent.active ? "destructive" : "secondary"}
          onClick={() => (agent.active ? agent.stop() : agent.start())}
          aria-label="Toggle Distracting Agent"
        >
          {agent.active ? "Stop Agent" : "Distracting Agent"}
        </Button>
      </div>

      <AlertDialog open={showScamAlert} onOpenChange={setShowScamAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potential scam detected</AlertDialogTitle>
            <AlertDialogDescription>
              The conversation triggered high-risk keywords. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowScamAlert(false)}>
              Continue call
            </AlertDialogCancel>
            <Button
              onClick={() => {
                try { agent.start(); toast({ title: "Distracting agent started" }); } catch {}
                setShowScamAlert(false);
              }}
            >
              Start Distracting Agent
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowScamAlert(false);
                try { agent.stop(); } catch {}
                end();
                toast({ title: "Call ended" });
              }}
            >
              End call
            </Button>
            <AlertDialogAction
              onClick={() => {
                setShowScamAlert(false);
                try { agent.stop(); } catch {}
                end();
                toast({ title: "Reported as scam", description: "Thanks for letting us know." });
              }}
            >
              End & Report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={usbDialogOpen} onOpenChange={setUsbDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect a USB Webcam</DialogTitle>
            <DialogDescription>
              Plug in a USB webcam and grant permission to use it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setUsbDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                  stream.getTracks().forEach((t) => t.stop());
                  toast({ title: "USB webcam connected" });
                } catch (e) {
                  toast({ title: "Unable to access webcam", variant: "destructive" });
                } finally {
                  setUsbDialogOpen(false);
                }
              }}
            >
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={btDialogOpen} onOpenChange={setBtDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bluetooth devices</DialogTitle>
            <DialogDescription>
              {btAvailable === null
                ? "Checking Bluetooth availability..."
                : btAvailable
                ? "Bluetooth is on. Scan for nearby devices."
                : "Bluetooth is off or unsupported. Turn it on to scan."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {btDevices.length === 0 ? (
              <div className="text-sm text-muted-foreground">No devices yet.</div>
            ) : (
              <ul className="space-y-2">
                {btDevices.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-sm">
                    <span>{d.name}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        toast({ title: "Connected to device", description: d.name });
                        setBtDialogOpen(false);
                      }}
                    >
                      Connect
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setBtDialogOpen(false)}>Close</Button>
            <Button
              onClick={async () => {
                try {
                  const avail = await (navigator as any).bluetooth?.getAvailability?.();
                  setBtAvailable(!!avail);
                  const device = await (navigator as any).bluetooth?.requestDevice?.({ acceptAllDevices: true });
                  if (device) {
                    const id = device.id || Math.random().toString(36).slice(2);
                    const name = device.name || "Unnamed device";
                    setBtDevices((prev) => (prev.some((x) => x.id === id) ? prev : [...prev, { id, name }]));
                  }
                } catch (e) {
                  /* user canceled or unavailable */
                }
              }}
              disabled={btAvailable === false}
            >
              Scan for devices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={sensitiveAlertOpen} onOpenChange={setSensitiveAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>We muted your microphone</AlertDialogTitle>
            <AlertDialogDescription>
              We detected sensitive words like OTP or Password. Please do not share passwords or one-time codes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setSensitiveAlertOpen(false);
                if (!micEnabled) toggleMic();
              }}
            >
              Continue (I Trust the Source)
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSensitiveAlertOpen(false);
                try { agent.stop(); } catch {}
                end();
                toast({ title: "Reported", description: "Conversation reported and ended." });
              }}
            >
              Report and End
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RiskWidget value={riskValue} level={riskLevel} />
    </main>
  );
};

export default CallRoom;
