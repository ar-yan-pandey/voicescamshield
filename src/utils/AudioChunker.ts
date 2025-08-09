export class AudioChunker {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private buffer: Float32Array[] = [];
  private flushTimer: number | null = null;
  private paused = false;

  constructor(private onChunk: (base64Wav: string) => void | Promise<void>, private chunkMs = 3000) {}

  async start() {
    // 24kHz mono input
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 24000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.audioContext = new AudioContext({ sampleRate: 24000 });
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (this.paused) return;
      const input = e.inputBuffer.getChannelData(0);
      this.buffer.push(new Float32Array(input));
    };
    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.flushTimer = window.setInterval(() => this.flush(), this.chunkMs);
  }

  stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.buffer = [];
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) this.buffer = [];
  }

  private flush() {
    if (this.paused || this.buffer.length === 0) return;
    // Concatenate Float32
    const length = this.buffer.reduce((acc, b) => acc + b.length, 0);
    const combined = new Float32Array(length);
    let offset = 0;
    for (const b of this.buffer) {
      combined.set(b, offset);
      offset += b.length;
    }
    this.buffer = [];

    const wavBytes = this.floatTo16BitWav(combined, 24000);
    const base64 = this.uint8ToBase64(wavBytes);
    try {
      this.onChunk(base64);
    } catch (e) {
      console.error("AudioChunker onChunk error", e);
    }
  }

  private floatTo16BitWav(float32: Float32Array, sampleRate: number): Uint8Array {
    const bytesPerSample = 2;
    const numChannels = 1;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = float32.length * bytesPerSample;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, "WAVE");

    // fmt chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // format = PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample

    // data chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, dataSize, true);

    // PCM samples
    const output = new Int16Array(buffer, 44, float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    return new Uint8Array(buffer);
  }

  private writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  private uint8ToBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  }
}
