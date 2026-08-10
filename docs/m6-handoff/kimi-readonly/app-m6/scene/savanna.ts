/**
 * M6-2 · 非洲草原场景
 * - 起伏地形 / 动态天空穹顶（昼夜过渡 + 太阳光晕）/ 漂移云层
 * - GPU Instancing：草（带风摆着色器注入）与金合欢树
 * - LOD：树近实远牌 / 草距离淡出
 * - 体积感：地面流动雾层 + 扬尘粒子
 */
import * as THREE from "three";

export interface SavannaEnv {
  group: THREE.Group;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  skyUniforms: {
    uTopColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uSunIntensity: { value: number };
    uTime: { value: number };
  };
  /** 黄昏插值：0 = 白昼，1 = 免费旋转黄昏金 */
  setDusk(k: number): void;
  setDensity(grass: number, trees: number, clouds: number): void;
  setGroundFog(on: boolean): void;
  update(elapsed: number, dt: number, camera: THREE.Camera): void;
  dispose(): void;
}

function makeNoiseTexture(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    const v = Math.floor(Math.random() * 255);
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function makeCloudTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  for (let i = 0; i < 18; i += 1) {
    const x = 20 + Math.random() * 88;
    const y = 18 + Math.random() * 28;
    const r = 10 + Math.random() * 16;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,252,246,0.55)");
    g.addColorStop(1, "rgba(255,252,246,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function createSavanna(
  initial: { grassCount: number; treeCount: number; cloudCount: number; groundFog: boolean },
): SavannaEnv {
  const group = new THREE.Group();
  group.name = "savanna";

  // ---- 地形 ----
  const terrainGeo = new THREE.PlaneGeometry(260, 260, 120, 120);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cDry = new THREE.Color("#b3945a");
  const cGreen = new THREE.Color("#7d8a45");
  const tmpColor = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h =
      Math.sin(x * 0.045) * Math.cos(z * 0.05) * 1.6 +
      Math.sin(x * 0.15 + z * 0.11) * 0.35;
    const d = Math.hypot(x, z);
    pos.setY(i, d < 14 ? h * (d / 14) : h); // 中央游戏区压平
    const mix = THREE.MathUtils.clamp(0.5 + Math.sin(x * 0.08) * Math.cos(z * 0.07) * 0.5, 0, 1);
    tmpColor.lerpColors(cGreen, cDry, mix);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  terrainGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
  );
  terrain.receiveShadow = true;
  group.add(terrain);

  // ---- 动态天空穹顶 ----
  const skyUniforms = {
    uTopColor: { value: new THREE.Color("#3d7ec9") },
    uHorizonColor: { value: new THREE.Color("#f2d8a0") },
    uSunDir: { value: new THREE.Vector3(0.4, 0.55, -0.72).normalize() },
    uSunIntensity: { value: 1.0 },
    uTime: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        uniform float uSunIntensity;
        uniform float uTime;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.62));
          float sun = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
          // 太阳圆盘 + 光晕
          col += vec3(1.0, 0.86, 0.6) * pow(sun, 900.0) * 6.0 * uSunIntensity;
          col += vec3(1.0, 0.8, 0.5) * pow(sun, 24.0) * 0.55 * uSunIntensity;
          // 高空缓慢流动的细微亮带
          col += vec3(0.04) * sin(vDir.x * 8.0 + uTime * 0.05) * h * h;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  sky.renderOrder = -10;
  group.add(sky);

  // ---- 光照 ----
  const sun = new THREE.DirectionalLight("#ffe9c4", 2.6);
  sun.position.set(20, 32, -36);
  const hemi = new THREE.HemisphereLight("#bcd7ff", "#8a6f42", 0.9);
  group.add(sun, hemi);

  // ---- 草（Instanced + 顶点风摆）----
  const bladeGeo = new THREE.PlaneGeometry(0.09, 0.7, 1, 3);
  bladeGeo.translate(0, 0.35, 0);
  const grassMat = new THREE.MeshLambertMaterial({ color: "#a8a35c", side: THREE.DoubleSide });
  const grassTimeUniform = { value: 0 };
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = grassTimeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uWindTime;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
           float sway = sin(uWindTime * 1.8 + ip.x * 0.35 + ip.z * 0.41) * 0.12;
           // 距离淡出（简易 LOD）：远处草压低
           float distFade = smoothstep(90.0, 40.0, length(ip.xz));
           transformed.y *= distFade;
           transformed.x += sway * transformed.y;
         #endif`,
      );
  };
  const MAX_GRASS = 4000;
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, MAX_GRASS);
  grass.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy = new THREE.Object3D();
  const grassColor = new THREE.Color();
  for (let i = 0; i < MAX_GRASS; i += 1) {
    const r = 6 + Math.pow(Math.random(), 0.7) * 85;
    const a = Math.random() * Math.PI * 2;
    dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    dummy.rotation.y = Math.random() * Math.PI;
    const s = 0.7 + Math.random() * 0.9;
    dummy.scale.set(s, s * (0.8 + Math.random() * 0.6), s);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    grassColor.setHSL(0.16 + Math.random() * 0.06, 0.42, 0.4 + Math.random() * 0.18);
    grass.setColorAt(i, grassColor);
  }
  grass.instanceColor!.needsUpdate = true;
  group.add(grass);

  // ---- 金合欢树（Instanced 双件 + 远景十字广告牌 LOD）----
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 3.4, 7);
  trunkGeo.translate(0, 1.7, 0);
  const canopyGeo = new THREE.SphereGeometry(2.6, 12, 8);
  canopyGeo.scale(1.5, 0.42, 1.5);
  canopyGeo.translate(0, 3.9, 0);
  const MAX_TREES = 24;
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: "#4d3a26", roughness: 1 }), MAX_TREES);
  const canopies = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ color: "#5f6e35", roughness: 1 }), MAX_TREES);
  // 远景十字面片 LOD
  const billboardGeo = new THREE.PlaneGeometry(6, 6);
  const billboardTex = makeCloudTexture(); // 复用柔和团块纹理作为树冠剪影
  const billboardMat = new THREE.MeshBasicMaterial({
    map: billboardTex,
    transparent: true,
    color: "#4c5a2e",
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const billboards = new THREE.InstancedMesh(billboardGeo, billboardMat, MAX_TREES * 2);
  const treePos: THREE.Vector3[] = [];
  // 静态 LOD 分区：相机常驻中央，近树实体、远树十字面片
  let nearCount = 0;
  let farCount = 0;
  for (let i = 0; i < MAX_TREES; i += 1) {
    const r = 30 + Math.random() * 75;
    const a = Math.random() * Math.PI * 2;
    const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    treePos.push(p);
    const s = 0.8 + Math.random() * 0.9;
    dummy.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.08);
    dummy.scale.setScalar(s);
    if (r < 55) {
      dummy.position.copy(p);
      dummy.updateMatrix();
      trunks.setMatrixAt(nearCount, dummy.matrix);
      canopies.setMatrixAt(nearCount, dummy.matrix);
      nearCount += 1;
    } else {
      // 两块互相垂直的远景面片
      for (let k = 0; k < 2; k += 1) {
        dummy.position.set(p.x, 3.2 * s, p.z);
        dummy.rotation.set(0, k * Math.PI * 0.5, 0);
        dummy.updateMatrix();
        billboards.setMatrixAt(farCount * 2 + k, dummy.matrix);
      }
      farCount += 1;
    }
  }
  trunks.count = nearCount;
  canopies.count = nearCount;
  billboards.count = farCount * 2;
  group.add(trunks, canopies, billboards);

  // ---- 云层（漂移广告牌）----
  const cloudTex = makeCloudTexture();
  const cloudMat = new THREE.MeshBasicMaterial({
    map: cloudTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const MAX_CLOUDS = 10;
  const clouds: THREE.Mesh[] = [];
  for (let i = 0; i < MAX_CLOUDS; i += 1) {
    const cloud = new THREE.Mesh(new THREE.PlaneGeometry(26, 11), cloudMat);
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 60;
    cloud.position.set(Math.cos(a) * r, 24 + Math.random() * 16, Math.sin(a) * r);
    cloud.scale.setScalar(0.8 + Math.random() * 1.6);
    cloud.userData.speed = 0.35 + Math.random() * 0.5;
    cloud.renderOrder = -5;
    clouds.push(cloud);
    group.add(cloud);
  }

  // ---- 地面流动雾（体积雾感）----
  const fogNoise = makeNoiseTexture();
  const groundFogMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uNoise: { value: fogNoise },
      uColor: { value: new THREE.Color("#e8dcc0") },
      uOpacity: { value: 0.34 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform sampler2D uNoise;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 uv1 = vUv * 4.0 + vec2(uTime * 0.014, uTime * 0.004);
        vec2 uv2 = vUv * 7.0 - vec2(uTime * 0.010, 0.0);
        float n = texture2D(uNoise, uv1).r * 0.65 + texture2D(uNoise, uv2).r * 0.35;
        float edge = smoothstep(0.5, 0.12, distance(vUv, vec2(0.5)));
        float a = smoothstep(0.35, 0.75, n) * edge * uOpacity;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });
  const groundFog = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), groundFogMat);
  groundFog.rotation.x = -Math.PI / 2;
  groundFog.position.y = 0.55;
  groundFog.renderOrder = 5;
  group.add(groundFog);

  // ---- 扬尘粒子（对象池 Points）----
  const DUST = 220;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i += 1) {
    const r = 5 + Math.random() * 30;
    const a = Math.random() * Math.PI * 2;
    dustPos[i * 3] = Math.cos(a) * r;
    dustPos[i * 3 + 1] = 0.3 + Math.random() * 3.2;
    dustPos[i * 3 + 2] = Math.sin(a) * r;
    dustSeed[i] = Math.random() * 100;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute("aSeed", new THREE.BufferAttribute(dustSeed, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.4 + aSeed) * 1.5;
        p.y += sin(uTime * 0.3 + aSeed * 2.0) * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 42.0 / -mv.z;
        vAlpha = 0.16 + 0.1 * sin(uTime + aSeed * 3.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        gl_FragColor = vec4(0.95, 0.88, 0.7, vAlpha * (1.0 - d * 2.0));
      }
    `,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  group.add(dust);

  // ---- 状态与控制 ----
  const dayTop = new THREE.Color("#3d7ec9");
  const dayHorizon = new THREE.Color("#f2d8a0");
  const duskTop = new THREE.Color("#3b2d5e");
  const duskHorizon = new THREE.Color("#f2a94e");
  let grassVisible = initial.grassCount;
  let treesVisible = initial.treeCount;
  let cloudsVisible = initial.cloudCount;

  grass.count = grassVisible;
  groundFog.visible = initial.groundFog;
  clouds.forEach((c, i) => { c.visible = i < cloudsVisible; });

  function update(elapsed: number, dt: number, camera: THREE.Camera): void {
    skyUniforms.uTime.value = elapsed;
    grassTimeUniform.value = elapsed;
    groundFogMat.uniforms.uTime.value = elapsed;
    dustMat.uniforms.uTime.value = elapsed;
    // 云漂移 + 面向相机
    for (let i = 0; i < cloudsVisible; i += 1) {
      const cloud = clouds[i];
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 110) cloud.position.x = -110;
      cloud.lookAt(camera.position);
    }
    // 树 LOD 为构建期静态分区（近实体 / 远面片），运行时零开销
  }

  function setDusk(k: number): void {
    skyUniforms.uTopColor.value.lerpColors(dayTop, duskTop, k);
    skyUniforms.uHorizonColor.value.lerpColors(dayHorizon, duskHorizon, k);
    sun.intensity = 2.6 - k * 1.1;
    sun.color.lerpColors(new THREE.Color("#ffe9c4"), new THREE.Color("#ff9d45"), k);
    hemi.intensity = 0.9 - k * 0.35;
  }

  function setDensity(grassCount: number, treeCount: number, cloudCount: number): void {
    grassVisible = Math.min(MAX_GRASS, grassCount);
    treesVisible = Math.min(MAX_TREES, treeCount);
    cloudsVisible = Math.min(MAX_CLOUDS, cloudCount);
    grass.count = grassVisible;
    // 档位变化按比例收缩静态 LOD 分区
    const ratio = treesVisible / MAX_TREES;
    trunks.count = Math.round(nearCount * ratio);
    canopies.count = trunks.count;
    billboards.count = Math.round(farCount * ratio) * 2;
    clouds.forEach((c, i) => { c.visible = i < cloudsVisible; });
  }

  function setGroundFog(on: boolean): void {
    groundFog.visible = on;
  }

  function dispose(): void {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        (obj.geometry as THREE.BufferGeometry).dispose();
        const mat = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
    fogNoise.dispose();
    cloudTex.dispose();
    billboardTex.dispose();
  }

  return {
    group,
    sun,
    hemi,
    skyUniforms,
    setDusk,
    setDensity,
    setGroundFog,
    update,
    dispose,
  };
}
