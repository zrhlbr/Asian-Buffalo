/**
 * Buffalo — procedural low-poly hero character.
 * Animations: breathing, blinking, ear/tail sway, head turn, run, roar, victory.
 * M6: optional shell-fur LOD (from Kimi M6 buffalo.ts), interruptible actions.
 * Built entirely from Three.js primitives (no external model).
 */
import * as THREE from "three";
import type { Particles } from "./particles";

type BuffaloState =
  | "idle"
  | "roar"
  | "lowRoar"
  | "headUp"
  | "lookAtWin"
  | "run"
  | "victory"
  | "bigWin"
  | "charge"
  | "jumpOut"
  | "slowWalk"
  | "standRoar"
  | "breakReel"
  | "jackpot";

const HIDE = 0x4a3820;
const HIDE_DARK = 0x35270f;
const HORN = 0xd9c27a;
const MUZZLE = 0x1c1108;
const FUR_DARK = new THREE.Color("#241a12");
const FUR_LIGHT = new THREE.Color("#6b5138");

function makeFurMaterial(shellIndex: number, shellCount: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: shellIndex === 0,
    uniforms: {
      uShell: { value: shellIndex / Math.max(1, shellCount) },
      uTime: { value: 0 },
      uDark: { value: FUR_DARK },
      uLight: { value: FUR_LIGHT },
    },
    vertexShader: /* glsl */ `
      uniform float uShell;
      uniform float uTime;
      varying vec2 vUv;
      varying float vShell;
      void main() {
        vUv = uv * 22.0;
        vShell = uShell;
        vec3 p = position + normal * (uShell * 0.07);
        p += normal * sin(uTime * 1.7 + position.y * 2.0) * 0.004;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uDark;
      uniform vec3 uLight;
      varying vec2 vUv;
      varying float vShell;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      void main() {
        // soft strand field — avoid hard checker cells
        float n = valueNoise(vUv * 1.35);
        float strand = valueNoise(vUv * vec2(2.4, 9.5));
        float mask = smoothstep(vShell * 0.55, vShell * 0.55 + 0.22, n * 0.65 + strand * 0.55);
        if (mask < 0.08) discard;
        vec3 col = mix(uDark, uLight, strand * (1.0 - vShell * 0.55));
        gl_FragColor = vec4(col, mask * (1.0 - vShell * 0.75));
      }`,
  });
}

export class Buffalo {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private jaw!: THREE.Mesh;
  private eyelidL!: THREE.Mesh;
  private eyelidR!: THREE.Mesh;
  private earL!: THREE.Mesh;
  private earR!: THREE.Mesh;
  private legs: THREE.Group[] = [];
  private tail!: THREE.Mesh;
  private nostrilL = new THREE.Object3D();
  private nostrilR = new THREE.Object3D();
  private furShells: THREE.Mesh[] = [];
  private furMats: THREE.ShaderMaterial[] = [];
  private furTarget = 0;

  private state: BuffaloState = "idle";
  private stateT = 0;
  private blinkTimer = 2.5;
  private blinkPhase = -1;
  private breatheT = 0;
  private headTurnT = 0;
  private runDir = 1;
  private homePos = new THREE.Vector3(-6.4, 0, -1.2);
  private homeScale = 1.12;
  private particles: Particles | null = null;
  private roarSmokeDone = false;
  private breathMistT = 0;
  private gazeTarget = 0;
  onRoarSound: (() => void) | null = null;

  constructor(furShells = 0) {
    this.build();
    this.setFurShells(furShells);
    this.group.position.copy(this.homePos);
    this.group.rotation.y = 0.95;
  }

  setParticles(p: Particles): void {
    this.particles = p;
  }

