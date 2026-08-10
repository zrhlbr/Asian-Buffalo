/**
 * Symbol life animation — presentation only.
 * Drives idle / blink / breath / win / wild / scatter motion on reel tiles
 * via GPU shaders. Never mutates grid, spin, wallet, ledger, or math.
 */
import * as THREE from "three";
import type { SymbolId } from "../adapter.ts";

export const ANIMAL_SYMBOLS = [
  "buffalo",
  "lion",
  "elephant",
  "zebra",
  "antelope",
] as const;

export type AnimalSymbolId = (typeof ANIMAL_SYMBOLS)[number];
export type SymbolAnimKind = "animal" | "wild" | "scatter" | "letter";

/** 0 = off (letters on low), 1 = medium, 2 = full animal life */
export type SymbolAnimIntensity = 0 | 1 | 2;

export function isAnimalSymbol(id: SymbolId): id is AnimalSymbolId {
  return (ANIMAL_SYMBOLS as readonly string[]).includes(id);
}

export function symbolAnimKind(id: SymbolId): SymbolAnimKind {
  if (id === "wild") return "wild";
  if (id === "scatter") return "scatter";
  if (isAnimalSymbol(id)) return "animal";
  return "letter";
}

/** Stable phase seed so neighboring tiles don't animate in lockstep. */
export function symbolPhase(reel: number, cell: number): number {
  return (reel * 1.73 + cell * 2.41) % (Math.PI * 2);
}

export type SymbolLifeUniforms = {
  uMap: { value: THREE.Texture | null };
  uTime: { value: number };
  uPhase: { value: number };
  uOpacity: { value: number };
  uWin: { value: number };
  uKind: { value: number }; // 0 letter, 1 animal, 2 wild, 3 scatter
  uIntensity: { value: number };
  uSpinning: { value: number };
  uTint: { value: THREE.Color };
};

