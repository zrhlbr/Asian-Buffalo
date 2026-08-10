/**
 * Particles — coin rain, smoke, sparks, light pillars.
 * Pooled, zero per-frame allocation in hot paths.
 */
import * as THREE from "three";

interface Particle {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  spin: number;
}

class Pool {
  readonly points: THREE.Points;
  private items: Particle[] = [];
  private geo: THREE.BufferGeometry;
  private posAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;
  private alphaAttr: THREE.BufferAttribute;
  private gravity: number;
  private drag: number;

  constructor(
    capacity: number,
    texture: THREE.Texture,
    color: THREE.ColorRepresentation,
    blending: THREE.Blending,
    gravity: number,
    drag: number,
  ) {
    this.gravity = gravity;
    this.drag = drag;
    this.geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3);
    this.sizeAttr = new THREE.BufferAttribute(new Float32Array(capacity), 1);
    this.alphaAttr = new THREE.BufferAttribute(new Float32Array(capacity), 1);
    this.geo.setAttribute("position", this.posAttr);
    this.geo.setAttribute("aSize", this.sizeAttr);
    this.geo.setAttribute("aAlpha", this.alphaAttr);
    for (let i = 0; i < capacity; i++) {
      this.items.push({
        alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        life: 0, maxLife: 1, size: 1, spin: 0,
      });
    }
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending,
      uniforms: { uMap: { value: texture }, uColor: { value: new THREE.Color(color) } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (240.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(uColor * tex.rgb, tex.a * vAlpha);
          if (gl_FragColor.a < 0.01) discard;
        }`,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
  }

  spawn(origin: THREE.Vector3, vel: THREE.Vector3, life: number, size: number): void {
    for (const p of this.items) {
      if (!p.alive) {
        p.alive = true;
        p.pos.copy(origin);
        p.vel.copy(vel);
        p.life = 0;
        p.maxLife = life;
        p.size = size;
        return;
      }
    }
  }

  update(dt: number): void {
    const pos = this.posAttr.array as Float32Array;
    const size = this.sizeAttr.array as Float32Array;
    const alpha = this.alphaAttr.array as Float32Array;
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      if (!p.alive) { alpha[i] = 0; continue; }
      p.life += dt;
      if (p.life >= p.maxLife) { p.alive = false; alpha[i] = 0; continue; }
      p.vel.y -= this.gravity * dt;
      p.vel.multiplyScalar(1 - this.drag * dt);
      p.pos.addScaledVector(p.vel, dt);
      const t = p.life / p.maxLife;
      pos[i * 3] = p.pos.x;
      pos[i * 3 + 1] = p.pos.y;
      pos[i * 3 + 2] = p.pos.z;
      size[i] = p.size * (0.6 + 0.4 * Math.sin(t * Math.PI));
      alpha[i] = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    }
    this.posAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }

  get activeCount(): number {
    let n = 0;
    for (const p of this.items) if (p.alive) n++;
    return n;
  }
}

function dotTexture(soft: boolean): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(soft ? 0.4 : 0.75, "rgba(255,255,255,.8)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function coinTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(24, 22, 4, 32, 32, 30);
  grad.addColorStop(0, "#fff6d8");
  grad.addColorStop(0.6, "#f2c94c");
  grad.addColorStop(1, "rgba(154,116,24,0)");
  g.fillStyle = grad;
  g.beginPath(); g.arc(32, 32, 29, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(122,90,16,.9)";
  g.lineWidth = 3;
  g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.stroke();
  return new THREE.CanvasTexture(c);
}

export class Particles {
  private coins: Pool;
  private sparks: Pool;
  private smoke: Pool;
  private pillars: THREE.Mesh[] = [];
  private scene: THREE.Scene;
  private coinTimer = 0;
  private coinBudget = 220;
  private particleBudget = 400;
  coinRainActive = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.coins = new Pool(700, coinTexture(), 0xffffff, THREE.NormalBlending, 9.5, 0.25);
    this.sparks = new Pool(400, dotTexture(false), 0xffd970, THREE.AdditiveBlending, 4.5, 0.6);
    this.smoke = new Pool(250, dotTexture(true), 0x9a8668, THREE.NormalBlending, -0.5, 1.4);
    scene.add(this.coins.points, this.sparks.points, this.smoke.points);

    // light pillars (god rays) — additive gradient cylinders, hidden by default
    const pillarTex = makePillarTexture();
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: pillarTex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 30), mat);
      m.position.set((i - 2) * 3.4, 12, -6);
      m.rotation.z = (i - 2) * 0.06;
      m.visible = false;
      this.pillars.push(m);
      scene.add(m);
    }
  }

  /** LOD budgets — presentation only; does not rebuild pools. */
  setBudgets(coinBudget: number, particleBudget: number): void {
    this.coinBudget = coinBudget;
    this.particleBudget = particleBudget;
  }

  /** continuous coin rain over the reel area */
  private emitCoins(dt: number): void {
    this.coinTimer += dt;
    const interval = this.coinBudget >= 200 ? 0.03 : this.coinBudget >= 120 ? 0.05 : 0.08;
    while (this.coinTimer > interval) {
      this.coinTimer -= interval;
      if (this.coins.activeCount >= this.coinBudget) break;
      const origin = new THREE.Vector3((Math.random() - 0.5) * 10, 8.5 + Math.random() * 2, -1 + Math.random() * 2);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 0.8, -1 - Math.random() * 1.5, (Math.random() - 0.5) * 0.4);
      this.coins.spawn(origin, vel, 3.2, 0.55 + Math.random() * 0.5);
    }
  }

  burstSparks(center: THREE.Vector3, count: number, speed = 5): void {
    const n = Math.min(count, Math.max(8, Math.floor(this.particleBudget / 20)));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.3;
      const vel = new THREE.Vector3(Math.cos(a) * speed * Math.random(), up * speed, Math.sin(a) * speed * Math.random() * 0.5);
      this.sparks.spawn(center, vel, 0.5 + Math.random() * 0.7, 0.3 + Math.random() * 0.35);
    }
  }

  puffSmoke(center: THREE.Vector3, count: number): void {
    for (let i = 0; i < count; i++) {
      const vel = new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6);
      this.smoke.spawn(center, vel, 1.2 + Math.random() * 1.0, 0.8 + Math.random() * 0.9);
    }
  }

  coinBurst(center: THREE.Vector3, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const vel = new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 3), 4 + Math.random() * 4, Math.sin(a) * 1.5);
      this.coins.spawn(center, vel, 2.6, 0.5 + Math.random() * 0.5);
    }
  }

  setPillars(on: boolean): void {
    for (const p of this.pillars) p.visible = on;
  }

  update(dt: number, time: number): void {
    if (this.coinRainActive) this.emitCoins(dt);
    this.coins.update(dt);
    this.sparks.update(dt);
    this.smoke.update(dt);
    for (let i = 0; i < this.pillars.length; i++) {
      const p = this.pillars[i];
      if (!p.visible) continue;
      const mat = p.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.16 + 0.1 * Math.sin(time * 1.8 + i * 1.3);
      p.rotation.y = time * 0.1 + i;
    }
  }
}

function makePillarTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 256;
  const g = c.getContext("2d")!;
  const gradX = g.createLinearGradient(0, 0, 64, 0);
  gradX.addColorStop(0, "rgba(255,220,140,0)");
  gradX.addColorStop(0.5, "rgba(255,230,170,.85)");
  gradX.addColorStop(1, "rgba(255,220,140,0)");
  g.fillStyle = gradX;
  g.fillRect(0, 0, 64, 256);
  const gradY = g.createLinearGradient(0, 0, 0, 256);
  gradY.addColorStop(0, "rgba(0,0,0,1)");
  gradY.addColorStop(0.35, "rgba(0,0,0,0)");
  gradY.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = gradY;
  g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}
