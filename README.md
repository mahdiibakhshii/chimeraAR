# SamandAR — WebAR Ship Deck Demo

WebAR proof-of-concept using **8th Wall** (SLAM + image targets) + **Three.js**.  
Markers are detected, positions fused, and a 3D model is placed at the rod.  
GitHub Pages hosting — HTTPS, no server needed.

---

## Quick Start (for today)

### 1. Add Your 3D Model

Drop your GLB file at `assets/models/chimera_bird.glb`.  
If absent, a placeholder box appears automatically.

### 2. Deploy to GitHub Pages

```bash
cd g:/Projects/SamandAR
git init
git add .
git commit -m "initial"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/SamandAR.git
git push -u origin main
# Enable GitHub Pages: Settings → Pages → Source: main branch / root
```

Your URL will be: `https://YOUR_USERNAME.github.io/SamandAR/`

### 3. Print the Markers

The SVG marker files are in `assets/marker-images/`. Print at **A5 or A4 size**:
- `marker-a.svg` — Primary QR Sign (print 20 × 20 cm)
- `marker-b.svg` — Railing Sign (print 20 × 20 cm)
- `marker-c.svg` — Rod Sign (print 10 × 10 cm)

**Use matte lamination** — glossy causes glare in sunlight and breaks tracking.

### 4. Test on Phone

Open the GitHub Pages URL on iOS Safari or Android Chrome.  
Allow camera access. Point at a printed marker.

---

## On-Site Calibration (on the ship deck)

### Step 1 — Install markers at their positions

Place `marker-a` near the QR code sign, `marker-b` on the railing,  
`marker-c` directly on the rod.

### Step 2 — Measure offsets with a tape measure

For each marker, measure the 3D vector FROM the marker center TO the rod center:

```
Coordinate system (when looking AT the marker straight-on):
  X = right   (+X is to YOUR right)
  Y = up       (+Y toward the sky)
  Z = forward  (NEGATIVE = further from you / into the scene)

Example: Rod is 2m forward and 0.8m above marker-a:
  offsetToRod: { x: 0.0, y: 0.8, z: -2.0 }
```

### Step 3 — Edit calibration.js

Open `js/calibration.js` and update the values:

```javascript
export const MARKERS = {
  'marker-a': {
    label: 'QR Sign (primary)',
    offsetToRod: { x: 0.0, y: 0.8, z: -2.0 },  // ← MEASURE AND UPDATE
    physicalWidth: 0.20,
    weight: 0.5,
  },
  'marker-b': {
    label: 'Railing Sign',
    offsetToRod: { x: -0.5, y: 0.3, z: -0.8 }, // ← MEASURE AND UPDATE
    physicalWidth: 0.20,
    weight: 0.7,
  },
  'marker-c': {
    label: 'Rod Sign',
    offsetToRod: { x: 0.0, y: 0.3, z: 0.0 },   // ← usually small offset
    physicalWidth: 0.10,
    weight: 1.0,
  },
};
```

**Weight guide:**
- `1.0` — marker is ON the rod (most accurate)
- `0.7` — marker is < 1m from rod
- `0.5` — marker is ~2m from rod
- `0.3` — marker is > 3m from rod

### Step 4 — Push and reload

```bash
git add js/calibration.js
git commit -m "calibration: updated ship deck offsets"
git push
```

GitHub Pages deploys in ~30 seconds. Reload the URL on your phone.

---

## Debug Overlay Guide

The bottom panel shows real-time diagnostics:

| Field | Meaning |
|-------|---------|
| ⬜ Marker name | Marker not yet seen |
| ✅ Marker name | Marker detected, contributing to estimate |
| Rod Position | Current fused rod estimate (x, y, z in meters) |
| Confidence % | % of total weight contributing — higher = more accurate |
| Reset All Markers | Clears all detections, re-scan fresh |
| Hide/Show Debug Cylinder | Toggle wireframe cylinder at rod position |

**What to watch on the ship:**
1. Scan marker-a → confidence ~33%, rough estimate appears
2. Move to see marker-b → confidence ~57%, position refines
3. See marker-c (on rod) → confidence ~100%, maximum accuracy

---

## Project Structure

```
SamandAR/
├── index.html              # Entry point
├── css/style.css           # Styles + debug overlay
├── js/
│   ├── app.js              # 8th Wall + Three.js pipeline
│   ├── calibration.js      # ⭐ EDIT THIS ON-SITE
│   ├── marker-manager.js   # Multi-marker fusion logic
│   └── debug-overlay.js    # Debug UI
├── assets/
│   ├── models/
│   │   └── chimera_bird.glb  ← add your model here
│   ├── targets/            # image-target-cli output (JSON + images)
│   └── marker-images/      # SVG source + PNG (for printing)
├── vendor/8thwall/
│   ├── xr.js               # 8th Wall engine binary
│   ├── xr-slam.js          # SLAM module (auto-loaded)
│   └── resources/
│       └── media-worker.js # Camera worker
└── tools/                  # Marker generation scripts
```

---

## Regenerating Image Targets

If you design new marker images, regenerate the tracking data:

```bash
# 1. Generate PNG from SVG
cd tools && npm install && node generate-markers.js

# 2. Process with image-target-cli
node process-targets.js

# 3. Fix imagePath in the generated JSON files
node -e "
const fs = require('fs');
['marker-a','marker-b','marker-c'].forEach(name => {
  const p = \`../assets/targets/\${name}.json\`;
  const j = JSON.parse(fs.readFileSync(p));
  j.imagePath = \`assets/targets/\${name}_luminance.png\`;
  fs.writeFileSync(p, JSON.stringify(j, null, 2));
  console.log('Fixed:', name);
});
"
```

---

## Architecture Notes

```
8th Wall SLAM (xr-slam.js)
  └─ buildWorldMap() — tracks device position in physical space
  └─ detectImageTargets() — fires reality.imagefound per marker

MarkerManager (marker-manager.js)
  └─ onMarkerDetected(name, pos, rot)
       └─ estimateRodFromMarker() — pos + rot.rotate(offsetToRod)
       └─ fuseEstimates() — weighted average of all estimates
       └─ emits positionUpdate event

app.js
  └─ positionUpdate handler → moves model + debug cylinder to fused position
  └─ Three.js camera synced from processCpuResult.reality each frame
  └─ GLB model persists at world-space position via SLAM
```

---

## iOS Safari Note

This works on iOS Safari because 8th Wall runs its own SLAM algorithm  
in JavaScript/WASM via `getUserMedia`. It does NOT use WebXR API  
(which Safari doesn't support). No WebXR required.

---

## Troubleshooting

**Model appears in wrong position:**  
→ Update `offsetToRod` in `calibration.js` for the relevant marker.

**Marker not detected:**  
→ Ensure good lighting, matte print, and marker is flat and unobstructed.  
→ Check that `assets/targets/{name}.json` and `{name}_luminance.png` exist.

**SLAM drifts:**  
→ Move the camera around slowly before scanning markers to build a better world map.  
→ Look at varied features (floor, walls, equipment) not just the sky.

**Debug cylinder visible but model not:**  
→ Model GLB may be missing — check `assets/models/chimera_bird.glb` exists.

**Error in console about targets:**  
→ Verify `imagePath` in `assets/targets/*.json` points to the luminance PNG.  
→ Should be: `"imagePath": "assets/targets/marker-a_luminance.png"` (relative to index.html).
