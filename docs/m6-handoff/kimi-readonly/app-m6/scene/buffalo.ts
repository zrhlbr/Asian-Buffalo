/**
 * M6-1 · 水牛角色（程序化建模，无外部资产）
 * - 更真实建模：躯干 / 驼峰 / 头 / 大弯角 / 耳 / 眼 / 四肢 / 尾
 * - 毛发：Shell Texturing 多层壳毛发（自定义 ShaderMaterial，壳数随画质 LOD）
 * - 待机：呼吸（躯干起伏）、眨眼（眼睑）、随机转头、摆尾
 * - 动作：奔跑 / 咆哮 / 胜利（跃起）
 */
import * as THREE from "three";

const BODY_COLOR = new THREE.Color("#3a2c22");
const BELLY_COLOR = new THREE.Color("#55412f");
const HORN_COLOR = new THREE.Color("#8d7a5c");
const FUR_DARK = new THREE.Color("#241a12");
const FUR_LIGHT = new THREE.Color("#6b5138");

type BuffaloAction = "idle" | "run" | "roar" | "victory";

function furMaterial(shellIndex: number, shellCount: number): THREE.ShaderMaterial {
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
        vec3 p = position + normal * (uShell * 0.075);
        // 呼吸扰动沿法线传递
        p += normal * sin(uTime * 1.7 + position.y * 2.0) * 0.004;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uDark;
      uniform vec3 uLight;
      varying vec2 vUv;
      varying float vShell;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      void main() {
        vec2 cell = floor(vUv);
        float n = hash(cell);
        // 外壳越高越稀疏，形成毛尖
        if (n < vShell * vShell) discard;
        vec3 col = mix(uDark, uLight, n * (1.0 - vShell * 0.6));
        gl_FragColor = vec4(col, 1.0 - vShell * 0.85);
      }
    `,
  });
}

export interface BuffaloRig {
  group: THREE.Group;
  update(elapsed: number, dt: number): void;
  playRun(): void;
  playRoar(): void;
  playVictory(): void;
  /** LOD：设置毛发壳层数（0 = 关毛发） */
  setFurShells(count: number): void;
  dispose(): void;
}

export function createBuffalo(initialShells: number): BuffaloRig {
  const group = new THREE.Group();
  group.name = "buffalo";

  const bodyMat = new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.92, metalness: 0.02 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: BELLY_COLOR, roughness: 0.95 });
  const hornMat = new THREE.MeshStandardMaterial({ color: HORN_COLOR, roughness: 0.55, metalness: 0.08 });
  const darkMat = new THREE.MeshStandardMaterial({ color: "#1c130d", roughness: 0.9 });

  // ---- 躯干（带驼峰） ----
  const body = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.92, 28, 22), bodyMat);
  torso.scale.set(1.55, 1.02, 0.95);
  torso.position.y = 1.18;
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 16), bodyMat);
  hump.scale.set(1.0, 0.85, 0.9);
  hump.position.set(0.55, 1.78, 0);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.78, 20, 16), bellyMat);
  belly.scale.set(1.35, 0.8, 0.82);
  belly.position.set(-0.05, 0.92, 0);
  body.add(torso, hump, belly);
  group.add(body);

  // ---- 头 ----
  const head = new THREE.Group();
  head.position.set(1.45, 1.62, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 22, 18), bodyMat);
  skull.scale.set(1.05, 0.95, 0.82);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), bellyMat);
  muzzle.scale.set(1.15, 0.8, 0.72);
  muzzle.position.set(0.34, -0.16, 0);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), darkMat);
  jaw.scale.set(1.1, 0.5, 0.6);
  jaw.position.set(0.32, -0.34, 0);
  // 大弯角：左右各一，基座 + 外弯弧
  const hornGeo = new THREE.TorusGeometry(0.5, 0.085, 10, 20, Math.PI * 0.85);
  const hornBaseGeo = new THREE.SphereGeometry(0.16, 12, 10);
  const hornL = new THREE.Mesh(hornGeo, hornMat);
  hornL.position.set(-0.05, 0.22, 0.34);
  hornL.rotation.set(0.35, -0.4, 1.9);
  const hornR = hornL.clone();
  hornR.position.z = -0.34;
  hornR.rotation.set(-0.35, 0.4, 1.9);
  const hornBaseL = new THREE.Mesh(hornBaseGeo, hornMat);
  hornBaseL.position.set(-0.02, 0.3, 0.22);
  const hornBaseR = hornBaseL.clone();
  hornBaseR.position.z = -0.22;
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), hornMat);
  boss.scale.set(1.2, 0.7, 1.1);
  boss.position.set(0, 0.32, 0);
  // 耳
  const earGeo = new THREE.SphereGeometry(0.14, 12, 8);
  const earL = new THREE.Mesh(earGeo, bodyMat);
  earL.scale.set(1.4, 0.7, 0.35);
  earL.position.set(-0.15, 0.05, 0.42);
  earL.rotation.x = 0.5;
  const earR = earL.clone();
  earR.position.z = -0.42;
  earR.rotation.x = -0.5;
  // 眼 + 眼睑（眨眼）
  const eyeGeo = new THREE.SphereGeometry(0.055, 10, 8);
  const lidGeo = new THREE.SphereGeometry(0.062, 10, 8);
  const eyeL = new THREE.Mesh(eyeGeo, darkMat);
  eyeL.position.set(0.3, 0.06, 0.24);
  const eyeR = eyeL.clone();
  eyeR.position.z = -0.24;
  const lidL = new THREE.Mesh(lidGeo, bodyMat);
  lidL.position.copy(eyeL.position);
  lidL.scale.set(1.05, 0.08, 1.05);
  const lidR = lidL.clone();
  lidR.position.copy(eyeR.position);
  head.add(skull, muzzle, jaw, hornL, hornR, hornBaseL, hornBaseR, boss, earL, earR, eyeL, eyeR, lidL, lidR);
  group.add(head);

  // ---- 四肢 ----
  const legGeo = new THREE.CylinderGeometry(0.13, 0.1, 1.05, 10);
  const hoofGeo = new THREE.CylinderGeometry(0.11, 0.12, 0.14, 10);
  const legs: THREE.Group[] = [];
  const legPositions: Array<[number, number]> = [
    [0.82, 0.42], [0.82, -0.42], [-0.72, 0.42], [-0.72, -0.42],
  ];
  for (const [x, z] of legPositions) {
    const leg = new THREE.Group();
    leg.position.set(x, 1.0, z);
    const upper = new THREE.Mesh(legGeo, bodyMat);
    upper.position.y = -0.45;
    const hoof = new THREE.Mesh(hoofGeo, darkMat);
    hoof.position.y = -0.98;
    leg.add(upper, hoof);
    legs.push(leg);
    group.add(leg);
  }

  // ---- 尾 ----
  const tail = new THREE.Group();
  tail.position.set(-1.35, 1.5, 0);
  const tailBone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.85, 8), bodyMat);
  tailBone.position.y = -0.4;
  const tailTuft = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), darkMat);
  tailTuft.position.y = -0.85;
  tail.add(tailBone, tailTuft);
  group.add(tail);

  // ---- 毛发壳（Shell Texturing）----
  const furGroup = new THREE.Group();
  const furMeshes: THREE.Mesh[] = [];
  const furSources: THREE.Mesh[] = [torso, hump, skull];
  let shellCount = 0;

  function rebuildFur(count: number): void {
    for (const mesh of furMeshes) {
      mesh.parent?.remove(mesh);
      (mesh.material as THREE.ShaderMaterial).dispose();
    }
    furMeshes.length = 0;
    shellCount = count;
    for (let i = 1; i <= count; i += 1) {
      for (const src of furSources) {
        const shell = new THREE.Mesh(src.geometry, furMaterial(i, count));
        shell.position.copy(src.getWorldPosition(new THREE.Vector3()));
        // 世界坐标复制：壳直接挂在 furGroup（与 group 同级变换）
        shell.position.copy(src.position);
        src.parent?.updateWorldMatrix(true, false);
        shell.applyMatrix4(new THREE.Matrix4());
        if (src.parent === body) shell.position.add(body.position);
        if (src.parent === head) {
          // 头壳跟随头部动作 → 挂到 head 下
          shell.position.copy(src.position);
          shell.scale.copy(src.scale);
          shell.rotation.copy(src.rotation);
          head.add(shell);
        } else {
          shell.scale.copy(src.scale);
          shell.rotation.copy(src.rotation);
          body.add(shell);
        }
        furMeshes.push(shell);
      }
    }
  }
  group.add(furGroup);
  if (initialShells > 0) rebuildFur(initialShells);

  // ---- 动画状态 ----
  let action: BuffaloAction = "idle";
  let actionT = 0;
  let breath = Math.random() * 10;
  let blinkT = 2 + Math.random() * 3;
  let blinkPhase = -1;
  let headYaw = 0;
  let headYawTarget = 0;
  let headPitch = 0;
  let nextLook = 3 + Math.random() * 5;
  let baseZ = 0;

  const HEAD_YAW_MAX = 0.55;

  function setAction(next: BuffaloAction): void {
    action = next;
    actionT = 0;
  }

  function update(elapsed: number, dt: number): void {
    breath += dt;
    actionT += dt;

    // 呼吸：躯干缓慢起伏
    const breathWave = Math.sin(breath * 1.7) * 0.018;
    body.scale.set(1 + breathWave * 0.6, 1 + breathWave, 1 + breathWave * 0.5);

    // 毛发时间
    for (const shell of furMeshes) {
      (shell.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
    }

    // 眨眼
    blinkT -= dt;
    if (blinkT <= 0 && blinkPhase < 0) {
      blinkPhase = 0;
      blinkT = 2.5 + Math.random() * 3.5;
    }
    if (blinkPhase >= 0) {
      blinkPhase += dt * 9;
      const k = Math.sin(Math.min(Math.PI, blinkPhase));
      lidL.scale.y = 0.08 + k * 1.0;
      lidR.scale.y = 0.08 + k * 1.0;
      if (blinkPhase >= Math.PI) {
        blinkPhase = -1;
        lidL.scale.y = 0.08;
        lidR.scale.y = 0.08;
      }
    }

    // 随机转头（仅待机）
    if (action === "idle") {
      nextLook -= dt;
      if (nextLook <= 0) {
        headYawTarget = (Math.random() * 2 - 1) * HEAD_YAW_MAX;
        nextLook = 3 + Math.random() * 5;
      }
    } else {
      headYawTarget = 0;
    }
    headYaw += (headYawTarget - headYaw) * Math.min(1, dt * 2.2);

    // 摆尾
    tail.rotation.z = Math.sin(elapsed * 2.3) * 0.18;
    tail.rotation.x = Math.sin(elapsed * 1.1) * 0.1;

    // 动作层
    let targetPitch = 0;
    if (action === "run") {
      const speed = 11;
      legs.forEach((leg, i) => {
        leg.rotation.z = Math.sin(actionT * speed + (i % 2 === 0 ? 0 : Math.PI)) * 0.55;
      });
      group.position.y = Math.abs(Math.sin(actionT * speed)) * 0.12;
      group.position.z = baseZ + Math.sin(actionT * 2.2) * 0.9;
      targetPitch = 0.12;
      if (actionT > 2.4) {
        legs.forEach((leg) => { leg.rotation.z = 0; });
        group.position.y = 0;
        group.position.z = baseZ;
        setAction("idle");
      }
    } else if (action === "roar") {
      const k = Math.min(1, actionT / 0.35);
      const release = Math.max(0, 1 - Math.max(0, actionT - 0.7) / 0.5);
      targetPitch = -0.5 * k * release;
      jaw.position.y = -0.34 - 0.1 * k * release;
      if (actionT > 1.3) {
        jaw.position.y = -0.34;
        setAction("idle");
      }
    } else if (action === "victory") {
      const k = Math.sin(Math.min(Math.PI, (actionT / 1.6) * Math.PI));
      group.position.y = k * 0.55;
      group.rotation.z = k * 0.16;
      targetPitch = -0.35 * k;
      legs[0].rotation.z = -k * 0.9;
      legs[1].rotation.z = -k * 0.9;
      if (actionT > 1.6) {
        group.position.y = 0;
        group.rotation.z = 0;
        legs[0].rotation.z = 0;
        legs[1].rotation.z = 0;
        setAction("idle");
      }
    } else {
      // 待机四肢归位
      legs.forEach((leg) => { leg.rotation.z *= Math.max(0, 1 - dt * 6); });
    }
    headPitch += (targetPitch - headPitch) * Math.min(1, dt * 5);
    head.rotation.y = headYaw;
    head.rotation.z = headPitch;
  }

  function dispose(): void {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  }

  return {
    group,
    update,
    playRun: () => { if (action === "idle") setAction("run"); },
    playRoar: () => { if (action !== "victory") setAction("roar"); },
    playVictory: () => setAction("victory"),
    setFurShells: (count: number) => { if (count !== shellCount) rebuildFur(count); },
    dispose,
  };
}
