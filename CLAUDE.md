# SamandAR — Agent Reference

WebAR proof-of-concept for a ship deck installation. Detects printed image markers, fuses their poses via weighted average, and places a 3D GLB model at a pre-calibrated rod position. Runs entirely client-side on GitHub Pages (HTTPS, no server).

**Live URL:** `https://mahdiibakhshii.github.io/samand-eslar-chimera/`
**GitHub repo:** `https://github.com/mahdiibakhshii/samand-eslar-chimera` — branch `webar`

---

## File Map

```
SamandAR/
├── index.html              HTML shell. Importmap for Three.js, loads xr.js with SLAM chunk.
├── css/style.css           Full-screen canvas layout, debug overlay styles.
├── js/
│   ├── app.js              Main entry. 8th Wall pipeline module, Three.js scene, model loading.
│   ├── calibration.js      ⭐ EDIT ON-SITE. Marker offsets, weights, model scale.
│   ├── marker-manager.js   Multi-marker fusion. Weighted average → rod world position.
│   └── debug-overlay.js    Debug panel UI. Reads MarkerManager events, updates DOM.
├── assets/
│   ├── models/
│   │   └── chimera_bird.glb    Drop GLB here. Placeholder box if absent.
│   ├── targets/            image-target-cli output. JSON + luminance/thumbnail PNGs per marker.
│   └── marker-images/      SVG source + generated PNG/JPG for printing.
├── vendor/8thwall/
│   ├── xr.js               8th Wall engine binary (~1MB). Self-hosted, not cloud.
│   ├── xr-slam.js          SLAM module (~5.5MB). Contains XrController. Auto-loaded via data-preload-chunks.
│   └── resources/
│       └── media-worker.js Camera processing worker (~5MB).
├── tools/
│   ├── generate-markers.js Converts SVG → PNG/JPG using sharp.
│   └── process-targets.js  Runs 8th Wall image-target-cli on PNGs. Requires separate CLI clone.
└── research/               Pre-build research docs. Informational only — not loaded at runtime.
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| SLAM + Image Tracking | 8th Wall Engine Binary (`@8thwall/engine-binary@1.0.0`) | Self-hosted. NOT the retired 8th Wall cloud platform (retired Feb 2026). |
| 3D Rendering | Three.js r0.170.0 | Loaded via importmap from CDN. ES modules. |
| Hosting | GitHub Pages | Static HTTPS. No server. |
| Device | iOS Safari + Android Chrome | 8th Wall runs WASM SLAM via getUserMedia. WebXR NOT used. |

---

## 8th Wall Pipeline — Critical API Facts

### Bootstrap sequence
```javascript
// app.js bottom — must wait for 'xrloaded' event if XR8 not yet ready
if (window.XR8) startAR(); else window.addEventListener('xrloaded', startAR);

async function startAR() {
  const targetData = await loadTargetData(); // fetch assets/targets/*.json
  XR8.XrController.configure({
    disableWorldTracking: false,             // false = SLAM ON (this is the default)
    imageTargetData: targetData,             // array of parsed JSON objects
  });
  XR8.addCameraPipelineModules([
    XR8.GlTextureRenderer.pipelineModule(),  // camera feed → #camerafeed canvas
    XR8.XrController.pipelineModule(),       // SLAM + image targets (from xr-slam.js)
    buildPipelineModule(),                   // our app
  ]);
  XR8.run({ canvas: document.getElementById('camerafeed') });
}
```

### Pipeline module shape
```javascript
{
  name: 'samandar-ar',
  onStart: ({ canvas, canvasWidth, canvasHeight }) => {},
  onUpdate: ({ processCpuResult }) => {
    // SLAM camera pose — sync to Three.js camera every frame
    const { rotation, position, intrinsics } = processCpuResult.reality;
    camera.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w); // 8th Wall: {w,x,y,z} named props
    camera.position.set(position.x, position.y, position.z);
    if (intrinsics?.length >= 16) {
      camera.projectionMatrix.fromArray(intrinsics);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
  },
  onRender: () => { renderer.clearDepth(); renderer.render(scene, camera); },
  onCanvasSizeChange: ({ canvasWidth, canvasHeight }) => {},
  listeners: [                              // ← image target events go here, NOT as callbacks on module
    { event: 'reality.imagefound',   process: (event) => { const d = event?.detail ?? event; /* d.name, d.position, d.rotation */ } },
    { event: 'reality.imageupdated', process: (event) => { const d = event?.detail ?? event; } },
    { event: 'reality.imagelost',    process: (event) => { const d = event?.detail ?? event; } },
  ],
}
```

**GOTCHA — listeners process arg:** The `process` function receives either a raw object `{name, position, rotation, ...}` or a wrapped `{detail: {...}}` depending on 8th Wall version. Always use `const d = event?.detail ?? event` to safely handle both.

**GOTCHA — configure option name:** Use `disableWorldTracking: false` NOT `enableWorldTracking: true`. Wrong name silently fails.

**GOTCHA — XrController location:** `XR8.XrController` lives in `xr-slam.js`, not `xr.js`. Both must be served. `data-preload-chunks="slam"` on the xr.js script tag triggers xr-slam.js loading.

**GOTCHA — pipeline callbacks for image targets:** `onImageFound` / `onImageUpdated` / `onImageLost` as pipeline module methods do NOT exist in this binary. Use the `listeners` array with event name strings.

### Image target event detail shape
```javascript
{
  name: 'marker-a',            // matches key in MARKERS calibration object
  position: { x, y, z },      // world-space position of marker center (SLAM frame)
  rotation: { w, x, y, z },   // world-space quaternion
  scale: number,
  metadata: {},
  type: 'PLANAR',
}
```

### Two-canvas rendering
- `#camerafeed` canvas: 8th Wall GlTextureRenderer owns this. Do not touch.
- `#three-canvas` (injected by app.js): Three.js overlay. `alpha: true, autoClear: false`.
- Per frame: `renderer.clearDepth()` then `renderer.render(scene, camera)`. Camera feed shows through.

