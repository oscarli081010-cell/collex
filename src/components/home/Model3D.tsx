"use client";

import { useEffect, useRef } from "react";
import type * as T from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import s from "./home.module.css";

/* Real 3D models drawn over the CSS laptop and phone in Devices.tsx. The CSS device stays in the page: it sets the size
   and place, its scroll animations keep running, and this reads them each frame (the lid's angle, the body's turn, the
   phone's rise) and poses the model to match. Once the first 3D frame is drawn the CSS device is hidden; if WebGL or the
   model fails, it simply stays. three.js loads only when a device comes near the screen.

   Models: "MacBook Neo" and "iPhone 18 Pro Max" by Ranguel (sketchfab.com/Ranguel), CC BY 4.0, modified: recoloured,
   textures and the back's mark removed, compressed. Credited on the home page. */

const MODELS = { laptop: "/models/macbook-neo-1.glb", phone: "/models/iphone-18-pro-max-1.glb" };
const LAPTOP_LID_W = 0.2975; // metres, the model's lid width
const PHONE_W = 0.0792;
const BLEED = 0.12; // the canvas reaches this share of the device's width past each edge, so nothing clips as it turns
const LAPTOP_SHOT = { w: 1600, h: 1000 };
const PHONE_SCREEN = { w: 780, h: 1712 }; // the phone's screen is 0.072 × 0.158 m
const STATUS_H = 105; // the status bar, as in the CSS phone: 12.6cqw of a 93.4cqw-wide screen
const FADE_MS = 450;

type Kind = "laptop" | "phone";
type Three = typeof T;
type Mods = { THREE: Three; GLTFLoader: typeof import("three/examples/jsm/loaders/GLTFLoader.js").GLTFLoader; RoomEnvironment: typeof import("three/examples/jsm/environments/RoomEnvironment.js").RoomEnvironment };

let mods: Promise<Mods> | null = null;
function loadMods() {
  mods ??= Promise.all([
    import("three"),
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/environments/RoomEnvironment.js"),
  ]).then(([THREE, g, r]) => ({ THREE, GLTFLoader: g.GLTFLoader, RoomEnvironment: r.RoomEnvironment }));
  return mods;
}
const gltfs = new Map<Kind, Promise<GLTF>>();
function loadModel(m: Mods, kind: Kind) {
  let p = gltfs.get(kind);
  if (!p) {
    p = new m.GLTFLoader().loadAsync(MODELS[kind]);
    p.catch(() => gltfs.delete(kind)); // let a later visit try again
    gltfs.set(kind, p);
  }
  return p;
}
const images = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string) {
  let p = images.get(src);
  if (!p) {
    const img = new Image();
    img.src = src;
    p = img.decode().then(() => img);
    p.catch(() => images.delete(src));
    images.set(src, p);
  }
  return p;
}

function isDark() {
  const bg = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)?.map(Number) ?? [255, 255, 255];
  return 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2] < 128;
}

