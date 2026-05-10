// app.js — SamandAR main entry point
//
// Architecture:
//   xr.js (engine binary) — SLAM + image targets + camera feed rendering
//   xr-slam.js (loaded automatically via data-preload-chunks="slam") — XrController
//   Three.js (via importmap) — 3D rendering on overlay canvas
//
// Image target events arrive via pipeline module `listeners` array as 'reality.imagefound'
// SLAM camera pose arrives via processCpuResult.reality.{position, rotation, intrinsics}
// Event detail rotation is {w,x,y,z} — Three.js Quaternion constructor takes (x,y,z,w)

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

import { MARKERS, MODEL_SCALE, ROD_VISUAL } from './calibration.js';
import { MarkerManager } from './marker-manager.js';
import { DebugOverlay } from './debug-overlay.js';

// Expose THREE globally in case any 8th Wall helper needs it
window.THREE = THREE;

// ── Module-level state ─────────────────────────────────────────────────────
let scene, camera, renderer, animMixer, clock;
let model       = null;
let debugCylinder = null;
let markerManager = null;
let cylinderUserOn = true;
let started = false;

// ── 8th Wall Pipeline Module ───────────────────────────────────────────────

function buildPipelineModule() {
  return {
    name: 'samandar-ar',

    // ── Pipeline lifecycle callbacks ──────────────────────────────────────

    onStart: ({ canvas, canvasWidth, canvasHeight }) => {
      initThree(canvasWidth, canvasHeight);
      initMarkerSystem();
      loadModel();
      dismissLoadingScreen();
    },

    // Called every frame — sync Three.js camera to SLAM device pose
    onUpdate: ({ processCpuResult }) => {
      const reality = processCpuResult?.reality;
      if (!reality) return;

      const { rotation, position, intrinsics } = reality;

      // rotation from 8th Wall is {w, x, y, z} — THREE.Quaternion takes (x,y,z,w)
      camera.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      camera.position.set(position.x, position.y, position.z);

      // Apply real camera projection matrix when provided (accurate AR alignment)
      if (intrinsics && intrinsics.length >= 16) {
        camera.projectionMatrix.fromArray(intrinsics);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      }

      if (animMixer && clock) {
        animMixer.update(clock.getDelta());
      }
    },

    onRender: () => {
      if (!renderer || !scene || !camera) return;
      renderer.clearDepth();   // clear depth so 3D draws over camera feed
      renderer.render(scene, camera);
    },

    onCanvasSizeChange: ({ canvasWidth, canvasHeight }) => {
      if (!renderer) return;
      renderer.setSize(canvasWidth, canvasHeight);
      // Only update perspective fallback if intrinsics haven't been applied
      if (camera) {
        camera.aspect = canvasWidth / canvasHeight;
        camera.updateProjectionMatrix();
      }
    },

    // ── Image target events (via listeners array — 8th Wall's event API) ──

    listeners: [
      {
        event: 'reality.imagefound',
        process: (event) => {
          const d = event?.detail ?? event;
          markerManager?.onMarkerDetected(d.name, d.position, d.rotation);
        },
      },
      {
        event: 'reality.imageupdated',
        process: (event) => {
          const d = event?.detail ?? event;
          markerManager?.onMarkerDetected(d.name, d.position, d.rotation);
        },
      },
      {
        event: 'reality.imagelost',
        process: (event) => {
          const d = event?.detail ?? event;
          markerManager?.onMarkerLost(d.name);
        },
      },
    ],
  };
}

// ── Three.js Setup ─────────────────────────────────────────────────────────

function initThree(w, h) {
  // Separate overlay canvas — transparent, on top of 8th Wall's camera canvas
  const tc = document.createElement('canvas');
  tc.id = 'three-canvas';
  document.body.appendChild(tc);

  renderer = new THREE.WebGLRenderer({ canvas: tc, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.autoClear = false;          // don't clear — camera feed is on the canvas below
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, w / h, 0.01, 1000);
  clock  = new THREE.Clock();

  // Ship-deck lighting: strong ambient + directional sun
  scene.add(new THREE.AmbientLight(0xffffff, 2.5));
  const sun = new THREE.DirectionalLight(0xffe5b4, 3.0);
  sun.position.set(5, 10, 3);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8ecae6, 0.8);
  fill.position.set(-5, 2, -5);
  scene.add(fill);

  // Debug cylinder: wireframe at estimated rod position
  if (ROD_VISUAL) {
    const geo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00e676,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    debugCylinder = new THREE.Mesh(geo, mat);
    debugCylinder.visible = false;
    scene.add(debugCylinder);
  }
}

