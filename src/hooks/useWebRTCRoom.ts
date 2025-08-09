import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Basic STUN servers to assist NAT traversal
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] },
];

type Role = "caller" | "callee";

type WebRTCPayload =
  | { action: "offer"; sdp: RTCSessionDescriptionInit; from: string }
  | { action: "answer"; sdp: RTCSessionDescriptionInit; from: string }
  | { action: "ice"; candidate: RTCIceCandidateInit; from: string }
  | { action: "end"; from: string };

export const useWebRTCRoom = (
  roomId: string,
  localVideoRef: React.RefObject<HTMLVideoElement>,
  remoteVideoRef: React.RefObject<HTMLVideoElement>
) => {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const [presenceCount, setPresenceCount] = useState(0);
  const [role, setRole] = useState<Role | null>(null);
  const clientId = useMemo(() => crypto.randomUUID(), []);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSet = useRef(false);

  const cleanupMedia = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  const ensurePC = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      setConnected(pc.connectionState === "connected");
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    };

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      const payload: WebRTCPayload = {
        action: "ice",
        candidate: ev.candidate.toJSON(),
        from: clientId,
      };
      channelRef.current?.send({ type: "broadcast", event: "webrtc", payload });
    };

    return pc;
  }, [clientId, remoteVideoRef]);

  const addPendingCandidatesIfAny = async (pc: RTCPeerConnection) => {
    for (const c of pendingCandidates.current) {
      try {
        await pc.addIceCandidate(c);
      } catch (e) {
        console.warn("Failed to add buffered ICE candidate", e);
      }
    }
    pendingCandidates.current = [];
  };

  const startLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }, [localVideoRef]);

  const handleBroadcast = useCallback(
    async (raw: any) => {
      const payload = raw as WebRTCPayload;
      if (payload.from === clientId) return; // ignore self
      const pc = ensurePC();

      if (payload.action === "offer") {
        try {
          if (!localStreamRef.current) {
            const stream = await startLocalMedia();
            stream.getTracks().forEach((t) => pc.addTrack(t, stream));
          }
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          remoteDescSet.current = true;
          await addPendingCandidatesIfAny(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          const resp: WebRTCPayload = { action: "answer", sdp: answer, from: clientId };
          channelRef.current?.send({ type: "broadcast", event: "webrtc", payload: resp });
          setRole("callee");
        } catch (e) {
          console.error("Error handling offer:", e);
          toast({ title: "Connection error", description: "Failed to handle offer", variant: "destructive" });
        }
      } else if (payload.action === "answer") {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          remoteDescSet.current = true;
          await addPendingCandidatesIfAny(pc);
        } catch (e) {
          console.error("Error applying answer:", e);
        }
      } else if (payload.action === "ice") {
        try {
          if (remoteDescSet.current) {
            await pc.addIceCandidate(payload.candidate);
          } else {
            pendingCandidates.current.push(payload.candidate);
          }
        } catch (e) {
          console.warn("Failed to add ICE candidate", e);
        }
      } else if (payload.action === "end") {
        end();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientId, ensurePC]
  );

  const setupChannel = useCallback(async () => {
    if (channelRef.current) return channelRef.current;
    const channel = supabase.channel(`call:${roomId}`, {
      config: { presence: { key: clientId } },
    });

    channel
      .on("broadcast", { event: "webrtc" }, ({ payload }) => handleBroadcast(payload))
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setPresenceCount(count);
      })
      .on("presence", { event: "join" }, async () => {
        // If we were first, and someone joined, create an offer
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        if (count >= 2 && role === "caller") {
          const pc = ensurePC();
          if (!localStreamRef.current) {
            const stream = await startLocalMedia();
            stream.getTracks().forEach((t) => pc.addTrack(t, stream));
          }
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
          await pc.setLocalDescription(offer);
          const payload: WebRTCPayload = { action: "offer", sdp: offer, from: clientId };
          channel.send({ type: "broadcast", event: "webrtc", payload });
        }
      });

    await channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      await channel.track({ clientId, joined_at: new Date().toISOString() });

      // Determine role based on presence count after tracking
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      setPresenceCount(count);
      setRole(count === 1 ? "caller" : "callee");

      // If we are callee and an offer already exists, we'll get it via broadcast
    });

    channelRef.current = channel;
    return channel;
  }, [clientId, ensurePC, roomId, role, startLocalMedia, handleBroadcast]);

  const start = useCallback(async () => {
    try {
      const pc = ensurePC();
      const stream = await startLocalMedia();
      // Avoid adding duplicate tracks
      if (pc.getSenders().length === 0) {
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      }
      await setupChannel();
      toast({ title: "Ready", description: "Waiting for the other participant" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to start media", variant: "destructive" });
    }
  }, [ensurePC, setupChannel, startLocalMedia]);

  const end = useCallback(() => {
    try {
      const payload: WebRTCPayload = { action: "end", from: clientId };
      channelRef.current?.send({ type: "broadcast", event: "webrtc", payload });
    } catch {}
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    cleanupMedia();
    setConnected(false);
    setRole(null);
    setPresenceCount(0);
  }, [clientId]);

  useEffect(() => {
    return () => {
      end();
    };
  }, [end]);

  return { connected, presenceCount, role, start, end } as const;
};
