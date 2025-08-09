import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import TranscriptList, { TranscriptItem, RiskLevel } from "@/components/TranscriptList";
import RiskWidget from "@/components/RiskWidget";
import { toast } from "@/hooks/use-toast";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] },
];

const CallRoom: React.FC = () => {
  const { id } = useParams();

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);

  const [offerSdp, setOfferSdp] = useState("");
  const [answerSdp, setAnswerSdp] = useState("");
  const [remoteOffer, setRemoteOffer] = useState("");
  const [remoteAnswer, setRemoteAnswer] = useState("");

  const [simulate, setSimulate] = useState(true);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [riskValue, setRiskValue] = useState(0);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("low");

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

  const ensurePC = useCallback(() => {
    if (!pcRef.current) {
      pcRef.current = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const pc = pcRef.current;
      pc.onconnectionstatechange = () => {
        setConnected(pc.connectionState === "connected");
      };
      pc.ontrack = (ev) => {
        const stream = ev.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      };
    }
    return pcRef.current;
  }, []);

  const startMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    setLocalStream(stream);
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    const pc = ensurePC();
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  }, [ensurePC]);

  const waitForIceComplete = (pc: RTCPeerConnection) =>
    new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const check = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", check);
          resolve();
        }
      };
      pc.addEventListener("icegatheringstatechange", check);
    });

  const createOffer = useCallback(async () => {
    if (!localStream) await startMedia();
    const pc = ensurePC();
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    await waitForIceComplete(pc);
    const sdp = JSON.stringify(pc.localDescription);
    setOfferSdp(btoa(sdp));
    toast({ title: "Offer ready", description: "Share this with the other browser" });
  }, [ensurePC, localStream, startMedia]);

  const createAnswer = useCallback(async () => {
    const pc = ensurePC();
    if (!remoteOffer) return;
    const offer = JSON.parse(atob(remoteOffer));
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    if (!localStream) await startMedia();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceComplete(pc);
    setAnswerSdp(btoa(JSON.stringify(pc.localDescription)));
    toast({ title: "Answer ready", description: "Send back to the offerer" });
  }, [ensurePC, remoteOffer, localStream, startMedia]);

  const applyAnswer = useCallback(async () => {
    const pc = ensurePC();
    if (!remoteAnswer) return;
    const ans = JSON.parse(atob(remoteAnswer));
    await pc.setRemoteDescription(new RTCSessionDescription(ans));
    toast({ title: "Connected", description: "Peer connection established" });
  }, [ensurePC, remoteAnswer]);

  const stopAll = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setConnected(false);
    setOfferSdp("");
    setAnswerSdp("");
    setRemoteOffer("");
    setRemoteAnswer("");
  }, [localStream]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "SDP copied to clipboard" });
    } catch {}
  };

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
                  <Button variant="secondary" onClick={startMedia}>Enable Camera & Mic</Button>
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

            <div className="mt-6 grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Initiator: Create Offer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button onClick={createOffer} className="w-full">Create Offer</Button>
                  <Textarea value={offerSdp} onChange={(e) => setOfferSdp(e.target.value)} placeholder="Offer (base64)" rows={5} />
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => copy(offerSdp)}>Copy</Button>
                    <Input value={remoteAnswer} onChange={(e) => setRemoteAnswer(e.target.value)} placeholder="Paste Answer (base64)" />
                    <Button onClick={applyAnswer}>Apply Answer</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Joiner: Paste Offer & Create Answer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input value={remoteOffer} onChange={(e) => setRemoteOffer(e.target.value)} placeholder="Paste Offer (base64)" />
                  <div className="flex gap-2">
                    <Button onClick={createAnswer}>Create Answer</Button>
                    <Textarea value={answerSdp} onChange={(e) => setAnswerSdp(e.target.value)} placeholder="Answer (base64)" rows={5} />
                    <Button variant="secondary" onClick={() => copy(answerSdp)}>Copy</Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch id="simulate" checked={simulate} onCheckedChange={setSimulate} />
                <Label htmlFor="simulate">Simulate analysis (until Supabase is connected)</Label>
              </div>
              <Button variant="destructive" onClick={stopAll}>End</Button>
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