// ── Model Loading ──────────────────────────────────────────────────────────

function loadModel() {
  const draco = new DRACOLoader();
  draco.setDecoderPath(
    'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/'
  );
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  loader.load(
    'assets/models/chimera_bird.glb',
    (gltf) => {
      model = gltf.scene;
      model.scale.setScalar(MODEL_SCALE);
      model.visible = false;
      scene.add(model);

      if (gltf.animations?.length > 0) {
        animMixer = new THREE.AnimationMixer(model);
        const clip =
          gltf.animations.find((c) => c.name === 'idle')   ??
          gltf.animations.find((c) => c.name === 'perch')  ??
          gltf.animations[0];
        animMixer.clipAction(clip).play();
        clock.start();
      }
      console.log('[SamandAR] GLB loaded —', gltf.animations.map((c) => c.name));
    },
    undefined,
    () => {
      console.warn('[SamandAR] GLB not found — using placeholder');
      buildPlaceholderModel();
    }
  );
}

function buildPlaceholderModel() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.28, 0.12),
    new THREE.MeshPhongMaterial({ color: 0xff6d00, emissive: 0x331100 })
  );
  g.add(body);

  const wingMat = new THREE.MeshPhongMaterial({ color: 0xf9a825, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.14), wingMat);
    wing.position.set(side * 0.2, 0, 0);
    g.add(wing);
  }

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshPhongMaterial({ color: 0xffcc02 })
  );
  head.position.set(0, 0.19, 0);
  g.add(head);

  model = g;
  model.scale.setScalar(MODEL_SCALE);
  model.visible = false;
  scene.add(model);
}

// ── Marker Manager + Debug Overlay ────────────────────────────────────────

function initMarkerSystem() {
  markerManager = new MarkerManager();

  markerManager.addEventListener('positionUpdate', ({ detail }) => {
    const { position } = detail;
    if (!position) return;

    if (model) {
      model.position.copy(position);
      model.visible = true;
    }
    if (debugCylinder) {
      debugCylinder.position.copy(position);
      debugCylinder.visible = cylinderUserOn;
    }
  });

  new DebugOverlay(
    markerManager,
    // onReset callback
    () => {
      markerManager.reset();
      if (model)         model.visible = false;
      if (debugCylinder) debugCylinder.visible = false;
    },
    // onCylinderToggle callback
    (on) => {
      cylinderUserOn = on;
      if (debugCylinder) {
        debugCylinder.visible = on && !!markerManager.rodPosition;
      }
    }
  );
}

// ── Utilities ──────────────────────────────────────────────────────────────

function dismissLoadingScreen() {
  const el = document.getElementById('loading-screen');
  if (!el) return;
  el.classList.add('hidden');
  setTimeout(() => el.remove(), 600);
}

// Loads pre-processed target data from the image-target-cli JSON output.
// Returns an array of parsed JSON objects ready for XR8.XrController.configure.
async function loadTargetData() {
  const results = [];
  for (const name of Object.keys(MARKERS)) {
    try {
      const res = await fetch(`assets/targets/${name}.json`);
      if (res.ok) results.push(await res.json());
    } catch (_) { /* file absent — will be handled gracefully */ }
  }
  return results;
}

// ── 8th Wall Bootstrap ─────────────────────────────────────────────────────

async function startAR() {
  if (started) return;
  started = true;

  // Load pre-processed image target JSON files (generated by image-target-cli)
  const targetData = await loadTargetData();

  if (targetData.length === 0) {
    console.warn('[SamandAR] No image target JSON files found in assets/targets/.');
    console.warn('  Run: node tools/process-targets.js');
    console.warn('  Continuing without image targets — SLAM will still work.');
  }

  // Configure XrController (loaded from xr-slam.js via data-preload-chunks="slam")
  // disableWorldTracking defaults to false (SLAM is ON by default)
  XR8.XrController.configure({
    disableWorldTracking: false,
    ...(targetData.length > 0 && { imageTargetData: targetData }),
  });

  XR8.addCameraPipelineModules([
    XR8.GlTextureRenderer.pipelineModule(),  // renders camera feed to #camerafeed canvas
    XR8.XrController.pipelineModule(),        // SLAM world tracking + image targets
    buildPipelineModule(),                     // our app (Three.js scene + marker fusion)
  ]);

  XR8.run({ canvas: document.getElementById('camerafeed') });
}

// Start immediately if XR8 already loaded (synchronous), otherwise wait for xrloaded event
if (window.XR8) {
  startAR();
} else {
  window.addEventListener('xrloaded', startAR);
}
