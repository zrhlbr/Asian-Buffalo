/**
 * World — 3D Asian savanna:
 * dynamic sky shader dome, drifting clouds, wind-blown instanced grass,
 * golden-hour lighting, fog, ACES HDR tone mapping,
 * post-processing: UnrealBloom + subtle depth-of-field (desktop only).
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export interface Quality {
  grassCount: number;
  pixelRatioCap: number;
  enableDOF: boolean;
}

export function detectQuality(): Quality {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 620;
  if (mobile || smallScreen) {
    return { grassCount: 2500, pixelRatioCap: 1.6, enableDOF: false };
  }
  return { grassCount: 9000, pixelRatioCap: 2, enableDOF: true };
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private bokeh: BokehPass | null = null;
  private skyMat: THREE.ShaderMaterial;
  private grassMat: THREE.ShaderMaterial;
  private clouds: THREE.Mesh[] = [];
  private sun: THREE.DirectionalLight;
  private time = 0;
  readonly quality: Quality;

  constructor(canvas: HTMLCanvasElement) {
    this.quality = detectQuality();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // HDR pipeline
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xc89a5c, 0.013);

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 300);
    this.fitCamera();

    // ---------- lights (golden hour) ----------
    const hemi = new THREE.HemisphereLight(0xffe3b0, 0x6b4a22, 0.85);
    this.scene.add(hemi);

    this.sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
    this.sun.position.set(-14, 9, -18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
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
    const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 20), this.skyMat);
    this.scene.add(sky);

    // ---------- ground ----------
    const groundGeo = new THREE.CircleGeometry(150, 48);
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
    for (let i = 0; i < 9; i++) {
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

    // ---------- a few acacia silhouettes ----------
    this.addAcacia(-22, -26, 1.2);
    this.addAcacia(18, -30, 1.5);
    this.addAcacia(30, -22, 0.9);

    // ---------- post-processing: bloom + DOF ----------
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.38, // strength
      0.6,  // radius
      0.85, // threshold
    );
    this.composer.addPass(this.bloom);
    if (this.quality.enableDOF) {
      this.bokeh = new BokehPass(this.scene, this.camera, {
        focus: 11.5,
        aperture: 0.00012,
        maxblur: 0.004,
      });
      this.composer.addPass(this.bokeh);
    }
    this.composer.addPass(new OutputPass());

    window.addEventListener("resize", () => this.resize());
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
    group.traverse((o) => { o.castShadow = true; });
    this.scene.add(group);
  }

  setWind(strength: number): void {
    this.grassMat.uniforms.uWindStrength.value = strength;
  }

  setBloom(strength: number): void {
    this.bloom.strength = strength;
  }

  /** pull the camera back on narrow screens so the 5-reel frame always fits */
  private fitCamera(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const halfWidthNeeded = 3.55;
    const z = Math.max(11.5, halfWidthNeeded / (Math.tan(THREE.MathUtils.degToRad(23)) * aspect));
    this.camera.position.set(0, 2.4 + (z - 11.5) * 0.1, z);
    this.camera.lookAt(0, 2.2, 0);
    this.baseY = this.camera.position.y;
  }

  private baseY = 2.4;

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitCamera();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  update(dt: number): void {
    this.time += dt;
    this.skyMat.uniforms.uTime.value = this.time;
    this.grassMat.uniforms.uTime.value = this.time;
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 130) c.position.x = -130;
    }
    // subtle camera drift (alive feel)
    this.camera.position.x = Math.sin(this.time * 0.11) * 0.25;
    this.camera.position.y = this.baseY + Math.sin(this.time * 0.17) * 0.08;
    this.camera.lookAt(0, 2.2, 0);
  }

  render(): void {
    this.composer.render();
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