// Colours by material name, light and dark, to match the CSS devices (silver by day, space grey at night).
type Paint = { color: number; metal?: number; rough?: number };
const LAPTOP_PAINT: Record<string, [Paint, Paint]> = {
  Anodized_aluminum: [{ color: 0xd3d4d8, metal: 0.85, rough: 0.36 }, { color: 0x55575d, metal: 0.85, rough: 0.4 }],
  Touchpad_glass: [{ color: 0xc8c9cd, metal: 0.6, rough: 0.22 }, { color: 0x4b4d53, metal: 0.6, rough: 0.25 }],
  Touchpad_tint: [{ color: 0xc8c9cd, metal: 0.6, rough: 0.22 }, { color: 0x4b4d53, metal: 0.6, rough: 0.25 }],
  Keycap: [{ color: 0x1b1c1f, metal: 0, rough: 0.6 }, { color: 0x121316, metal: 0, rough: 0.6 }],
  Speaker_mesh: [{ color: 0x2a2b2f, metal: 0.2, rough: 0.7 }, { color: 0x1e1f22, metal: 0.2, rough: 0.7 }],
  Rubber_feet: [{ color: 0x232427, metal: 0, rough: 0.9 }, { color: 0x1a1b1d, metal: 0, rough: 0.9 }],
  Metal_screw: [{ color: 0x8a8b90, metal: 0.9, rough: 0.4 }, { color: 0x4a4b50, metal: 0.9, rough: 0.4 }],
  Gold_pads: [{ color: 0x3a3b3f }, { color: 0x2a2b2e }],
  USBC_port: [{ color: 0x3a3b3f }, { color: 0x2a2b2e }],
  Steel: [{ color: 0x6a6b70 }, { color: 0x3a3b3f }],
};
const PHONE_PAINT: Record<string, [Paint, Paint]> = {
  Anodized_aluminum: [{ color: 0xcfd0d4, metal: 1, rough: 0.28 }, { color: 0x45464c, metal: 1, rough: 0.3 }],
  Plastic_antena: [{ color: 0xb4b5b9, metal: 0.2, rough: 0.5 }, { color: 0x35363b, metal: 0.2, rough: 0.5 }],
  Frosted_glass: [{ color: 0xe2e3e6, metal: 0, rough: 0.55 }, { color: 0x2c2d31, metal: 0, rough: 0.55 }],
  Metal_tint: [{ color: 0xe2e3e6, metal: 0, rough: 0.55 }, { color: 0x2c2d31, metal: 0, rough: 0.55 }],
  Metal_Screw: [{ color: 0xcfd0d4, metal: 1, rough: 0.3 }, { color: 0x45464c, metal: 1, rough: 0.3 }],
};

export type ModelScreen = { shot: string; ring?: boolean };

export default function Model3D({ kind, screen, label }: { kind: Kind; screen: ModelScreen; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const want = useRef(screen); // the screen the page wants now; the drawing loop reads it each frame
  const { shot, ring } = screen;
  useEffect(() => { want.current = { shot, ring }; }, [shot, ring]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const device = canvas?.parentElement;
    if (!canvas || !device) return;
    let dead = false;
    let cleanup: (() => void) | null = null;

    // Start loading once the device is within a screen of view.
    const near = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      near.disconnect();
      loadMods()
        .then((m) => Promise.all([m, loadModel(m, kind)]))
        .then(([m, gltf]) => { if (!dead) cleanup = start(m, gltf, canvas, device, kind, want); })
        .catch(() => { /* the CSS device stays */ });
    }, { rootMargin: "100% 0px" });
    near.observe(device);

    return () => { dead = true; near.disconnect(); cleanup?.(); };
  }, [kind]);

  return <canvas ref={canvasRef} className={s.model} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