const KIND_CODE: Record<SymbolAnimKind, number> = {
  letter: 0,
  animal: 1,
  wild: 2,
  scatter: 3,
};

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uWin;
  uniform float uKind;
  uniform float uIntensity;
  uniform float uSpinning;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float life = uIntensity * step(0.5, uKind) * (1.0 - uSpinning * 0.85);
    // Breath: subtle scale from center (animals / specials)
    float breath = sin(uTime * 1.7 + uPhase) * 0.018 * life;
    p.xy *= 1.0 + breath + uWin * 0.04;
    // Soft head-turn bias (horizontal squash/stretch)
    float turn = sin(uTime * 0.55 + uPhase * 1.3) * 0.012 * life;
    p.x *= 1.0 + turn;
    p.y *= 1.0 - turn * 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uPhase;
  uniform float uOpacity;
  uniform float uWin;
  uniform float uKind;
  uniform float uIntensity;
  uniform float uSpinning;
  uniform vec3 uTint;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float life = uIntensity * (1.0 - uSpinning * 0.9);

    // Animal: UV micro-parallax (skin / fur feel)
    if (uKind > 0.5 && uKind < 1.5) {
      float breathUv = sin(uTime * 1.7 + uPhase) * 0.004 * life;
      float gaze = sin(uTime * 0.4 + uPhase) * 0.0035 * life;
      uv += vec2(gaze, breathUv);
    }

    vec4 tex = texture2D(uMap, uv);
    vec3 col = tex.rgb * uTint;

    if (uKind > 0.5 && uKind < 1.5) {
      float blinkCycle = fract((uTime + uPhase * 0.37) * 0.11);
      float blink = smoothstep(0.0, 0.02, blinkCycle) * smoothstep(0.08, 0.04, blinkCycle);
      float eyeBand = smoothstep(0.28, 0.38, vUv.y) * smoothstep(0.62, 0.52, vUv.y);
      eyeBand *= smoothstep(0.22, 0.35, vUv.x) * smoothstep(0.78, 0.65, vUv.x);
      col *= 1.0 - blink * eyeBand * 0.85 * life;
      // Soft specular wash (horn / wet hide)
      float sheen = pow(max(0.0, sin((vUv.x + vUv.y) * 6.0 + uTime * 1.2 + uPhase)), 8.0);
      col += sheen * 0.07 * life;
      // Ear tip micro flicker (top corners)
      float ear = smoothstep(0.82, 0.95, vUv.y) * (smoothstep(0.15, 0.0, vUv.x) + smoothstep(0.85, 1.0, vUv.x));
      col += ear * (0.5 + 0.5 * sin(uTime * 3.2 + uPhase)) * 0.05 * life;
    }

    // Wild — metal sweep + blue-gold energy
    if (uKind > 1.5 && uKind < 2.5) {
      float sweep = fract(vUv.x * 0.7 - uTime * 0.35 + uPhase * 0.1);
      float band = smoothstep(0.0, 0.15, sweep) * smoothstep(0.45, 0.2, sweep);
      col += mix(vec3(0.25, 0.45, 1.0), vec3(1.0, 0.85, 0.35), band) * band * 0.35 * max(life, 0.35);
      float pulse = 0.5 + 0.5 * sin(uTime * 3.5 + uPhase);
      col += vec3(0.15, 0.25, 0.55) * pulse * 0.12 * max(life, 0.35);
    }

    // Scatter — sun/totem glow + pillar hint
    if (uKind > 2.5) {
      float d = length(vUv - vec2(0.5));
      float sun = smoothstep(0.55, 0.1, d);
      float rays = pow(max(0.0, sin(atan(vUv.y - 0.5, vUv.x - 0.5) * 6.0 + uTime)), 2.0);
      col += vec3(1.0, 0.75, 0.25) * sun * 0.18 * max(life, 0.4);
      col += vec3(1.0, 0.9, 0.5) * rays * (1.0 - d) * 0.1 * max(life, 0.4);
      float gather = 0.5 + 0.5 * sin(uTime * 2.4 + uPhase);
      col += vec3(1.0, 0.6, 0.2) * gather * 0.08 * max(life, 0.4);
    }

    // Win amplify — gold rim + pulse (all kinds)
    if (uWin > 0.01) {
      float edge = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5));
      float rim = smoothstep(0.38, 0.5, edge);
      float pulse = 0.55 + 0.45 * sin(uTime * 9.0 + uPhase);
      col *= 1.0 + uWin * 0.45;
      col += vec3(1.0, 0.82, 0.35) * rim * uWin * pulse * 0.65;
      col += vec3(1.0, 0.9, 0.5) * uWin * 0.08 * pulse;
    }

    gl_FragColor = vec4(col, tex.a * uOpacity);
  }
`;

export function createSymbolMaterial(
  map: THREE.Texture,
  kind: SymbolAnimKind,
  phase: number,
): THREE.ShaderMaterial {
  const uniforms: SymbolLifeUniforms = {
    uMap: { value: map },
    uTime: { value: 0 },
    uPhase: { value: phase },
    uOpacity: { value: 1 },
    uWin: { value: 0 },
    uKind: { value: KIND_CODE[kind] },
    uIntensity: { value: 2 },
    uSpinning: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
  };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
  });
}

export function setSymbolMap(mat: THREE.ShaderMaterial, map: THREE.Texture, kind: SymbolAnimKind): void {
  const u = mat.uniforms as SymbolLifeUniforms;
  u.uMap.value = map;
  u.uKind.value = KIND_CODE[kind];
}

export function updateSymbolLife(
  mat: THREE.ShaderMaterial,
  opts: {
    time: number;
    opacity: number;
    win: boolean;
    intensity: SymbolAnimIntensity;
    spinning: boolean;
    tint?: number;
  },
): void {
  const u = mat.uniforms as SymbolLifeUniforms;
  u.uTime.value = opts.time;
  u.uOpacity.value = opts.opacity;
  u.uWin.value = opts.win ? 1 : 0;
  u.uIntensity.value = opts.intensity;
  u.uSpinning.value = opts.spinning ? 1 : 0;
  const t = opts.tint ?? 1;
  u.uTint.value.setRGB(t, t, t);
}

/** Contract helper for tests — animal idle features encoded in shader source. */
export function symbolLifeShaderFeatures(): string[] {
  return [
    "breath",
    "blink",
    "gaze",
    "sheen",
    "ear",
    "wild-sweep",
    "scatter-sun",
    "win-rim",
  ];
}