---

## Multi-Marker Fusion

**File:** `js/marker-manager.js`

```
rodEst(marker) = markerWorldPos + markerWorldRot.rotate(marker.offsetToRod)
rodFused = Σ(est_i × weight_i) / Σ(weight_i)
rodPosition.lerp(rodFused, UPDATE_LERP)   // smooths jitter between frames
```

- `onMarkerLost` is a no-op — SLAM keeps the world position valid after marker leaves view.
- `confidence` = sum of detected marker weights / total possible weight (0–1).
- `reset()` clears `_detections` Map and `rodPosition`, dispatches 'reset' event.
- Emits `'positionUpdate'` CustomEvent with `{ position, confidence, detectedCount, detectedNames }`.

---

## Calibration (`js/calibration.js`)

**This is the only file that needs editing on-site.**

```javascript
export const MARKERS = {
  'marker-a': {
    label: 'QR Sign (primary)',
    offsetToRod: { x: 0.0, y: 0.8, z: -2.0 },  // meters FROM marker center TO rod center
    physicalWidth: 0.20,  // printed marker width in meters
    weight: 0.5,          // trust level (on rod=1.0, <1m=0.7, ~2m=0.5, >3m=0.3)
  },
  // ... marker-b, marker-c
};
export const MODEL_SCALE = 0.3;   // GLB uniform scale
export const ROD_VISUAL  = true;  // show wireframe debug cylinder
export const UPDATE_LERP = 0.35;  // position smoothing (0=frozen, 1=instant)
```

**Coordinate system:** X=right, Y=up, Z=forward (negative Z = into scene away from viewer).

**On-site update workflow:** scan marker → observe model in debug overlay → measure discrepancy → edit offsetToRod → git push → reload.

---

## Image Targets (`assets/targets/`)

Each marker has 4 files generated by `image-target-cli`:
- `marker-a.json` — tracking data. `imagePath` must be `"assets/targets/marker-a_luminance.png"` (relative to `index.html`).
- `marker-a_luminance.png` — grayscale for tracking.
- `marker-a_thumbnail.png`, `marker-a_cropped.png` — preview only.

**If regenerating targets:**
```bash
cd tools && npm install && node generate-markers.js   # SVG → PNG
node process-targets.js                               # PNG → JSON + luminance
# Then fix imagePath in generated JSONs:
node -e "
const fs=require('fs');
['marker-a','marker-b','marker-c'].forEach(n=>{
  const p=\`../assets/targets/\${n}.json\`;
  const j=JSON.parse(fs.readFileSync(p));
  j.imagePath=\`assets/targets/\${n}_luminance.png\`;
  fs.writeFileSync(p,JSON.stringify(j,null,2));
});
"
```

`process-targets.js` requires the 8th Wall CLI cloned at `../8thwall/apps/image-target-cli/`. The CLI is interactive — pipe stdin to automate: `echo "path\nflat\ny\nout\nname" | node src/index.js`.

---

## Deployment

Branch `webar` → GitHub Pages.

```bash
git add .
git commit -m "message"
git push origin webar
# Pages deploys in ~30s. URL: https://mahdiibakhshii.github.io/samand-eslar-chimera/
```

To change GitHub Pages source branch: repo Settings → Pages → Branch.

---

## Do Not Modify Without Reason

| File | Why |
|------|-----|
| `vendor/8thwall/xr.js` | Engine binary — must match xr-slam.js version |
| `vendor/8thwall/xr-slam.js` | SLAM module — version-locked to xr.js |
| `vendor/8thwall/resources/media-worker.js` | Camera worker — path expected by xr.js |
| `assets/targets/*.json` `imagePath` field | Must be `assets/targets/{name}_luminance.png` or tracking silently fails |