function start(m: Mods, gltf: GLTF, canvas: HTMLCanvasElement, device: HTMLElement, kind: Kind, want: React.RefObject<ModelScreen>) {
  const { THREE } = m;
  let renderer: T.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return () => {};
  }
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new m.RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, 1, 20000);
  camera.position.set(0, 0, 10000);

  // One copy of the model per device, with its own materials (clone() would share them between the hero and the tour).
  const model = gltf.scene.clone(true);
  const owned: T.Material[] = [];
  const paints = kind === "laptop" ? LAPTOP_PAINT : PHONE_PAINT;
  const painted: [T.MeshStandardMaterial, [Paint, Paint]][] = [];
  let screenMesh: T.Mesh | null = null;
  model.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    const mat = (mesh.material as T.Material).clone() as T.MeshStandardMaterial;
    mesh.material = mat;
    owned.push(mat);
    if (mat.name === "Screen") screenMesh = mesh;
    const p = paints[mat.name];
    if (p) {
      mat.transparent = false;
      mat.opacity = 1;
      painted.push([mat, p]);
    }
  });
  if (!screenMesh) { renderer.dispose(); return () => {}; }
  const scr = screenMesh as T.Mesh;

  // The screen: an unlit picture, painted on a canvas, mapped by the screen's own shape (top-left at the top-left).
  const size = kind === "laptop" ? LAPTOP_SHOT : PHONE_SCREEN;
  const paper = document.createElement("canvas");
  paper.width = size.w;
  paper.height = size.h;
  const ctx = paper.getContext("2d")!;
  const tex = new THREE.CanvasTexture(paper);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
  owned.push(screenMat);
  scr.material = screenMat;
  {
    const pos = scr.geometry.attributes.position;
    const flipU = kind === "phone"; // the phone's screen runs the other way across
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) - x0) / (x1 - x0), v = (pos.getZ(i) - z0) / (z1 - z0);
      uv[i * 2] = flipU ? 1 - u : u;
      uv[i * 2 + 1] = kind === "laptop" ? 1 - v : v;
    }
    scr.geometry = scr.geometry.clone();
    scr.geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  }

  // A soft shadow under the laptop, or behind the phone, that turns with it.
  const shade = document.createElement("canvas");
  shade.width = shade.height = 128;
  const sc = shade.getContext("2d")!;
  const grad = sc.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.22)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  sc.fillStyle = grad;
  sc.fillRect(0, 0, 128, 128);
  const shadeTex = new THREE.CanvasTexture(shade);
  const shadeMat = new THREE.MeshBasicMaterial({ map: shadeTex, transparent: true, depthWrite: false, opacity: 0.5 });
  owned.push(shadeMat);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadeMat);
  shadow.renderOrder = -1;

  // Pose: the model inside a pivot. For the laptop the pivot is the middle of the upright lid, where the CSS body turns.
  const pivot = new THREE.Group();
  scene.add(pivot);
  const holder = new THREE.Group();
  pivot.add(holder);
  holder.add(model);
  let lid: T.Object3D | null = null;
  let lidBase: T.Quaternion | null = null;
  if (kind === "laptop") {
    holder.position.set(0, -0.1, 0.1);
    lid = model.getObjectByName("Lid_2_18") ?? null;
    lidBase = lid?.quaternion.clone() ?? null;
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -0.0086, 0.004);
    shadow.scale.set(0.42, 0.3, 1);
    holder.add(shadow);
  } else {
    model.rotation.y = Math.PI; // its screen faces away as modelled
    shadow.position.set(0, -0.012, -0.012);
    shadow.scale.set(0.13, 0.22, 1);
    holder.add(shadow);
  }

  // The CSS parts this follows.
  const cssBody = device.querySelector<HTMLElement>(`.${s.l3Body}`);
  const cssLid = device.querySelector<HTMLElement>(`.${s.l3Lid}`);
  const cssPhone = device.querySelector<HTMLElement>(`.${s.phone}`);

  // Painting the screen: the current picture, fading in over the last one.
  let shown: { key: string; img: HTMLImageElement | null; ring: boolean } | null = null;
  let fading: { from: HTMLCanvasElement; t0: number } | null = null;
  let dark = isDark();
  let pending = "";
  let dirty = true;
  const prev = document.createElement("canvas");
  prev.width = size.w;
  prev.height = size.h;

  function draw(img: HTMLImageElement | null, ring: boolean) {
    const cs = getComputedStyle(document.body);
    ctx.fillStyle = cs.backgroundColor;
    ctx.fillRect(0, 0, size.w, size.h);
    if (kind === "laptop") {
      if (img) ctx.drawImage(img, 0, 0, size.w, size.h);
      if (ring) {
        const x = 0.7028 * size.w, y = 0.5416 * size.h, w = 0.1306 * size.w, h = 0.0489 * size.h;
        const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#213a73";
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x - 8, y - 8, w + 16, h + 16, (h + 16) / 2);
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = accent;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.roundRect(x - 1, y - 1, w + 2, h + 2, (h + 2) / 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = accent;
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // The status bar, then the page below it.
      ctx.fillStyle = cs.color;
      ctx.font = `600 33px ${cs.fontFamily}`;
      ctx.textBaseline = "middle";
      ctx.fillText("9:41", 83, STATUS_H / 2 + 4);
      const right = size.w - 70;
      ctx.beginPath();
      ctx.roundRect(right - 47, STATUS_H / 2 - 7, 47, 23, 7);
      ctx.lineWidth = 3;
      ctx.strokeStyle = cs.color;
      ctx.stroke();
      ctx.fillRect(right - 43, STATUS_H / 2 - 3, 32, 15);
      ctx.beginPath();
      ctx.roundRect(right - 47 - 10 - 28, STATUS_H / 2 - 5, 28, 19, 4);
      ctx.fill();
      if (img) ctx.drawImage(img, 0, STATUS_H, size.w, (size.w * img.naturalHeight) / img.naturalWidth);
    }
  }

  function sync() {
    const w = want.current;
    const key = `${w.shot}|${w.ring ? 1 : 0}|${dark ? "d" : "l"}`;
    if (shown?.key === key || pending === key) return;
    pending = key;
    loadImage(`/img/home/${w.shot}-${dark ? "dark" : "light"}.webp`).then((img) => {
      if (pending !== key) return;
      pending = "";
      const sameShot = shown && shown.key.split("|")[0] === w.shot; // a ring or a theme change swaps at once
      if (shown && !sameShot && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        prev.getContext("2d")!.drawImage(paper, 0, 0);
        fading = { from: prev, t0: performance.now() };
      }
      shown = { key, img, ring: !!w.ring };
      draw(img, shown.ring);
      tex.needsUpdate = true;
      dirty = true;
    }).catch(() => { pending = ""; });
  }

  function applyPaint() {
    for (const [mat, [light, night]] of painted) {
      const p = dark ? night : light;
      mat.color.setHex(p.color);
      if (p.metal !== undefined) mat.metalness = p.metal;
      if (p.rough !== undefined) mat.roughness = p.rough;
      mat.needsUpdate = true;
    }
    shadeMat.opacity = dark ? 0.7 : 0.45;
  }
  applyPaint();

  // Size: the canvas covers the device and a margin round it; the camera counts in CSS pixels, y up.
  let W = 0, H = 0, bleed = 0;
  function resize() {
    W = device.offsetWidth;
    H = device.offsetHeight;
    bleed = Math.round(W * BLEED);
    const cw = W + bleed * 2, ch = H + bleed * 2;
    Object.assign(canvas.style, { left: `${-bleed}px`, top: `${-bleed}px`, width: `${cw}px`, height: `${ch}px` });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(cw, ch, false);
    camera.left = 0; camera.right = cw; camera.top = 0; camera.bottom = -ch;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  resize();

  const S = new THREE.Matrix4().makeScale(1, -1, 1);
  const mat4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const ax = new THREE.Vector3(1, 0, 0);
  const pos = new THREE.Vector3();
  const sca = new THREE.Vector3();
  let lastPose = "";

  function pose() {
    if (kind === "laptop" && cssBody) {
      const bw = cssBody.offsetWidth, bh = cssBody.offsetHeight;
      const k = bw / LAPTOP_LID_W;
      const bm = new DOMMatrix(getComputedStyle(cssBody).transform === "none" ? undefined : getComputedStyle(cssBody).transform);
      const lm = cssLid ? new DOMMatrix(getComputedStyle(cssLid).transform === "none" ? undefined : getComputedStyle(cssLid).transform) : null;
      const lidDeg = lm ? (Math.atan2(lm.m23, lm.m22) * 180) / Math.PI : 8;
      const key = `${W}|${bm.toString()}|${lidDeg.toFixed(2)}`;
      if (key === lastPose) return false;
      lastPose = key;
      // The CSS rotation, turned from y-down to y-up.
      mat4.set(bm.m11, bm.m21, bm.m31, 0, bm.m12, bm.m22, bm.m32, 0, bm.m13, bm.m23, bm.m33, 0, 0, 0, 0, 1);
      mat4.premultiply(S).multiply(S);
      mat4.decompose(pos, q, sca);
      pivot.quaternion.copy(q);
      pivot.scale.setScalar(k);
      const cx = bleed + cssBody.offsetLeft + bw / 2 + bm.m41;
      const cy = bleed + cssBody.offsetTop + bh / 2 + bm.m42;
      pivot.position.set(cx, -cy, 0);
      // CSS lid: 8° is open, about -80° is shut. The model's lid: 0 upright, 90° shut onto the keys, -18° open.
      if (lid && lidBase) {
        const shut = Math.min(1, Math.max(0, (8 - lidDeg) / 88));
        const phi = ((-18 + shut * 106) * Math.PI) / 180;
        lid.quaternion.copy(q.setFromAxisAngle(ax, phi)).multiply(lidBase);
      }
    } else if (cssPhone) {
      const k = (cssPhone.offsetWidth / PHONE_W) * 0.97;
      // The CSS phone rises into place (its wrapper slides up from 34% lower); the model also turns as it rises.
      const dm = getComputedStyle(device).transform;
      const ty = dm === "none" ? 0 : new DOMMatrix(dm).m42;
      const rise = 1 - Math.min(1, Math.max(0, ty / (0.34 * H)));
      const key = `${W}|${H}|${rise.toFixed(3)}`;
      if (key === lastPose) return false;
      lastPose = key;
      pivot.scale.setScalar(k);
      pivot.position.set(bleed + cssPhone.offsetLeft + cssPhone.offsetWidth / 2, -(bleed + cssPhone.offsetTop + cssPhone.offsetHeight / 2), 0);
      pivot.rotation.set((-6 * Math.PI) / 180, ((-34 + rise * 16) * Math.PI) / 180, (-2 * Math.PI) / 180, "YXZ");
    }
    return true;
  }

  // Render only when something changed, and only while on screen.
  let raf = 0;
  let visible = false;
  let ready = false;
  function frame() {
    raf = 0;
    if (!visible) return;
    sync();
    let changed = pose() || dirty;
    if (fading) {
      const t = Math.min(1, (performance.now() - fading.t0) / FADE_MS);
      draw(shown?.img ?? null, shown?.ring ?? false);
      if (t < 1) {
        ctx.globalAlpha = 1 - t;
        ctx.drawImage(fading.from, 0, 0);
        ctx.globalAlpha = 1;
      } else fading = null;
      tex.needsUpdate = true;
      changed = true;
    }
    if (changed && shown) {
      dirty = false;
      renderer.render(scene, camera);
      if (!ready) {
        ready = true;
        device.dataset.model = "";
      }
    }
    raf = requestAnimationFrame(frame);
  }
  const seen = new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting);
    if (visible && !raf) raf = requestAnimationFrame(frame);
  }, { rootMargin: "10% 0px" });
  seen.observe(device);
  const ro = new ResizeObserver(() => { resize(); lastPose = ""; });
  ro.observe(device);

  // The theme: swap the screenshot and the paint when it changes.
  function onTheme() {
    const d = isDark();
    if (d === dark) return;
    dark = d;
    applyPaint();
    fading = null;
    dirty = true;
  }
  const mo = new MutationObserver(onTheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onTheme);

  // If the GPU drops the context, fall back to the CSS device.
  function lost(e: Event) { e.preventDefault(); delete device.dataset.model; visible = false; }
  canvas.addEventListener("webglcontextlost", lost);

  return () => {
    cancelAnimationFrame(raf);
    seen.disconnect();
    ro.disconnect();
    mo.disconnect();
    mq.removeEventListener("change", onTheme);
    canvas.removeEventListener("webglcontextlost", lost);
    delete device.dataset.model;
    for (const mat of owned) mat.dispose();
    tex.dispose();
    shadeTex.dispose();
    shadow.geometry.dispose();
    scr.geometry.dispose();
    env.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
