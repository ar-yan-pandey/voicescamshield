
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

  const { connected, presenceCount, role, start, end } = useWebRTCRoom(id || "default", localVideoRef, remoteVideoRef);

  const computeRisk = useCallback((items: TranscriptItem[]) => {
    if (items.length === 0) return { value: 0, level: "low" as RiskLevel };
    const weights = { low: 0.2, medium: 0.6, high: 0.9 } as const;
    const v = items.reduce((acc, it) => acc + weights[it.risk], 0) / items.length;
    const pct = Math.round(v * 100);
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
              // Auto-detect language from transcript when not manually set
              if (!selectedLang) {
                const det = detectLanguageFromText(data.text);
                if (det) setDetectedLang(det);
              }

              let riskLabel: RiskLevel;
              let riskScore: number;
              
              if (aiScamCheckEnabled && data.risk_label != null && data.risk_score != null) {
                // Use AI analysis if enabled and available
                riskLabel = data.risk_label as RiskLevel;
                riskScore = data.risk_score;
              } else {
                // Use local scam detection
                const localAnalysis = detectScamLocally(data.text);
                riskScore = localAnalysis.score;
                riskLabel = getRiskLevel(riskScore);
              }
              
              const item: TranscriptItem = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                text: data.text,
                timestamp: new Date().toLocaleTimeString(),
                risk: riskLabel,
                score: riskScore,
              };
              
              setTranscripts((prev) => {
                const next = [item, ...prev].slice(0, 100);
                const { value, level } = computeRisk(next);
                setRiskValue(value);
                setRiskLevel(level);
                return next;
              });
            }
          } catch (e) {
            console.error("Transcription error", e);
          }
        }, 1000);
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
                <div className="p-3 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Remote</div>
                  <div className="text-xs text-muted-foreground">{connected ? "Connected" : "Not connected"}</div>
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
              <p className="text-sm text-muted-foreground">Trigger a voice bot from your side to safely disengage. Requires backend integration.</p>
              <Button onClick={() => toast({ title: "Agent requested", description: "Will activate once backend is connected" })}>Trigger Agent</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <RiskWidget value={riskValue} level={riskLevel} />
    </main>
  );
};

export default CallRoom;
