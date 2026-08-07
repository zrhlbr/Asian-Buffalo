/**
 * World — 3D Asian savanna:
 * dynamic sky shader dome, drifting clouds, wind-blown instanced grass,
 * golden-hour lighting, fog, ACES HDR tone mapping,
 * post-processing: UnrealBloom + optional GodRays + DOF (quality-gated).
 * M6: LOD via QualityProfile; free-spin atmosphere; no second Renderer.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  detectInitialTier,
  profileFor,
  type QualityProfile,
} from "../quality.ts";
import { setSymbolMaxAnisotropy } from "../game/symbols.ts";

/** @deprecated use QualityProfile — kept for any residual callers */
export interface Quality {
  grassCount: number;
  pixelRatioCap: number;
  enableDOF: boolean;
}

export function detectQuality(): Quality {
  const p = profileFor(detectInitialTier());
  return {
    grassCount: p.grassCount,
    pixelRatioCap: p.pixelRatio,
    enableDOF: p.enableDof,
  };
}

const GodRaysShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSunPos: { value: new THREE.Vector2(0.62, 0.68) },
    uDensity: { value: 0.92 },
    uDecay: { value: 0.94 },
    uWeight: { value: 0.28 },
    uExposure: { value: 0.55 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    #define SAMPLES 32
    uniform sampler2D tDiffuse;
    uniform vec2 uSunPos;
    uniform float uDensity;
    uniform float uDecay;
    uniform float uWeight;
    uniform float uExposure;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec2 uv = vUv;
      vec2 delta = (uv - uSunPos) * (uDensity / float(SAMPLES));
      float illum = 1.0;
      vec3 acc = vec3(0.0);
      for (int i = 0; i < SAMPLES; i += 1) {
        uv -= delta;
        vec3 s = texture2D(tDiffuse, uv).rgb;
        float lum = smoothstep(0.6, 1.0, dot(s, vec3(0.299, 0.587, 0.114)));
        acc += s * lum * illum;
        illum *= uDecay;
      }
      acc *= uWeight * uExposure / float(SAMPLES) * 6.0;
      gl_FragColor = vec4(base.rgb + acc * 0.55, base.a);
    }`,
};

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private bokeh: BokehPass | null = null;
  private godRays: ShaderPass | null = null;
  private skyMat: THREE.ShaderMaterial;
  private grassMat: THREE.ShaderMaterial;
  private clouds: THREE.Mesh[] = [];
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private time = 0;
  private freeSpinMood = false;
  private disposed = false;
  private profile: QualityProfile;
  private shakeAmp = 0;
  private shakeDecay = 4.2;
  private birds: THREE.Mesh[] = [];
  private dust: THREE.Points | null = null;
  private heatHaze: THREE.Mesh | null = null;
  private zoomAmp = 0;
  private lookY = 2.35;
  private frameHalfW = 3.2;
  private baseZ = 11.2;
  /** Legacy alias used by older call sites */
  readonly quality: Quality;

  constructor(canvas: HTMLCanvasElement, profile?: QualityProfile) {
    this.profile = profile ?? profileFor(detectInitialTier());
    this.quality = {
      grassCount: this.profile.grassCount,
      pixelRatioCap: this.profile.pixelRatio,
      enableDOF: this.profile.enableDof,
    };

    // Phase3: always MSAA when the browser allows — clarity over low-tier savings
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(this.clarityPixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // HDR pipeline
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = this.profile.tier !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Feed GPU anisotropy into symbol textures (never leave default 1)
    setSymbolMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());

    this.scene = new THREE.Scene();
    this.scene.fog = this.profile.enableGroundFog
      ? new THREE.FogExp2(0xc89a5c, 0.013)
      : new THREE.FogExp2(0xc89a5c, 0.006);

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 300);
    this.fitCamera();

    // ---------- lights (golden hour) ----------
    this.hemi = new THREE.HemisphereLight(0xffe3b0, 0x6b4a22, 0.85);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
    this.sun.position.set(-14, 9, -18);
    this.sun.castShadow = this.profile.tier !== "low";
    this.sun.shadow.mapSize.set(
      this.profile.shadowMapSize,
      this.profile.shadowMapSize,
    );
    this.sun.shadow.camera.left = -14;
    this.sun.shadow.camera.right = 14;
    this.sun.shadow.camera.top = 14;
    this.sun.shadow.camera.bottom = -14;
    this.sun.shadow.bias = -0.002;
    this.scene.add(this.sun);

    const rim = new THREE.DirectionalLight(0xff9a4a, 0.7);
    rim.position.set(10, 4, -8);
    this.scene.add(rim);

    // camera-side fill so the buffalo / frame read clearly
    const fill = new THREE.DirectionalLight(0xffe2b8, 0.85);
    fill.position.set(6, 5, 12);
    this.scene.add(fill);

    // ---------- sky dome (dynamic shader) ----------
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(-0.45, 0.28, -0.85).normalize() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform float uTime;
        uniform vec3 uSunDir;
        void main() {
          float h = clamp(vDir.y, -0.1, 1.0);
          // slow golden-hour cycle (subtle breathing of the sky)
          float cycle = 0.5 + 0.5 * sin(uTime * 0.02);
          vec3 zenith  = mix(vec3(0.10, 0.16, 0.34), vec3(0.15, 0.21, 0.40), cycle);
          vec3 mid     = mix(vec3(0.62, 0.40, 0.24), vec3(0.72, 0.48, 0.29), cycle);
          vec3 horizon = mix(vec3(0.86, 0.60, 0.35), vec3(0.95, 0.68, 0.40), cycle);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
          col = mix(col, zenith, smoothstep(0.18, 0.75, h));
          // sun disc + halo
          float d = dot(normalize(vDir), uSunDir);
          col += vec3(1.2, 0.85, 0.5) * pow(max(d, 0.0), 220.0) * 0.9; // disc
          col += vec3(1.0, 0.62, 0.30) * pow(max(d, 0.0), 8.0) * 0.15; // halo
          // faint stars high up, twinkling
          float star = step(0.9985, fract(sin(dot(floor(vDir * 220.0).xy, vec2(12.9898, 78.233))) * 43758.5453));
          col += star * smoothstep(0.5, 0.9, h) * (0.25 + 0.2 * sin(uTime * 3.0 + vDir.x * 40.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const skySeg = this.profile.tier === "low" ? 32 : 64;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(160, skySeg, Math.floor(skySeg * 0.65)), this.skyMat);
    this.scene.add(sky);

    // ---------- ground ----------
    const groundGeo = new THREE.CircleGeometry(150, this.profile.tier === "low" ? 48 : 96);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x8a6b32, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // dirt patch under the buffalo rock
    const dirt = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 24),
      new THREE.MeshStandardMaterial({ color: 0x6e5024, roughness: 1 }),
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(-6.4, 0.0, -1.2);
    dirt.receiveShadow = true;
    this.scene.add(dirt);

    // ---------- distant hills ----------
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x7d5c2c, roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(14 + Math.random() * 12, 16, 10), hillMat);
      const ang = (i / 7) * Math.PI * 2 + 0.4;
      const r = 70 + Math.random() * 40;
      h.position.set(Math.cos(ang) * r, -6 - Math.random() * 3, Math.sin(ang) * r - 20);
      h.scale.y = 0.35;
      this.scene.add(h);
    }

    // ---------- grass (instanced, wind vertex shader) ----------
    const bladeGeo = new THREE.PlaneGeometry(0.14, 1.0, 1, 3);
    bladeGeo.translate(0, 0.5, 0);
    this.grassMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uWindStrength: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uWindStrength;
        varying float vShade;
        void main() {
          vec3 p = position;
          vec4 world = instanceMatrix * vec4(p, 1.0);
          float sway = sin(uTime * 1.6 + world.x * 0.35 + world.z * 0.5)
                     + 0.5 * sin(uTime * 3.1 + world.z * 0.9);
          float bend = p.y * p.y * 0.35 * sway * uWindStrength;
          world.x += bend;
          world.z += bend * 0.4;
          vShade = 0.55 + 0.45 * p.y;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: /* glsl */ `
        varying float vShade;
        void main() {
          vec3 base = vec3(0.30, 0.22, 0.07);
          vec3 tip  = vec3(0.68, 0.52, 0.20);
          gl_FragColor = vec4(mix(base, tip, vShade), 1.0);
        }`,
    });
    const grass = new THREE.InstancedMesh(bladeGeo, this.grassMat, this.quality.grassCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.quality.grassCount; i++) {
      if (Math.random() < 0.85) {
        // main field behind the reel plane
        dummy.position.set((Math.random() - 0.5) * 130, 0, -2.5 - Math.random() * 55);
      } else {
        // sparse, short front accents at the frame edges only
        const side = Math.random() < 0.5 ? -1 : 1;
        dummy.position.set(side * (6 + Math.random() * 30), 0, 1 + Math.random() * 8);
      }
      dummy.rotation.y = Math.random() * Math.PI;
      const s = 0.45 + Math.random() * 0.55;
      dummy.scale.set(s, s * (0.7 + Math.random() * 0.5), s);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
    grass.instanceMatrix.needsUpdate = true;
    grass.frustumCulled = false;
    this.scene.add(grass);

    // ---------- clouds (billboards with procedural texture) ----------
    const cloudTex = makeCloudTexture();
    for (let i = 0; i < this.profile.cloudCount; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.28 + Math.random() * 0.16,
        depthWrite: false,
        fog: false,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 13), mat);
      m.position.set(
        (Math.random() - 0.5) * 200,
        24 + Math.random() * 20,
        -80 - Math.random() * 60,
      );
      const s = 1.0 + Math.random() * 1.4;
      m.scale.setScalar(s);
      m.userData.speed = 0.15 + Math.random() * 0.35;
      this.clouds.push(m);
      this.scene.add(m);
    }

    // ---------- a few acacia silhouettes (count by LOD) ----------
    const trees: Array<[number, number, number]> = [
      [-22, -26, 1.2],
      [18, -30, 1.5],
      [30, -22, 0.9],
    ];
    for (let i = 0; i < Math.min(this.profile.treeCount, trees.length); i++) {
      const [x, z, s] = trees[i]!;
      this.addAcacia(x, z, s);
    }

    // ---------- distant birds (simple silhouettes) ----------
    const birdGeo = new THREE.ConeGeometry(0.18, 0.55, 3);
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x1a120c });
    for (let i = 0; i < 8; i++) {
      const bird = new THREE.Mesh(birdGeo, birdMat);
      bird.rotation.x = Math.PI / 2;
      bird.position.set(
        (Math.random() - 0.5) * 90,
        14 + Math.random() * 12,
        -35 - Math.random() * 40,
      );
      bird.userData.speed = 1.6 + Math.random() * 2.2;
      bird.userData.phase = Math.random() * Math.PI * 2;
      this.birds.push(bird);
      this.scene.add(bird);
    }

    // ---------- atmospheric dust motes ----------
    {
      const count = this.profile.enableGodRays ? 220 : 80;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 40;
        positions[i * 3 + 1] = 0.4 + Math.random() * 8;
        positions[i * 3 + 2] = -2 + Math.random() * 18;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xffe29a,
        size: 0.06,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.dust = new THREE.Points(geo, mat);
      this.dust.frustumCulled = false;
      this.scene.add(this.dust);
    }

    // ---------- heat haze (alive air above the grass) ----------
    {
      const haze = new THREE.Mesh(
        new THREE.PlaneGeometry(48, 6),
        new THREE.MeshBasicMaterial({
          color: 0xffe0a0,
          transparent: true,
          opacity: 0.05,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      haze.position.set(0, 1.4, 4);
      haze.rotation.x = -0.55;
      this.heatHaze = haze;
      this.scene.add(haze);
    }

    // ---------- post-processing: bloom + optional god rays + DOF ----------
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Slightly tighter bloom — less soft glow wash on Symbol edges
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.profile.enableBloom ? 0.28 : 0,
      0.55,
      0.88,
    );
    this.bloom.enabled = this.profile.enableBloom;
    this.composer.addPass(this.bloom);
    if (this.profile.enableGodRays) {
      this.godRays = new ShaderPass(GodRaysShader);
      this.composer.addPass(this.godRays);
    }
    if (this.profile.enableDof) {
      this.bokeh = new BokehPass(this.scene, this.camera, {
        focus: 11.5,
        aperture: 0.00012,
        maxblur: 0.004,
      });
      this.composer.addPass(this.bokeh);
    }
    this.composer.addPass(new OutputPass());
  }

  /** Cap DPR for clarity; never below min(deviceDPR, 2) when profile allows ≥2. */
  private clarityPixelRatio(): number {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const cap = this.profile.pixelRatio;
    // Prefer sharp output: use full device DPR up to profile cap (high up to 3)
    return Math.min(Math.max(dpr, 1), cap);
  }

  /** Runtime LOD — pixel ratio / postfx / fog / shadows (grass count fixed at build). */
  applyQuality(profile: QualityProfile): void {
    this.profile = profile;
    this.quality.pixelRatioCap = profile.pixelRatio;
    this.quality.enableDOF = profile.enableDof;
    this.renderer.setPixelRatio(this.clarityPixelRatio());
    this.renderer.shadowMap.enabled = profile.tier !== "low";
    this.sun.castShadow = profile.tier !== "low";
    this.bloom.enabled = profile.enableBloom;
    this.bloom.strength = profile.enableBloom
      ? this.freeSpinMood
        ? 0.48
        : 0.28
      : 0;
    if (this.godRays) this.godRays.enabled = profile.enableGodRays;
    if (this.bokeh) this.bokeh.enabled = profile.enableDof;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = profile.enableGroundFog ? 0.013 : 0.006;
    }
    this.resize();
  }

  setFreeSpinMood(on: boolean): void {
    this.freeSpinMood = on;
    if (on) {
      this.hemi.color.setHex(0xffd4a8);
      this.hemi.groundColor.setHex(0x5a3a18);
      this.sun.intensity = 2.55;
      this.renderer.toneMappingExposure = 1.1;
      if (this.profile.enableBloom) this.bloom.strength = 0.48;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0xd4a86a);
      }
    } else {
      this.hemi.color.setHex(0xffe3b0);
      this.hemi.groundColor.setHex(0x6b4a22);
      this.sun.intensity = 2.2;
      this.renderer.toneMappingExposure = 1.05;
      if (this.profile.enableBloom) this.bloom.strength = 0.28;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0xc89a5c);
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.composer.dispose();
    } catch {
      /* ignore */
    }
    try {
      this.renderer.dispose();
    } catch {
      /* ignore */
    }
  }

  private addAcacia(x: number, z: number, s: number): void {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3416, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x6e5a20, roughness: 1 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.3 * s, 4.4 * s, 6), trunkMat);
    trunk.position.y = 2.2 * s;
    trunk.rotation.z = 0.08;
    group.add(trunk);
    for (let i = 0; i < 3; i++) {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(2.2 * s, 10, 6), leafMat);
      crown.scale.set(1.9, 0.22, 1.3);
      crown.position.set((i - 1) * 1.4 * s, 4.4 * s + (i % 2) * 0.3, (i - 1) * 0.5 * s);
      group.add(crown);
    }
    group.position.set(x, 0, z);
    group.traverse((o: THREE.Object3D) => {
      o.castShadow = true;
    });
    this.scene.add(group);
  }

  setWind(strength: number): void {
    this.grassMat.uniforms.uWindStrength.value = strength;
  }

  setBloom(strength: number): void {
    if (!this.profile.enableBloom) {
      this.bloom.strength = 0;
      return;
    }
    this.bloom.strength = strength;
  }

  /** Commercial win camera shake — amplitude decays over update(). */
  shake(amplitude = 0.18, decay = 4.2): void {
    this.shakeAmp = Math.max(this.shakeAmp, amplitude);
    this.shakeDecay = decay;
  }

  /** Brief dolly-in for Big/Mega/Ultra — UI-only presentation. */
  punchZoom(amount = 0.35): void {
    this.zoomAmp = Math.max(this.zoomAmp, amount);
  }

  /** Sync camera framing to the commercial full-bleed reel half-width. */
  setFrameHalfWidth(halfW: number): void {
    this.frameHalfW = Math.max(2.4, halfW);
    this.fitCamera();
  }

  getCameraZ(): number {
    return this.camera.position.z;
  }

  /** Mobile-first FOV: tighter on phone landscape so the board reads larger. */
  applyCommercialFov(aspect: number, viewportW?: number, viewportH?: number): number {
    const w = viewportW ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
    const h = viewportH ?? (typeof window !== "undefined" ? window.innerHeight : 720);
    const shortSide = Math.min(w, h);
    const phoneLandscape = aspect >= 1.05 && shortSide <= 520;
    const phonePortrait = aspect < 1.05 && w <= 500;
    const fov = phonePortrait ? 44 : phoneLandscape ? 38 : 46;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    return fov;
  }

  /** pull the camera so the reel frame fills the phone width (M8 P0) */
  private fitCamera(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    const fov = this.applyCommercialFov(aspect, w, h);
    const halfFov = THREE.MathUtils.degToRad(fov * 0.5);
    const shortSide = Math.min(w, h);
    const phoneLandscape = aspect >= 1.05 && shortSide <= 520;
    // Zero optical margin on phone landscape — safe area is reel pad, not camera slack
    const margin = phoneLandscape ? 1.0 : 1.05;
    const halfWidthNeeded = this.frameHalfW * margin;
    const z = Math.max(
      phoneLandscape ? 8.2 : 9.2,
      halfWidthNeeded / (Math.tan(halfFov) * Math.max(aspect, 0.01)),
    );
    this.lookY = aspect < 1.05 ? 2.5 : 2.32;
    this.baseZ = z;
    this.camera.position.set(0, this.lookY + 0.06 + (z - 11) * 0.05, z);
    this.camera.lookAt(0, this.lookY, 0);
    this.baseY = this.camera.position.y;
  }

  private baseY = 2.4;

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitCamera();
    this.renderer.setPixelRatio(this.clarityPixelRatio());
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
  }

  update(dt: number): void {
    this.time += dt;
    this.skyMat.uniforms.uTime.value = this.time;
    this.grassMat.uniforms.uTime.value = this.time;
    // wind gust cycle
    const gust = 0.75 + 0.35 * Math.sin(this.time * 0.35);
    this.grassMat.uniforms.uWindStrength.value = this.freeSpinMood
      ? gust * 1.35
      : gust;
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt * (this.freeSpinMood ? 1.4 : 1);
      if (c.position.x > 130) c.position.x = -130;
    }
    for (const bird of this.birds) {
      bird.position.x += bird.userData.speed * dt;
      bird.position.y += Math.sin(this.time * 3.2 + bird.userData.phase) * 0.01;
      if (bird.position.x > 55) bird.position.x = -55;
    }
    if (this.dust) {
      this.dust.rotation.y = this.time * 0.04;
      const mat = this.dust.material as THREE.PointsMaterial;
      mat.opacity = 0.28 + 0.12 * Math.sin(this.time * 0.7);
    }
    if (this.shakeAmp > 0.0005) {
      this.shakeAmp *= Math.exp(-this.shakeDecay * dt);
    } else {
      this.shakeAmp = 0;
    }
    if (this.zoomAmp > 0.0005) {
      this.zoomAmp *= Math.exp(-3.4 * dt);
    } else {
      this.zoomAmp = 0;
    }
    const sx = this.shakeAmp * Math.sin(this.time * 55);
    const sy = this.shakeAmp * Math.cos(this.time * 47);
    // subtle camera drift + win shake + punch zoom (dolly in)
    this.camera.position.x = Math.sin(this.time * 0.11) * 0.12 + sx;
    this.camera.position.y = this.baseY + Math.sin(this.time * 0.17) * 0.06 + sy;
    this.camera.position.z = this.baseZ - this.zoomAmp * 1.85;
    this.camera.lookAt(0, this.lookY, 0);
    if (this.heatHaze) {
      (this.heatHaze.material as THREE.MeshBasicMaterial).opacity =
        0.035 + 0.025 * Math.sin(this.time * 1.3);
      this.heatHaze.position.y = 1.2 + Math.sin(this.time * 0.7) * 0.15;
    }
    if (this.godRays?.enabled) {
      const sunNdc = this.sun.position.clone().normalize();
      const projected = sunNdc.clone().project(this.camera);
      const u = this.godRays.uniforms as {
        uSunPos: { value: THREE.Vector2 };
      };
      u.uSunPos.value.set(
        projected.x * 0.5 + 0.5,
        projected.y * 0.5 + 0.5,
      );
    }
  }

  render(): void {
    if (this.profile.enableBloom || this.godRays?.enabled || this.bokeh?.enabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

function makeCloudTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 128);
  for (let i = 0; i < 26; i++) {
    const x = 30 + Math.random() * 196;
    const y = 40 + Math.random() * 48;
    const r = 14 + Math.random() * 26;
    const grad = g.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, "rgba(255,244,220,.55)");
    grad.addColorStop(1, "rgba(255,244,220,0)");
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