  private mat(color: number, rough = 0.9): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: rough });
  }

  private build(): void {
    // ---- torso ----
    const torso = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 14), this.mat(HIDE));
    torso.scale.set(1.55, 1.05, 0.95);
    torso.castShadow = true;
    this.body.add(torso);

    // hump
    const hump = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), this.mat(HIDE_DARK));
    hump.position.set(0.55, 0.62, 0);
    hump.scale.set(1.1, 0.9, 0.95);
    hump.castShadow = true;
    this.body.add(hump);

    // belly shading
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.98, 16, 12), this.mat(HIDE_DARK));
    belly.scale.set(1.5, 0.85, 0.9);
    belly.position.y = -0.28;
    this.body.add(belly);

    // ---- head group (pivots at neck) ----
    this.head.position.set(1.55, 0.35, 0);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 12), this.mat(HIDE));
    skull.scale.set(1.1, 0.95, 0.85);
    skull.castShadow = true;
    this.head.add(skull);

    // horn boss
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), this.mat(HORN, 0.6));
    boss.position.set(-0.05, 0.42, 0);
    boss.scale.set(1.15, 0.5, 1.15);
    this.head.add(boss);

    // horns: curved tubes — denser segments + sharper specular (Clarity V2)
    const hornMat = new THREE.MeshStandardMaterial({
      color: HORN,
      roughness: 0.38,
      metalness: 0.22,
      envMapIntensity: 0.6,
    });
    const hornCurve = (side: number) => {
      const pts = [
        new THREE.Vector3(-0.05, 0.42, side * 0.28),
        new THREE.Vector3(0.0, 0.52, side * 0.62),
        new THREE.Vector3(0.12, 0.72, side * 0.78),
        new THREE.Vector3(0.28, 0.86, side * 0.72),
      ];
      return new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.082, 10),
        hornMat,
      );
    };
    this.head.add(hornCurve(1), hornCurve(-1));

    // ears (animated)
    const earGeo = new THREE.SphereGeometry(0.16, 8, 6);
    this.earR = new THREE.Mesh(earGeo, this.mat(HIDE_DARK));
    this.earR.position.set(-0.18, 0.12, 0.5);
    this.earR.scale.set(1, 0.6, 1.4);
    this.head.add(this.earR);
    this.earL = new THREE.Mesh(earGeo, this.mat(HIDE_DARK));
    this.earL.position.set(-0.18, 0.12, -0.5);
    this.earL.scale.set(1, 0.6, 1.4);
    this.head.add(this.earL);

    // shell fur on torso (LOD; 0 = off)
    const furGeo = new THREE.SphereGeometry(1.05, 16, 12);
    for (let i = 0; i < 10; i++) {
      const mat = makeFurMaterial(i, 10);
      const shell = new THREE.Mesh(furGeo, mat);
      shell.scale.set(1.55, 1.05, 0.95);
      shell.visible = false;
      this.body.add(shell);
      this.furShells.push(shell);
      this.furMats.push(mat);
    }

    // eyes + eyelids + catchlight (Clarity V2 focus)
    const eyeGeo = new THREE.SphereGeometry(0.075, 12, 10);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x140a04,
      roughness: 0.22,
      metalness: 0.05,
    });
    const catchGeo = new THREE.SphereGeometry(0.018, 8, 6);
    const catchMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
    const lidGeo = new THREE.SphereGeometry(0.085, 10, 8);
    const lidMat = this.mat(HIDE);
    for (const side of [1, -1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0.3, 0.12, side * 0.33);
      this.head.add(eye);
      const catchLight = new THREE.Mesh(catchGeo, catchMat);
      catchLight.position.set(0.34, 0.14, side * 0.30);
      this.head.add(catchLight);
      const lid = new THREE.Mesh(lidGeo, lidMat);
      lid.position.copy(eye.position).add(new THREE.Vector3(0.01, 0.045, side * 0.008));
      lid.scale.set(1, 0.15, 1);
      this.head.add(lid);
      if (side === 1) this.eyelidR = lid; else this.eyelidL = lid;
    }

    // muzzle + wet nose (readable, not oversharp)
    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 14, 12),
      new THREE.MeshStandardMaterial({ color: MUZZLE, roughness: 0.55, metalness: 0.08 }),
    );
    muzzle.position.set(0.48, -0.18, 0);
    muzzle.scale.set(1.15, 0.8, 0.9);
    this.head.add(muzzle);
    const nosePad = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0x0c0806,
        roughness: 0.28,
        metalness: 0.12,
      }),
    );
    nosePad.position.set(0.72, -0.14, 0);
    nosePad.scale.set(0.85, 0.65, 1.05);
    this.head.add(nosePad);

    this.jaw = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), this.mat(0x140c05, 0.8));
    this.jaw.position.set(0.42, -0.34, 0);
    this.jaw.scale.set(1.05, 0.55, 0.8);
    this.head.add(this.jaw);

    // nostrils (particle anchors)
    this.nostrilL.position.set(0.72, -0.14, 0.12);
    this.nostrilR.position.set(0.72, -0.14, -0.12);
    this.head.add(this.nostrilL, this.nostrilR);

    this.body.add(this.head);

    // ---- legs ----
    const legGeo = new THREE.CylinderGeometry(0.16, 0.12, 1.15, 8);
    const hoofGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.18, 8);
    const legPos: Array<[number, number]> = [
      [0.85, 0.42], [0.85, -0.42], [-0.85, 0.42], [-0.85, -0.42],
    ];
    for (const [x, z] of legPos) {
      const leg = new THREE.Group();
      leg.position.set(x, -0.55, z);
      const upper = new THREE.Mesh(legGeo, this.mat(HIDE_DARK));
      upper.position.y = -0.45;
      upper.castShadow = true;
      leg.add(upper);
      const hoof = new THREE.Mesh(hoofGeo, this.mat(0x171006, 0.6));
      hoof.position.y = -1.05;
      leg.add(hoof);
      this.body.add(leg);
      this.legs.push(leg);
    }

    // tail
    this.tail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.02, 0.9, 6),
      this.mat(HIDE_DARK),
    );
    this.tail.position.set(-1.55, 0.35, 0);
    this.tail.rotation.z = 0.7;
    this.body.add(this.tail);

    this.group.add(this.body);
    this.body.position.y = 1.75;
    this.group.scale.setScalar(this.homeScale);
    this.group.traverse((o: THREE.Object3D) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
  }

  /** M8 layout — keep buffalo as atmosphere behind full-bleed reels. */
  setHomeLayout(x: number, y: number, z: number, scale: number): void {
    this.homePos.set(x, y, z);
    this.homeScale = scale;
    if (this.state === "idle") {
      this.group.position.copy(this.homePos);
      this.group.scale.setScalar(this.homeScale);
    }
  }

  /** LOD fur shells — 0 disables. Never blocks reels / never triggers spin. */
  setFurShells(count: number): void {
    this.furTarget = Math.max(0, Math.min(this.furShells.length, Math.floor(count)));
    for (let i = 0; i < this.furShells.length; i++) {
      this.furShells[i]!.visible = i < this.furTarget;
    }
  }

  private animMode: "full" | "simple" = "full";

  /**
   * Animal LOD — simple reduces idle FX frequency; breath/blink/win never fully killed.
   */
  setAnimMode(mode: "full" | "simple"): void {
    this.animMode = mode;
  }

  /** Interrupt current action and return to idle pose (safe for spin start). */
  interrupt(): void {
    this.state = "idle";
    this.stateT = 0;
    this.roarSmokeDone = false;
    this.body.rotation.z = 0;
    this.body.position.y = 1.75;
    this.head.rotation.set(0, 0, 0);
    this.jaw.position.y = -0.34;
    this.group.position.copy(this.homePos);
    this.group.position.z = this.homePos.z;
    this.group.scale.setScalar(this.homeScale);
    this.group.rotation.y = 0.95;
    for (const leg of this.legs) leg.rotation.z = 0;
  }

  // ---------------- public actions ----------------
  roar(): void {
    if (this.state !== "idle") this.interrupt();
    this.state = "roar";
    this.stateT = 0;
    this.roarSmokeDone = false;
    this.onRoarSound?.();
  }

  run(): void {
    if (this.state !== "idle") this.interrupt();
    this.state = "run";
    this.stateT = 0;
    this.runDir = 1;
    this.onRoarSound?.();
  }

  victory(): void {
    if (this.state !== "idle") this.interrupt();
    this.state = "victory";
    this.stateT = 0;
    this.onRoarSound?.();
  }

  /** Big Win UI linkage — presentation only, never spins. */
  bigWin(): void {
    if (this.state !== "idle") this.interrupt();
    this.state = "bigWin";
    this.stateT = 0;
    this.onRoarSound?.();
  }

  /** Soft medium-win growl — presentation only. */
  lowRoar(): void {
    if (this.state !== "idle") this.interrupt();
    this.state = "lowRoar";
    this.stateT = 0;
    this.roarSmokeDone = false;
    this.onRoarSound?.();
  }

  /** Strong win — head up + glowing presence. */
  headUp(): void {
    if (this.state !== "idle") this.interrupt();
    this.state = "headUp";
    this.stateT = 0;
  }

  /** Look toward reel win — high/common fullscreen. */
  lookAtWin(): void {
    if (this.state !== "idle") this.interrupt();
    this.state = "lookAtWin";
    this.stateT = 0;
  }

  /** Fullscreen buffalo / Super — charge toward camera. */
  charge(): void {
    if (this.state !== "idle") this.interrupt();
    this.state = "charge";
    this.stateT = 0;
    this.roarSmokeDone = false;
    this.onRoarSound?.();
  }

  /** Ultra — leap pressure toward lens. */
  jumpOut(): void {
    if (this.state !== "idle") this.interrupt();
    this.state = "jumpOut";
    this.stateT = 0;
    this.onRoarSound?.();
  }

  /** Super Win — slow cinematic walk to camera. */
  slowWalk(): void {
    if (this.state !== "idle") this.interrupt();
    this.state = "slowWalk";
    this.stateT = 0;
  }

  /** Epic — stand tall + roar. */
  standRoar(): void {
    if (this.state !== "idle") this.interrupt();
    this.state = "standRoar";
    this.stateT = 0;
    this.roarSmokeDone = false;
    this.onRoarSound?.();
  }

  /** Jackpot ultimate — break-reel surge (presentation scale only). */
  breakReel(): void {
    if (this.state !== "idle") this.interrupt();
    this.state = "breakReel";
    this.stateT = 0;
    this.roarSmokeDone = false;
    this.onRoarSound?.();
  }

  /** Jackpot approach — camera pressure, presentation only. */
  jackpot(): void {
    this.breakReel();
  }

  get isBusy(): boolean {
    return this.state !== "idle";
  }

  /** Exposed for contract tests — idle life always runs in update(). */
  get animationContract(): string[] {
    return [
      "breath",
      "blink",
      "gaze",
      "ears",
      "tail",
      "nostril",
      "breathMist",
      "roar",
      "lowRoar",
      "headUp",
      "lookAtWin",
      "run",
      "victory",
      "bigWin",
      "charge",
      "jumpOut",
      "slowWalk",
      "standRoar",
      "breakReel",
      "jackpot",
    ];
  }

  // ---------------- update ----------------
  update(dt: number, time: number): void {
    const simple = this.animMode === "simple";
    // breathing — always (also drives nostril scale cue); never fully killed
    this.breatheT += dt;
    const breathAmp = simple ? 0.014 : 0.02;
    const breath = Math.sin(this.breatheT * (simple ? 1.5 : 1.9)) * breathAmp;
    this.body.scale.set(1 + breath, 1 + breath * 1.4, 1 + breath);
    const nosePulse = 1 + Math.sin(this.breatheT * (simple ? 1.5 : 1.9)) * (simple ? 0.05 : 0.08);
    this.nostrilL.scale.setScalar(nosePulse);
    this.nostrilR.scale.setScalar(nosePulse);

    for (const mat of this.furMats) {
      mat.uniforms.uTime.value = time;
    }

    // blinking — slower cadence on simple; never disabled
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.blinkPhase < 0 && this.state === "idle") {
      this.blinkPhase = 0;
      this.blinkTimer = (simple ? 3.2 : 1.6) + Math.random() * (simple ? 5 : 3.2);
    }
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt;
      const p = this.blinkPhase / 0.16;
      const close = p < 0.5 ? p * 2 : (1 - p) * 2;
      const s = 0.12 + 0.88 * Math.max(0, close);
      this.eyelidL.scale.y = s;
      this.eyelidR.scale.y = s;
      if (p >= 1) this.blinkPhase = -1;
    }

    // tail + ear sway (stronger on idle; reduced on simple)
    const sway = (this.state === "idle" ? 1 : 0.45) * (simple ? 0.55 : 1);
    this.tail.rotation.x = Math.sin(time * 2.3) * 0.38 * sway;
    this.tail.rotation.z = 0.7 + Math.sin(time * 1.7) * 0.14 * sway;
    this.earL.rotation.z = Math.sin(time * 2.1) * 0.22 * sway;
    this.earR.rotation.z = Math.sin(time * 2.1 + 0.4) * 0.22 * sway;

    // Soft breath mist (idle only) — skipped on simple to cut particle churn
    this.breathMistT += dt;
    const mistEvery = simple ? 9 : 2.8;
    if (this.state === "idle" && this.particles && !simple && this.breathMistT > mistEvery) {
      this.breathMistT = 0;
      const wl = new THREE.Vector3();
      this.nostrilL.getWorldPosition(wl);
      this.particles.puffSmoke(wl, 3);
      const wr = new THREE.Vector3();
      this.nostrilR.getWorldPosition(wr);
      this.particles.puffSmoke(wr, 3);
    }

    this.stateT += dt;
    switch (this.state) {
      case "idle": {
        // gentle head sway + occasional look-around toward reels
        this.headTurnT += dt;
        if (this.headTurnT > 4.5) {
          this.headTurnT = 0;
          this.gazeTarget = (Math.random() - 0.35) * 0.35;
        }
        const look = THREE.MathUtils.damp(
          this.head.rotation.y,
          this.gazeTarget + Math.sin(time * 0.45) * 0.08,
          2.2,
          dt,
        );
        this.head.rotation.y = look;
        this.head.rotation.z = Math.sin(time * 0.7) * 0.05;
        this.head.rotation.x = Math.sin(this.breatheT * 1.9) * 0.03;
        this.body.position.y = 1.75;
        for (const leg of this.legs) leg.rotation.z = 0;
        this.jaw.position.y = -0.34;
        break;
      }
      case "roar": {
        const T = 1.55;
        const p = Math.min(this.stateT / T, 1);
        const lift = Math.sin(p * Math.PI);
        this.head.rotation.z = lift * 0.72; // head up — stronger commercial roar
        this.head.rotation.x = -lift * 0.12;
        this.jaw.position.y = -0.34 - lift * 0.22; // jaw open
        this.body.position.y = 1.75 + lift * 0.08;
        if (!this.roarSmokeDone && p > 0.22 && this.particles) {
          this.roarSmokeDone = true;
          const wl = new THREE.Vector3();
          this.nostrilL.getWorldPosition(wl);
          this.particles.puffSmoke(wl, 18);
          const wr = new THREE.Vector3();
          this.nostrilR.getWorldPosition(wr);
          this.particles.puffSmoke(wr, 18);
        }
        if (p >= 1) this.state = "idle";
        break;
      }
      case "run": {
        const T = 2.6;
        const p = Math.min(this.stateT / T, 1);
        // run out and back along the left side, never crossing the reels
        const dist = Math.sin(p * Math.PI) * 3.2 * this.runDir;
        this.group.position.x = this.homePos.x + dist;
        this.group.rotation.y = 0.5 + (p < 0.5 ? 0 : Math.PI) * 0; // keep facing
        const gallop = this.stateT * 11;
        this.body.position.y = 1.75 + Math.abs(Math.sin(gallop)) * 0.22;
        this.legs[0].rotation.z = Math.sin(gallop) * 0.8;
        this.legs[1].rotation.z = Math.sin(gallop + 0.4) * 0.8;
        this.legs[2].rotation.z = Math.sin(gallop + Math.PI) * 0.8;
        this.legs[3].rotation.z = Math.sin(gallop + Math.PI + 0.4) * 0.8;
        this.head.rotation.z = Math.sin(gallop * 0.5) * 0.1;
        // dust puffs
        if (this.particles && Math.random() < dt * 14) {
          const foot = new THREE.Vector3(this.group.position.x, 0.15, this.group.position.z);
          this.particles.puffSmoke(foot, 2);
        }
        if (p >= 1) {
          this.group.position.copy(this.homePos);
          this.state = "idle";
        }
        break;
      }
      case "victory": {
        const T = 2.2;
        const p = Math.min(this.stateT / T, 1);
        // rear up then slam down — stay left of reels (home X)
        const rear = Math.sin(Math.min(p * 1.6, 1) * Math.PI);
        this.body.rotation.z = rear * 0.55;
        this.body.position.y = 1.75 + rear * 0.5;
        this.legs[0]!.rotation.z = -rear * 1.1;
        this.legs[1]!.rotation.z = -rear * 1.1;
        this.head.rotation.z = -rear * 0.3;
        this.group.position.x = this.homePos.x;
        if (p > 0.62 && p < 0.72 && this.particles) {
          const foot = new THREE.Vector3(this.group.position.x, 0.2, this.group.position.z);
          this.particles.puffSmoke(foot, 10);
        }
        if (p >= 1) {
          this.body.rotation.z = 0;
          this.state = "idle";
        }
        break;
      }
      case "bigWin": {
        const T = 1.85;
        const p = Math.min(this.stateT / T, 1);
        const nod = Math.sin(p * Math.PI * 2) * (1 - p);
        this.head.rotation.x = -nod * 0.35;
        this.head.rotation.z = nod * 0.2;
        this.jaw.position.y = -0.34 - Math.abs(nod) * 0.1;
        this.body.position.y = 1.75 + Math.abs(nod) * 0.12;
        this.group.position.x = this.homePos.x;
        if (p > 0.2 && p < 0.35 && this.particles && !this.roarSmokeDone) {
          this.roarSmokeDone = true;
          const wl = new THREE.Vector3();
          this.nostrilL.getWorldPosition(wl);
          this.particles.puffSmoke(wl, 10);
        }
        if (p >= 1) {
          this.head.rotation.set(0, 0, 0);
          this.jaw.position.y = -0.34;
          this.state = "idle";
          this.roarSmokeDone = false;
        }
        break;
      }
      case "lowRoar": {
        const T = 1.1;
        const p = Math.min(this.stateT / T, 1);
        const lift = Math.sin(p * Math.PI) * 0.55;
        this.head.rotation.z = lift * 0.32;
        this.jaw.position.y = -0.34 - lift * 0.08;
        if (!this.roarSmokeDone && p > 0.3 && this.particles) {
          this.roarSmokeDone = true;
          const wl = new THREE.Vector3();
          this.nostrilL.getWorldPosition(wl);
          this.particles.puffSmoke(wl, 6);
        }
        if (p >= 1) {
          this.head.rotation.set(0, 0, 0);
          this.jaw.position.y = -0.34;
          this.state = "idle";
          this.roarSmokeDone = false;
        }
        break;
      }
      case "headUp": {
        const T = 1.6;
        const p = Math.min(this.stateT / T, 1);
        const lift = Math.sin(Math.min(p * 1.2, 1) * Math.PI);
        this.head.rotation.z = lift * 0.48;
        this.head.rotation.x = -lift * 0.12;
        this.body.position.y = 1.75 + lift * 0.08;
        if (p >= 1) {
          this.head.rotation.set(0, 0, 0);
          this.body.position.y = 1.75;
          this.state = "idle";
        }
        break;
      }
      case "lookAtWin": {
        const T = 2.0;
        const p = Math.min(this.stateT / T, 1);
        const aim = Math.sin(Math.min(p * 1.15, 1) * Math.PI);
        this.head.rotation.y = -0.42 * aim; // toward reels (right of buffalo home)
        this.head.rotation.z = 0.12 * aim;
        this.gazeTarget = -0.35;
        if (p >= 1) {
          this.head.rotation.set(0, 0, 0);
          this.state = "idle";
        }
        break;
      }
      case "charge": {
        const T = 2.4;
        const p = Math.min(this.stateT / T, 1);
        const surge = Math.sin(Math.min(p * 1.4, 1) * Math.PI);
        this.group.position.x = this.homePos.x + surge * 1.55;
        this.group.position.z = this.homePos.z + surge * 2.45;
        this.group.scale.setScalar(this.homeScale * (1 + surge * 0.52));
        this.head.rotation.z = surge * 0.7;
        this.head.rotation.x = -surge * 0.28;
        this.jaw.position.y = -0.34 - surge * 0.24;
        this.body.position.y = 1.75 + surge * 0.28;
        if (!this.roarSmokeDone && p > 0.15 && this.particles) {
          this.roarSmokeDone = true;
          const wl = new THREE.Vector3();
          this.nostrilL.getWorldPosition(wl);
          this.particles.puffSmoke(wl, 22);
          const wr = new THREE.Vector3();
          this.nostrilR.getWorldPosition(wr);
          this.particles.puffSmoke(wr, 22);
        }
        if (this.particles && p > 0.2 && p < 0.75 && Math.random() < dt * 10) {
          const foot = new THREE.Vector3(this.group.position.x, 0.15, this.group.position.z);
          this.particles.puffSmoke(foot, 2);
        }
        if (p >= 1) {
          this.group.position.copy(this.homePos);
          this.group.scale.setScalar(this.homeScale);
          this.head.rotation.set(0, 0, 0);
          this.jaw.position.y = -0.34;
          this.body.position.y = 1.75;
          this.state = "idle";
          this.roarSmokeDone = false;
        }
        break;
      }
      case "jumpOut": {
        const T = 2.1;
        const p = Math.min(this.stateT / T, 1);
        const leap = Math.sin(Math.min(p * 1.5, 1) * Math.PI);
        this.group.position.x = this.homePos.x + leap * 1.5;
        this.group.position.z = this.homePos.z + leap * 2.4;
        this.group.scale.setScalar(this.homeScale * (1 + leap * 0.5));
        this.body.position.y = 1.75 + leap * 0.85;
        this.body.rotation.z = leap * 0.35;
        this.head.rotation.z = leap * 0.4;
        if (p >= 1) {
          this.group.position.copy(this.homePos);
          this.group.scale.setScalar(this.homeScale);
          this.body.position.y = 1.75;
          this.body.rotation.z = 0;
          this.head.rotation.set(0, 0, 0);
          this.state = "idle";
        }
        break;
      }
      case "slowWalk": {
        const T = 3.4;
        const p = Math.min(this.stateT / T, 1);
        const step = Math.sin(p * Math.PI);
        this.group.position.x = this.homePos.x + step * 1.2;
        this.group.position.z = this.homePos.z + step * 1.8;
        this.group.scale.setScalar(this.homeScale * (1 + step * 0.32));
        const gait = this.stateT * 5.5;
        this.body.position.y = 1.75 + Math.abs(Math.sin(gait)) * 0.1;
        this.legs[0].rotation.z = Math.sin(gait) * 0.45;
        this.legs[1].rotation.z = Math.sin(gait + 0.5) * 0.45;
        this.legs[2].rotation.z = Math.sin(gait + Math.PI) * 0.45;
        this.legs[3].rotation.z = Math.sin(gait + Math.PI + 0.5) * 0.45;
        this.head.rotation.y = -0.15 * step;
        if (p >= 1) {
          this.group.position.copy(this.homePos);
          this.group.scale.setScalar(this.homeScale);
          this.body.position.y = 1.75;
          for (const leg of this.legs) leg.rotation.z = 0;
          this.head.rotation.set(0, 0, 0);
          this.state = "idle";
        }
        break;
      }
      case "standRoar": {
        const T = 2.8;
        const p = Math.min(this.stateT / T, 1);
        const rear = Math.sin(Math.min(p * 1.35, 1) * Math.PI);
        this.body.rotation.z = rear * 0.42;
        this.body.position.y = 1.75 + rear * 0.55;
        this.head.rotation.z = rear * 0.65;
        this.jaw.position.y = -0.34 - rear * 0.2;
        this.legs[0]!.rotation.z = -rear * 0.9;
        this.legs[1]!.rotation.z = -rear * 0.9;
        if (!this.roarSmokeDone && p > 0.22 && this.particles) {
          this.roarSmokeDone = true;
          const wl = new THREE.Vector3();
          this.nostrilL.getWorldPosition(wl);
          this.particles.puffSmoke(wl, 20);
          const wr = new THREE.Vector3();
          this.nostrilR.getWorldPosition(wr);
          this.particles.puffSmoke(wr, 20);
        }
        if (p >= 1) {
          this.body.rotation.z = 0;
          this.body.position.y = 1.75;
          this.head.rotation.set(0, 0, 0);
          this.jaw.position.y = -0.34;
          for (const leg of this.legs) leg.rotation.z = 0;
          this.state = "idle";
          this.roarSmokeDone = false;
        }
        break;
      }
      case "breakReel":
      case "jackpot": {
        // Ultimate surge — fill screen pressure, stay left of reel board
        const T = 3.2;
        const p = Math.min(this.stateT / T, 1);
        const surge = Math.sin(Math.min(p * 1.25, 1) * Math.PI);
        this.group.position.x = this.homePos.x + surge * 1.55;
        this.group.position.z = this.homePos.z + surge * 2.8;
        this.group.scale.setScalar(this.homeScale * (1 + surge * 0.62));
        this.head.rotation.z = surge * 0.7;
        this.head.rotation.x = -surge * 0.22;
        this.jaw.position.y = -0.34 - surge * 0.24;
        this.body.position.y = 1.75 + surge * 0.35;
        this.body.rotation.z = surge * 0.2;
        if (!this.roarSmokeDone && p > 0.12 && this.particles) {
          this.roarSmokeDone = true;
          const wl = new THREE.Vector3();
          this.nostrilL.getWorldPosition(wl);
          this.particles.puffSmoke(wl, 22);
          const wr = new THREE.Vector3();
          this.nostrilR.getWorldPosition(wr);
          this.particles.puffSmoke(wr, 22);
        }
        if (this.particles && p > 0.15 && p < 0.8 && Math.random() < dt * 14) {
          const foot = new THREE.Vector3(this.group.position.x, 0.12, this.group.position.z);
          this.particles.puffSmoke(foot, 3);
        }
        if (p >= 1) {
          this.group.position.copy(this.homePos);
          this.group.scale.setScalar(this.homeScale);
          this.head.rotation.set(0, 0, 0);
          this.jaw.position.y = -0.34;
          this.body.position.y = 1.75;
          this.body.rotation.z = 0;
          this.state = "idle";
          this.roarSmokeDone = false;
        }
        break;
      }
    }
  }
}
