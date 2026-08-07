/**
 * M6-5 · 程序化音效引擎（WebAudio，零音频资产）
 * 覆盖：BGM / 环境音 / 水牛 / Spin / 停止 / 免费旋转 / Jackpot。
 * 懒初始化：首次用户手势时 unlock()；全部音源实时合成，可整体静音。
 */

export type SfxName =
  | "click"
  | "spinStart"
  | "reelStop"
  | "roar"
  | "grunt"
  | "freeTrigger"
  | "freeSpinLoop"
  | "winSmall"
  | "bigWin"
  | "megaWin"
  | "ultraWin"
  | "jackpot"
  | "coinShower";

interface LoopHandle {
  stop: () => void;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private muted = false;
  private bgm: LoopHandle | null = null;
  private ambient: LoopHandle | null = null;
  private spinLoop: LoopHandle | null = null;
  private freeMode = false;

  get isMuted(): boolean {
    return this.muted;
  }

  /** 必须在用户手势内调用（浏览器自动播放策略） */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.8;
    this.sfxBus.connect(this.master);
    this.ambientBus = this.ctx.createGain();
    this.ambientBus.gain.value = 0.16;
    this.ambientBus.connect(this.master);
    this.startAmbient();
    this.startBgm();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }

  setFreeMode(on: boolean): void {
    this.freeMode = on;
    if (!this.ctx || !this.musicBus) return;
    this.musicBus.gain.setTargetAtTime(on ? 0.42 : 0.32, this.ctx.currentTime, 0.4);
  }

  dispose(): void {
    this.bgm?.stop();
    this.ambient?.stop();
    this.spinLoop?.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  // ---------- 公共 SFX ----------

  play(name: SfxName): void {
    if (!this.ctx) return;
    switch (name) {
      case "click": this.blip(660, 0.06, "square", 0.12); break;
      case "spinStart": this.spinStartSfx(); break;
      case "reelStop": this.reelStopSfx(); break;
      case "roar": this.roarSfx(); break;
      case "grunt": this.gruntSfx(); break;
      case "freeTrigger": this.freeTriggerSfx(); break;
      case "winSmall": this.winArp([523, 659, 784], 0.12); break;
      case "bigWin": this.winArp([392, 523, 659, 784, 1046], 0.16); break;
      case "megaWin": this.winArp([349, 440, 523, 659, 880, 1046, 1318], 0.18); break;
      case "ultraWin": this.winArp([330, 415, 494, 659, 830, 988, 1318, 1660], 0.2); break;
      case "jackpot": this.jackpotSfx(); break;
      case "coinShower": this.coinShowerSfx(); break;
      case "freeSpinLoop": break;
    }
  }

  startSpinLoop(): void {
    if (!this.ctx || this.spinLoop) return;
    const ctx = this.ctx;
    const noise = this.noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 11;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 500;
    lfo.connect(lfoGain).connect(bp.frequency);
    noise.connect(bp).connect(gain).connect(this.sfxBus!);
    noise.start();
    lfo.start();
    this.spinLoop = {
      stop: () => {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        window.setTimeout(() => { try { noise.stop(); lfo.stop(); } catch { /* stopped */ } }, 300);
      },
    };
  }

  stopSpinLoop(): void {
    this.spinLoop?.stop();
    this.spinLoop = null;
  }

  // ---------- 环境音：风 + 草 + 远处鸟叫 ----------

  private startAmbient(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = this.noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 400;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(lp.frequency);
    noise.connect(lp).connect(gain).connect(this.ambientBus!);
    noise.start();
    lfo.start();

    const birdTimer = window.setInterval(() => {
      if (!this.ctx || this.muted) return;
      if (Math.random() < 0.4) this.birdChirp();
    }, 6000);

    this.ambient = {
      stop: () => {
        window.clearInterval(birdTimer);
        try { noise.stop(); lfo.stop(); } catch { /* stopped */ }
      },
    };
  }

  private birdChirp(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const base = 2200 + Math.random() * 1400;
    osc.frequency.setValueAtTime(base, t);
    for (let i = 0; i < 3; i += 1) {
      osc.frequency.setValueAtTime(base + Math.random() * 600, t + i * 0.09);
      osc.frequency.exponentialRampToValueAtTime(base * 0.8, t + i * 0.09 + 0.07);
    }
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.03);
    gain.gain.setTargetAtTime(0, t + 0.25, 0.05);
    osc.connect(gain).connect(this.ambientBus!);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  // ---------- BGM：非洲鼓点 + 五声音阶氛围 ----------

  private startBgm(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    let step = 0;
    const pentatonic = this.freeMode
      ? [392, 440, 523, 587, 659]
      : [330, 392, 440, 523, 587];
    const timer = window.setInterval(() => {
      if (!this.ctx) return;
      const beat = step % 16;
      // 鼓：1、7、11 拍
      if (beat === 0 || beat === 6 || beat === 10) this.drumHit(beat === 0 ? 90 : 70);
      if (beat % 4 === 2) this.shaker();
      // 偶发旋律音
      if (beat % 2 === 0 && Math.random() < 0.55) {
        const scale = this.freeMode
          ? [392, 440, 523, 587, 659, 784]
          : pentatonic;
        const f = scale[Math.floor(Math.random() * scale.length)];
        this.pluck(f, 0.05);
      }
      step = (step + 1) % 64;
    }, 150);
    this.bgm = { stop: () => window.clearInterval(timer) };
  }

  private drumHit(freq: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * 2, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.12);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain).connect(this.musicBus!);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private shaker(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = this.noiseSource(0.08);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    noise.connect(hp).connect(gain).connect(this.musicBus!);
    noise.start(t);
  }

  private pluck(freq: number, vol: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.9);
    osc.connect(gain).connect(this.musicBus!);
    osc.start(t);
    osc.stop(t + 1);
  }

  // ---------- 具体 SFX 合成 ----------

  private blip(freq: number, dur: number, type: OscillatorType, vol: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private spinStartSfx(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(720, t + 0.25);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + 0.32);
    this.startSpinLoop();
  }

  private reelStopSfx(): void {
    this.blip(140, 0.09, "square", 0.22);
    this.blip(85, 0.14, "sine", 0.3);
  }

  /** 水牛咆哮：低频锯齿 + 噪声吼声，带咆哮包络 */
  private roarSfx(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(65, t);
    osc.frequency.linearRampToValueAtTime(95, t + 0.25);
    osc.frequency.linearRampToValueAtTime(55, t + 0.9);
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.42, t + 0.12);
    og.gain.setTargetAtTime(0, t + 0.7, 0.18);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 500;
    osc.connect(lp).connect(og).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + 1.4);

    const noise = this.noiseSource(1.1);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.linearRampToValueAtTime(700, t + 0.3);
    bp.frequency.linearRampToValueAtTime(240, t + 0.9);
    bp.Q.value = 1.4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.3, t + 0.1);
    ng.gain.setTargetAtTime(0, t + 0.6, 0.16);
    noise.connect(bp).connect(ng).connect(this.sfxBus!);
    noise.start(t);
  }

  /** 水牛低哼（待机随机） */
  private gruntSfx(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(75, t);
    osc.frequency.linearRampToValueAtTime(60, t + 0.28);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
    gain.gain.setTargetAtTime(0, t + 0.2, 0.08);
    osc.connect(lp).connect(gain).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  private freeTriggerSfx(): void {
    this.winArp([523, 659, 784, 1046, 1318], 0.14);
    this.roarSfx();
  }

  private winArp(freqs: number[], step: number): void {
    if (!this.ctx) return;
    freqs.forEach((f, i) => {
      window.setTimeout(() => this.blip(f, 0.3, "triangle", 0.22), i * step * 1000);
    });
    const last = (freqs.length + 2) * step * 1000;
    window.setTimeout(() => this.blip(freqs[freqs.length - 1] * 2, 0.6, "triangle", 0.25), last);
  }

  private jackpotSfx(): void {
    this.winArp([262, 330, 392, 523, 659, 784, 1046, 1318, 1568, 2093], 0.15);
    this.roarSfx();
    window.setTimeout(() => this.coinShowerSfx(), 400);
    window.setTimeout(() => this.roarSfx(), 1600);
  }

  private coinShowerSfx(): void {
    for (let i = 0; i < 14; i += 1) {
      window.setTimeout(
        () => this.blip(1800 + Math.random() * 2200, 0.08, "sine", 0.08),
        i * 90 + Math.random() * 60,
      );
    }
  }

  private noiseSource(duration = 2): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = duration >= 2;
    return source;
  }
}

export const audioEngine = new AudioEngine();
