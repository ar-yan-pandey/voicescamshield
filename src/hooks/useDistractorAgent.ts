import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreateMLCEngine, type MLCEngineInterface } from "@mlc-ai/web-llm";
import * as tts from "@mintplex-labs/piper-tts-web";

export interface AgentMessage {
  id: string;
  who: "scammer" | "agent";
  text: string;
  ts: number;
}

interface UseDistractorAgentOptions {
  transcripts: { id: string; text: string; timestamp?: string; language?: string }[];
  replaceAudioTrack: (track: MediaStreamTrack) => Promise<void>;
  restoreAudioTrack: () => Promise<void>;
  targetLang?: string | null; // ISO code if available
}

export const useDistractorAgent = ({ transcripts, replaceAudioTrack, restoreAudioTrack, targetLang }: UseDistractorAgentOptions) => {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const engineRef = useRef<MLCEngineInterface | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const voiceIdRef = useRef<string>("en_US-hfc_female-medium");
  const processingRef = useRef(false);
  const lastTranscriptIdRef = useRef<string | null>(null);

  // Small, fast model id known to work in WebLLM prebuilt set. Users can change later.
  const modelId = useMemo(() => "Phi-2-q4f16_1-MLC", []);

  const ensureEngine = useCallback(async () => {
    if (engineRef.current) return engineRef.current;
    setLoading(true);
    try {
      const engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (p) => {
          // optional: progress hook
          // console.log(p);
        },
      });
      engineRef.current = engine;
      return engine;
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  const ensureAudioGraph = useCallback(async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate: 48000 });
    }
    if (!destRef.current) {
      destRef.current = audioCtxRef.current.createMediaStreamDestination();
      const track = destRef.current.stream.getAudioTracks()[0];
      await replaceAudioTrack(track);
    }
    return { ctx: audioCtxRef.current, dest: destRef.current };
  }, [replaceAudioTrack]);

  const speak = useCallback(async (text: string) => {
    const { ctx, dest } = await ensureAudioGraph();
    // Generate WAV blob via Piper
    const wavBlob = await tts.predict({ text, voiceId: voiceIdRef.current });
    const arrBuf = await wavBlob.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrBuf);
    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(dest);
    src.start();
    return new Promise<void>((resolve) => {
      src.onended = () => resolve();
    });
  }, [ensureAudioGraph]);

  const generateReply = useCallback(async (input: string) => {
    const engine = await ensureEngine();
    const system = `You are a stalling assistant. Reply in the same language briefly (6-12 words), polite but evasive, ask for repetition, create harmless delays. Avoid revealing personal info.`;
    const messages = [
      { role: "system", content: system },
      { role: "user", content: `Scammer said: ${input}\nReply (${targetLang || "same language"}), super short.` },
    ];
    const out = await engine.chat.completions.create({ messages, temperature: 0.8 });
    const text = (out.choices?.[0]?.message?.content as string || "").trim().replace(/^"|"$/g, "");
    return text.slice(0, 160);
  }, [ensureEngine, targetLang]);

  const start = useCallback(async () => {
    if (active) return;
    await ensureEngine();
    // Preload voice (will cache to OPFS)
    try {
      await tts.download(voiceIdRef.current, () => {});
    } catch {}
    await ensureAudioGraph();
    setActive(true);
  }, [active, ensureAudioGraph, ensureEngine]);

  const stop = useCallback(async () => {
    setActive(false);
    processingRef.current = false;
    if (destRef.current) {
      try { await restoreAudioTrack(); } catch {}
    }
  }, [restoreAudioTrack]);

  const replyNow = useCallback(async () => {
    if (!active || processingRef.current) return;
    const last = transcripts[0];
    const input = last?.text || "Can you repeat that?";
    processingRef.current = true;
    try {
      setMessages((m) => [{ id: crypto.randomUUID(), who: "scammer", text: input, ts: Date.now() }, ...m]);
      const reply = await generateReply(input);
      setMessages((m) => [{ id: crypto.randomUUID(), who: "agent", text: reply, ts: Date.now() }, ...m]);
      await speak(reply);
    } finally {
      processingRef.current = false;
    }
  }, [active, transcripts, generateReply, speak]);

  // Auto-loop: when new transcript arrives, respond once.
  useEffect(() => {
    if (!active || transcripts.length === 0) return;
    const latest = transcripts[0];
    if (!latest || latest.id === lastTranscriptIdRef.current) return;
    lastTranscriptIdRef.current = latest.id;
    // Fire and forget
    replyNow();
  }, [active, transcripts, replyNow]);

  useEffect(() => {
    return () => {
      try { restoreAudioTrack(); } catch {}
      engineRef.current = null as any;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      destRef.current = null;
    };
  }, [restoreAudioTrack]);

  return { active, loading, messages, start, stop, replyNow } as const;
};
