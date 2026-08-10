/**
 * AudioEngine — 100% procedural WebAudio (no external assets).
 * BGM: pentatonic savanna loop. SFX: spin / reel stop / win / tiers / roar / free spins.
 */

const VOLUME_KEY = "ab-m6-volume";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private bgmTimer: number | null = null;
  private ambientTimer: number | null = null;
  private bgmStep = 0;
  private muted = false;
  private volume = 0.8;
  private backgroundDimmed = false;
  private spinNoise: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  constructor() {
    try {
      if (typeof localStorage !== "undefined") {
        const v = Number(localStorage.getItem(VOLUME_KEY));
        if (Number.isFinite(v) && v >= 0 && v <= 1) this.volume = v;
      }
    } catch {
      /* ignore */
    }
  }

  private targetMaster(): number {
    if (this.muted) return 0;
    return this.volume * (this.backgroundDimmed ? 0.15 : 1);
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.targetMaster();
      this.master.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.32;
      this.bgmGain.connect(this.master);
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.12;
      this.ambientGain.connect(this.master);
    } catch {
      return null;
    }
    return this.ctx;
  }

  /** must be called from a user gesture — never recreates an existing context */
  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyMaster();
  }
  get isMuted(): boolean { return this.muted; }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    try {
      localStorage.setItem(VOLUME_KEY, String(this.volume));
    } catch {
      /* ignore */
    }
    this.applyMaster();
  }
  getVolume(): number {
    return this.volume;
  }

  /** Page hidden → dim; never tears down AudioContext. */
  setBackgroundDimmed(dim: boolean): void {
    this.backgroundDimmed = dim;
    this.applyMaster();
  }

  private applyMaster(): void {
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(
        this.targetMaster(),
        this.ctx.currentTime + 0.15,
      );
    }
  }

  // ---------------- Ambient (wind / birds — soft procedural) ----------------
  startAmbient(): void {
    const ctx = this.ensure();
    if (!ctx || !this.ambientGain || this.ambientTimer !== null) return;
    const tick = () => {
      if (!this.ctx || !this.ambientGain) return;
      const t0 = this.ctx.currentTime;
      // soft wind noise puff
      this.noiseBurst(0.9, 0.04, 400, "lowpass");
      // occasional bird chirp
      if (Math.random() < 0.35) {
        const f = 1800 + Math.random() * 900;
        this.note(f, t0, 0.12, 0.05, "sine", 0.01, this.ambientGain);
        this.note(f * 1.25, t0 + 0.08, 0.1, 0.04, "sine", 0.01, this.ambientGain);
      }
    };
    tick();
    this.ambientTimer = window.setInterval(tick, 2200 + Math.random() * 800);
  }

  stopAmbient(): void {
    if (this.ambientTimer !== null) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  // ---------------- BGM ----------------
  startBgm(): void {
    const ctx = this.ensure();
    if (!ctx || this.bgmTimer !== null) return;
    this.startAmbient();
    // pentatonic flute-ish melody (C major pentatonic), 8 steps per bar
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
    const melody = [0, 2, 4, 7, 4, 2, 5, 4, 0, 2, 4, 5, 7, 5, 4, 2];
    const stepDur = 0.42;
    const tick = () => {
      if (!this.ctx || !this.bgmGain) return;
      const t0 = this.ctx.currentTime;
      const step = this.bgmStep % melody.length;
      const f = scale[melody[step]];
      // lead (soft flute: sine + vibrato)
      this.note(f, t0, stepDur * 0.95, 0.16, "sine", 0.012);
      this.note(f * 2, t0, stepDur * 0.6, 0.04, "sine", 0.02);
      // low drone every bar start
      if (step % 8 === 0) this.note(f / 4, t0, stepDur * 7.5, 0.12, "triangle", 0.02);
      // soft drum on steps 0 and 5 of bar
      if (step % 8 === 0 || step % 8 === 5) this.drum(t0);
      this.bgmStep++;
    };
    tick();
    this.bgmTimer = window.setInterval(tick, stepDur * 1000);
  }

  stopBgm(): void {
    if (this.bgmTimer !== null) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
    this.stopAmbient();
  }

  private note(freq: number, t0: number, dur: number, vol: number, type: OscillatorType, attack: number, dest?: AudioNode): void {
    if (!this.ctx) return;
    const out = dest ?? this.bgmGain ?? this.master;
    if (!out) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    // gentle vibrato
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.value = 5.5;
    lfoG.gain.value = freq * 0.006;
    lfo.connect(lfoG).connect(osc.frequency);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(out);
    osc.start(t0); lfo.start(t0);
    osc.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
  }

  private drum(t0: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, t0);
    osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.18);
    g.gain.setValueAtTime(0.22, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    osc.connect(g).connect(this.bgmGain);
    osc.start(t0); osc.stop(t0 + 0.25);
  }

  // ---------------- SFX helpers ----------------
  private sfxGain(vol: number): GainNode | null {
    if (!this.ensure() || !this.master) return null;
    const g = this.ctx!.createGain();
    g.gain.value = vol;
    g.connect(this.master);
    return g;
  }

  private blip(freqs: number[], stepDur: number, vol: number, type: OscillatorType = "triangle"): void {
    const out = this.sfxGain(vol);
    if (!out || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = type; osc.frequency.value = f;
      const ts = t0 + i * stepDur;
      g.gain.setValueAtTime(0.0001, ts);
      g.gain.linearRampToValueAtTime(1, ts + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ts + stepDur * 1.8);
      osc.connect(g).connect(out);
      osc.start(ts); osc.stop(ts + stepDur * 2);
    });
  }

  private noiseBurst(dur: number, vol: number, filterFreq: number, type: BiquadFilterType = "bandpass"): void {
    const out = this.sfxGain(vol);
    if (!out || !this.ctx) return;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = type; flt.frequency.value = filterFreq; flt.Q.value = 1.2;
    src.connect(flt).connect(out);
    src.start();
  }

  // ---------------- Game SFX ----------------
  uiClick(): void { this.blip([880, 1320], 0.05, 0.18, "square"); }
  betStep(): void { this.blip([660], 0.05, 0.15, "square"); }

  spinStart(): void {
    this.stopSpinLoop();
    const out = this.sfxGain(0.5);
    if (!out || !this.ctx) return;
    const ctx = this.ctx;
    // looping wind-up noise
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = "bandpass"; flt.frequency.value = 900; flt.Q.value = 2;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    g.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.3);
    src.connect(flt).connect(g).connect(out);
    src.start();
    this.spinNoise = { src, gain: g };
  }

  stopSpinLoop(): void {
    if (this.spinNoise && this.ctx) {
      try {
        this.spinNoise.gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.15);
        const s = this.spinNoise.src;
        setTimeout(() => { try { s.stop(); } catch { /* noop */ } }, 250);
      } catch { /* noop */ }
      this.spinNoise = null;
    }
  }

  reelStop(): void {
    this.blip([180, 90], 0.04, 0.35, "sine");
    this.noiseBurst(0.08, 0.12, 2400, "highpass");
  }

  winSmall(): void { this.blip([523, 659, 784, 1047], 0.09, 0.3); }
  scatterLand(): void { this.blip([1568, 2093], 0.08, 0.3, "sine"); }

  /** Soft animal / special SFX — presentation only, never blocks gameplay. */
  animalCue(kind: "buffalo" | "lion" | "elephant" | "zebra" | "antelope" | "wild" | "scatter"): void {
    try {
      switch (kind) {
        case "buffalo":
          this.blip([90, 70], 0.12, 0.22, "sawtooth");
          this.noiseBurst(0.25, 0.1, 280, "lowpass");
          break;
        case "lion":
          this.blip([120, 85], 0.14, 0.2, "sawtooth");
          break;
        case "elephant":
          this.blip([220, 180, 140], 0.16, 0.22, "sine");
          break;
        case "zebra":
        case "antelope":
          this.blip([640, 720], 0.06, 0.14, "triangle");
          break;
        case "wild":
          this.blip([880, 1320, 1760], 0.07, 0.22, "sine");
          break;
        case "scatter":
          this.blip([1175, 1568, 2093], 0.09, 0.28, "sine");
          break;
        default:
          break;
      }
    } catch {
      /* audio failure must never block spins */
    }
  }

  bigWin(): void {
    this.blip([523, 659, 784, 1047, 1319, 1568], 0.11, 0.4);
    setTimeout(() => this.blip([784, 988, 1175, 1568, 2093], 0.11, 0.35), 500);
  }
  megaWin(): void {
    this.bigWin();
    setTimeout(() => this.blip([659, 831, 988, 1319, 1661, 2093, 2637], 0.1, 0.4), 900);
  }
  ultraWin(): void {
    this.megaWin();
    setTimeout(() => this.noiseBurst(1.2, 0.2, 5000, "highpass"), 800);
    setTimeout(() => this.blip([1047, 1319, 1568, 2093, 2637, 3136], 0.09, 0.42), 1400);
  }
  jackpot(): void {
    this.ultraWin();
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.blip([523, 784, 1047, 1568], 0.08, 0.35), 400 + i * 350);
    }
  }

  freeSpinTrigger(): void {
    this.blip([392, 523, 659, 784, 1047, 1319, 1568, 2093], 0.12, 0.4, "sine");
  }

  /** buffalo roar: low sawtooth + growl noise, pitch envelope */
  roar(): void {
    const out = this.sfxGain(0.65);
    if (!out || !this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.5, t0 + 0.12);
    g.gain.setValueAtTime(0.45, t0 + 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
    const flt = ctx.createBiquadFilter();
    flt.type = "lowpass"; flt.frequency.value = 500;
    // growl AM
    const am = ctx.createOscillator();
    const amG = ctx.createGain();
    am.frequency.value = 28; amG.gain.value = 0.25;
    am.connect(amG).connect(g.gain);
    osc.connect(flt).connect(g).connect(out);
    osc.start(t0); am.start(t0);
    osc.stop(t0 + 1.05); am.stop(t0 + 1.05);
    this.noiseBurst(0.9, 0.18, 300, "lowpass");
  }
}

export const audio = new AudioEngine();
