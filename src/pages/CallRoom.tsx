import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import TranscriptList, { TranscriptItem, RiskLevel } from "@/components/TranscriptList";
import RiskWidget from "@/components/RiskWidget";
import { toast } from "@/hooks/use-toast";
import { useWebRTCRoom } from "@/hooks/useWebRTCRoom";

const CallRoom: React.FC = () => {
  const { id } = useParams();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);


  const [simulate, setSimulate] = useState(true);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [riskValue, setRiskValue] = useState(0);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("low");

  const { connected, presenceCount, role, start, end } = useWebRTCRoom(id || "default", localVideoRef, remoteVideoRef);

  const computeRisk = useCallback((items: TranscriptItem[]) => {
    if (items.length === 0) return { value: 0, level: "low" as RiskLevel };
    const weights = { low: 0.2, medium: 0.6, high: 0.9 } as const;
    const v =
      items.reduce((acc, it) => acc + weights[it.risk], 0) / items.length;
    const pct = Math.round(v * 100);
    const lvl: RiskLevel = pct >= 70 ? "high" : pct >= 35 ? "medium" : "low";
    return { value: pct, level: lvl };
  }, []);

  useEffect(() => {
    if (!simulate) return;
    const phrases = [
      "Hi, I'm from your bank, there's an issue with your account",
      "We detected unusual activity, please verify your credentials",
      "You won a prize! Just pay a small fee to claim it",
      "This is a confirmation of your recent purchase",
      "Please do not share your OTP with anyone",
    ];
    const idBase = Date.now();
    const t = setInterval(() => {
      const riskRand = Math.random();
      const risk: RiskLevel = riskRand > 0.8 ? "high" : riskRand > 0.5 ? "medium" : "low";
      const score = risk === "high" ? 0.85 + Math.random() * 0.15 : risk === "medium" ? 0.45 + Math.random() * 0.2 : 0.1 + Math.random() * 0.2;
      const item: TranscriptItem = {
        id: `${idBase}-${Math.random().toString(36).slice(2)}`,
        text: phrases[Math.floor(Math.random() * phrases.length)],
        timestamp: new Date().toLocaleTimeString(),
        risk,
        score,
      };
      setTranscripts((prev) => {
        const next = [item, ...prev].slice(0, 100);
        const { value, level } = computeRisk(next);
        setRiskValue(value);
        setRiskLevel(level);
        if (item.risk === "high") {
          toast({
            title: "Potential scam detected",
            description: "High-risk language or deepfake suspected",
          });
        }
        return next;
      });
    }, 2500);
    return () => clearInterval(t);
  }, [simulate, computeRisk]);









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
                  <Button variant="secondary" onClick={start}>Enable Camera & Connect</Button>
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
                    <Button onClick={start}>Enable Camera & Connect</Button>
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
                    <Button variant="destructive" onClick={end}>End Call</Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Status: {connected ? "Connected" : "Waiting..."} • Participants: {presenceCount} {role ? `• You are ${role}` : ""}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch id="simulate" checked={simulate} onCheckedChange={setSimulate} />
                <Label htmlFor="simulate">Simulate analysis (until Supabase is connected)</Label>
              </div>
              <Button variant="destructive" onClick={end}>End</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <TranscriptList items={transcripts} />
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
