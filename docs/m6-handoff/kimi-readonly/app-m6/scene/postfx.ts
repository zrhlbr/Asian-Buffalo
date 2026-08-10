/**
 * M6-2 · 后处理管线
 * - HDR：HalfFloat 渲染目标 + ACES Filmic Tone Mapping
 * - Bloom：UnrealBloomPass
 * - God Ray：屏幕空间径向光柱（朝太阳 UV 采样衰减）
 * - 景深：BokehPass（高档开启）
 */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const GodRaysShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSunPos: { value: new THREE.Vector2(0.62, 0.68) },
    uDensity: { value: 0.92 },
    uDecay: { value: 0.94 },
    uWeight: { value: 0.32 },
    uExposure: { value: 0.7 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    #define SAMPLES 48
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
        // 只对高亮区域抽丝，形成光柱
        float lum = smoothstep(0.55, 1.0, dot(s, vec3(0.299, 0.587, 0.114)));
        acc += s * lum * illum;
        illum *= uDecay;
      }
      acc *= uWeight * uExposure / float(SAMPLES) * 8.0;
      gl_FragColor = vec4(base.rgb + acc, base.a);
    }
  `,
};

export interface PostFx {
  composer: EffectComposer;
  setSize(width: number, height: number): void;
  setBloom(on: boolean): void;
  setGodRays(on: boolean): void;
  setDof(on: boolean): void;
  /** 免费旋转 / 大奖时增强光感 */
  setIntensityBoost(k: number): void;
  updateSunScreenPos(sunWorld: THREE.Vector3, camera: THREE.Camera): void;
  dispose(): void;
}

export function createPostFx(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  size: { width: number; height: number },
  initial: { bloom: boolean; godRays: boolean; dof: boolean },
): PostFx {
  // HDR：HalfFloat 目标，配合 renderer.toneMapping = ACESFilmic
  const target = new THREE.WebGLRenderTarget(size.width, size.height, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, target);

  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.55, 0.7, 0.82);
  bloom.enabled = initial.bloom;
  composer.addPass(bloom);

  const godRays = new ShaderPass(GodRaysShader);
  godRays.enabled = initial.godRays;
  composer.addPass(godRays);

  const bokeh = new BokehPass(scene, camera, {
    focus: 9.0,
    aperture: 0.0016,
    maxblur: 0.008,
  });
  bokeh.enabled = initial.dof;
  composer.addPass(bokeh);

  composer.addPass(new OutputPass());

  const projected = new THREE.Vector3();

  function updateSunScreenPos(sunWorld: THREE.Vector3, cam: THREE.Camera): void {
    projected.copy(sunWorld).project(cam);
    if (projected.z < 1) {
      godRays.uniforms.uSunPos.value.set(
        THREE.MathUtils.clamp((projected.x + 1) / 2, -0.2, 1.2),
        THREE.MathUtils.clamp((projected.y + 1) / 2, -0.2, 1.2),
      );
    }
  }

  return {
    composer,
    setSize: (w, h) => composer.setSize(w, h),
    setBloom: (on) => { bloom.enabled = on; },
    setGodRays: (on) => { godRays.enabled = on; },
    setDof: (on) => { bokeh.enabled = on; },
    setIntensityBoost: (k) => {
      bloom.strength = 0.55 + k * 0.75;
      godRays.uniforms.uExposure.value = 0.7 + k * 0.6;
    },
    updateSunScreenPos,
    dispose: () => {
      composer.dispose();
      target.dispose();
    },
  };
}
