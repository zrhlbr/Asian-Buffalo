/**
 * Buffalo — procedural low-poly hero character.
 * Animations: breathing, blinking, run, roar, victory rear-up.
 * Built entirely from Three.js primitives (no external model).
 */
import * as THREE from "three";
import type { Particles } from "./particles";

type BuffaloState = "idle" | "roar" | "run" | "victory";

const HIDE = 0x4a3820;
const HIDE_DARK = 0x35270f;
const HORN = 0xd9c27a;
const MUZZLE = 0x1c1108;

export class Buffalo {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private jaw!: THREE.Mesh;
  private eyelidL!: THREE.Mesh;
  private eyelidR!: THREE.Mesh;
  private legs: THREE.Group[] = [];
  private tail!: THREE.Mesh;
  private nostrilL = new THREE.Object3D();
  private nostrilR = new THREE.Object3D();

  private state: BuffaloState = "idle";
  private stateT = 0;
  private blinkTimer = 2.5;
  private blinkPhase = -1;
  private breatheT = 0;
  private runDir = 1;
  private homePos = new THREE.Vector3(-6.4, 0, -1.2);
  private particles: Particles | null = null;
  private roarSmokeDone = false;
  onRoarSound: (() => void) | null = null;

  constructor() {
    this.build();
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

    // horns: curved tubes
    const hornCurve = (side: number) => {
      const pts = [
        new THREE.Vector3(-0.05, 0.42, side * 0.28),
        new THREE.Vector3(0.0, 0.52, side * 0.62),
        new THREE.Vector3(0.12, 0.72, side * 0.78),
        new THREE.Vector3(0.28, 0.86, side * 0.72),
      ];
      return new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.085, 8),
        this.mat(HORN, 0.5),
      );
    };
    this.head.add(hornCurve(1), hornCurve(-1));

    // ears
    const earGeo = new THREE.SphereGeometry(0.16, 8, 6);
    for (const side of [1, -1]) {
      const ear = new THREE.Mesh(earGeo, this.mat(HIDE_DARK));
      ear.position.set(-0.18, 0.12, side * 0.5);
      ear.scale.set(1, 0.6, 1.4);
      this.head.add(ear);
    }

    // eyes + eyelids
    const eyeGeo = new THREE.SphereGeometry(0.075, 10, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a0f04, roughness: 0.3 });
    const lidGeo = new THREE.SphereGeometry(0.085, 10, 8);
    const lidMat = this.mat(HIDE);
    for (const side of [1, -1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0.3, 0.12, side * 0.33);
      this.head.add(eye);
      const lid = new THREE.Mesh(lidGeo, lidMat);
      lid.position.copy(eye.position).add(new THREE.Vector3(0.01, 0.045, side * 0.008));
      lid.scale.set(1, 0.15, 1);
      this.head.add(lid);
      if (side === 1) this.eyelidR = lid; else this.eyelidL = lid;
    }

    // muzzle + jaw
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), this.mat(MUZZLE, 0.7));
    muzzle.position.set(0.48, -0.18, 0);
    muzzle.scale.set(1.15, 0.8, 0.9);
    this.head.add(muzzle);

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
    this.group.scale.setScalar(1.12);
    this.group.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  }

  // ---------------- public actions ----------------
  roar(): void {
    if (this.state !== "idle") return;
    this.state = "roar";
    this.stateT = 0;
    this.roarSmokeDone = false;
    this.onRoarSound?.();
  }

  run(): void {
    if (this.state !== "idle") return;
    this.state = "run";
    this.stateT = 0;
    this.runDir = 1;
    this.onRoarSound?.();
  }

  victory(): void {
    if (this.state !== "idle") return;
    this.state = "victory";
    this.stateT = 0;
    this.onRoarSound?.();
  }

  get isBusy(): boolean {
    return this.state !== "idle";
  }

  // ---------------- update ----------------
  update(dt: number, time: number): void {
    // breathing — always
    this.breatheT += dt;
    const breath = Math.sin(this.breatheT * 1.9) * 0.02;
    this.body.scale.set(1 + breath, 1 + breath * 1.4, 1 + breath);

    // blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.blinkPhase < 0) {
      this.blinkPhase = 0;
      this.blinkTimer = 1.6 + Math.random() * 3.2;
    }
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt;
      const p = this.blinkPhase / 0.18;
      const close = p < 0.5 ? p * 2 : (1 - p) * 2;
      const s = 0.15 + 0.85 * Math.max(0, close);
      this.eyelidL.scale.y = s;
      this.eyelidR.scale.y = s;
      if (p >= 1) this.blinkPhase = -1;
    }

    // tail swish
    this.tail.rotation.x = Math.sin(time * 2.3) * 0.35;

    this.stateT += dt;
    switch (this.state) {
      case "idle": {
        // gentle head sway
        this.head.rotation.z = Math.sin(time * 0.7) * 0.05;
        this.head.rotation.y = Math.sin(time * 0.45) * 0.1;
        this.body.position.y = 1.75;
        for (const leg of this.legs) leg.rotation.z = 0;
        this.jaw.position.y = -0.34;
        break;
      }
      case "roar": {
        const T = 1.5;
        const p = Math.min(this.stateT / T, 1);
        const lift = Math.sin(p * Math.PI);
        this.head.rotation.z = lift * 0.55; // head up
        this.jaw.position.y = -0.34 - lift * 0.16; // jaw open
        if (!this.roarSmokeDone && p > 0.25 && this.particles) {
          this.roarSmokeDone = true;
          const wl = new THREE.Vector3();
          this.nostrilL.getWorldPosition(wl);
          this.particles.puffSmoke(wl, 14);
          const wr = new THREE.Vector3();
          this.nostrilR.getWorldPosition(wr);
          this.particles.puffSmoke(wr, 14);
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
        // rear up then slam down
        const rear = Math.sin(Math.min(p * 1.6, 1) * Math.PI);
        this.body.rotation.z = rear * 0.55;
        this.body.position.y = 1.75 + rear * 0.5;
        this.legs[0].rotation.z = -rear * 1.1;
        this.legs[1].rotation.z = -rear * 1.1;
        this.head.rotation.z = -rear * 0.3;
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
    }
  }
}
