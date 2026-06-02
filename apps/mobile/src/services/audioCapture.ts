/**
 * Audio capture abstraction.
 *
 * The native recording layer (AVAudioEngine on iOS / AudioRecord on Android)
 * is fronted by this interface so the rest of the app — and the test suite —
 * depends only on a small, mockable contract. A real implementation would be
 * backed by a native module that emits base64-encoded PCM/Opus chunks; the
 * default implementation here is a deterministic stub used in JS-only contexts.
 */
export interface AudioChunkListener {
  (chunk: { seq: number; data: string }): void;
}

export interface AudioCapture {
  /** Begin streaming audio chunks to the listener. */
  start(onChunk: AudioChunkListener): Promise<void>;
  /** Stop streaming and release the microphone. */
  stop(): Promise<void>;
  /** Whether capture is currently active. */
  isActive(): boolean;
  /** Latest normalized amplitude in [0,1], for waveform rendering. */
  amplitude(): number;
}

/**
 * Stub capture used until the native module is wired (see README). Emits
 * synthetic chunks on an interval so the UI/data flow can be exercised.
 */
export class StubAudioCapture implements AudioCapture {
  private timer: ReturnType<typeof setInterval> | null = null;
  private seq = 0;
  private level = 0;

  async start(onChunk: AudioChunkListener): Promise<void> {
    this.seq = 0;
    this.timer = setInterval(() => {
      this.level = Math.random();
      const data = Buffer.from(`chunk-${this.seq}`).toString('base64');
      onChunk({ seq: this.seq, data });
      this.seq += 1;
    }, 500);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.level = 0;
  }

  isActive(): boolean {
    return this.timer !== null;
  }

  amplitude(): number {
    return this.level;
  }
}

export const audioCapture: AudioCapture = new StubAudioCapture();
