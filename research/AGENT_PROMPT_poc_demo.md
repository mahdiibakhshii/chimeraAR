# Agent Prompt — SamandAR Proof of Concept

Copy the text below and paste it into a new chat to start the implementation.

---

## PROMPT START — COPY FROM HERE ⬇️

I need you to build a **proof-of-concept WebAR project** in `g:\Projects\SamandAR` that I can demo **tomorrow** on a ship deck. The goal is to validate the technical stack and multi-marker spatial understanding.

### What the POC must do:
1. User opens the web page on their phone (served from GitHub Pages via HTTPS)
2. Camera activates, SLAM world tracking starts
3. User points camera at **any one** of several printed image markers
4. A **static 3D model** (GLB file) appears at the **rod position** — calculated as a known offset from whichever marker was detected
5. The model **persists in world space** via SLAM even when the user looks away from the marker
6. If the user then sees a **different marker**, the system **refines** the rod position using that marker's known offset — giving better localization accuracy
7. A small **debug overlay** on screen shows: which markers have been detected, current estimated rod position, and confidence level

### Multi-Marker System — This Is the Core Feature:
The ship deck will have multiple image markers placed at known positions. Each marker knows its own offset to the rod. When any single marker is detected, we can place the model. When multiple markers are detected (sequentially or simultaneously), we average/fuse their estimates for better accuracy.

**How it works:**
```
Marker A (QR sign) ──── offset A ────→ Rod position estimate A
Marker B (on railing) ── offset B ──→ Rod position estimate B  
Marker C (on rod itself) ─ offset C → Rod position estimate C

If only A seen:     rod_pos = estimate_A
If A then B seen:   rod_pos = weighted_average(estimate_A, estimate_B)
If A, B, C seen:    rod_pos = weighted_average(A, B, C)  ← most accurate
```

Each marker should have a **confidence weight** — markers closer to the rod get higher weight (marker C on the rod itself would have the highest weight).

**The calibration config must be easily editable** because tomorrow I'm going to the ship to find the best marker positions and measure their real offsets. I need to be able to quickly update numbers in one config file and see the result.

### Technology Stack (DECIDED — do not change):
- **8th Wall Engine Binary** — for BOTH image tracking AND SLAM world tracking in a single framework
- **Three.js** — for 3D rendering
- **Self-hosted on GitHub Pages** — static files only, no server
- The 8th Wall engine binary includes SLAM and is free to use. Download from https://8th.io/xrjs
- The 8th Wall open-source repo is at https://github.com/8thwall/8thwall — it contains an `image-target-cli` tool at `apps/image-target-cli/` for processing marker images
- With SLAM+World Tracking enabled, 8th Wall supports up to **5 simultaneous image targets**

### Architecture (Image → SLAM Handoff with Multi-Marker Fusion):
1. 8th Wall initializes with SLAM enabled (`data-preload-chunks="slam"`)
2. Image target detection finds ANY marker → fires `xrimagefound` with marker's world-space position/rotation
3. We look up that marker's pre-calibrated offset to the rod in `calibration.js`
4. We calculate a rod position estimate from this marker
5. If we already have previous estimates from other markers, we fuse them (weighted average)
6. We place/update the 3D model at the fused rod position
7. SLAM keeps the model anchored in world space

### Calibration Config (the key file I'll edit on-site tomorrow):

```javascript
// calibration.js — I will update these values on the ship deck tomorrow
// Each marker has: its name, its offset to the rod, and a confidence weight

export const MARKERS = {
  'marker-a': {
    label: 'QR Sign (primary)',
    // Offset FROM this marker TO the rod, in meters
    // X = right, Y = up, Z = forward (negative = into scene)
    offsetToRod: { x: 0, y: 0.8, z: -2.0 },
    weight: 0.5,  // Medium confidence (2m away from rod)
  },
  'marker-b': {
    label: 'Railing Sign',
    offsetToRod: { x: -0.5, y: 0.3, z: -0.8 },
    weight: 0.7,  // Higher confidence (closer to rod)
  },
  'marker-c': {
    label: 'Rod Sign',
    offsetToRod: { x: 0, y: 0.3, z: 0 },
    weight: 1.0,  // Highest confidence (ON the rod)
  },
};

export const MODEL_SCALE = 0.3;
export const ROD_VISUAL = true;  // Show a debug cylinder at estimated rod position
```

### Debug Overlay (important for tomorrow's scouting):
Show a semi-transparent debug panel on screen with:
- List of markers: name + "✅ detected" or "⬜ not seen"
- Current rod position estimate (x, y, z)
- Number of markers contributing to estimate
- A "Reset" button that clears all marker detections and lets me re-scan
- Toggle to show/hide a debug wireframe cylinder at the estimated rod position

This debug info is critical — tomorrow I'll walk around the ship deck, hold up the phone, and see how the position estimate improves as more markers come into view. This helps me decide where to permanently install markers.

### 3D Model:
I already have a GLB model. Place it at `assets/models/chimera_bird.glb`. If the file doesn't exist yet, use a **placeholder**: a colored cube or sphere so I can at least see where the model gets placed. I'll drop my real model in before testing.

### Image Markers:
I don't have final marker images yet. For the POC:
- Generate or find **3 distinct high-contrast test images** that work well as AR markers (asymmetric, detailed, non-repeating)
- Process all 3 with the 8th Wall `image-target-cli` tool
- Name them `marker-a`, `marker-b`, `marker-c` matching the calibration config
- I'll print them tomorrow morning and take them to the ship
- Make them easily printable (good at A5 or A4 size)

### Project Structure:
```
SamandAR/
├── index.html                # Entry point
├── css/
│   └── style.css             # Minimal styling + debug overlay
├── js/
│   ├── app.js                # Main: init 8th Wall + Three.js + pipeline
│   ├── calibration.js        # ⭐ Marker offsets — I edit this on-site
│   ├── marker-manager.js     # Multi-marker fusion logic
│   └── debug-overlay.js      # On-screen debug info
├── assets/
│   ├── models/
│   │   └── chimera_bird.glb  # 3D model (I'll add this)
│   ├── targets/              # Processed image target files from CLI
│   └── marker-images/        # Source images for printing
│       ├── marker-a.jpg
│       ├── marker-b.jpg
│       └── marker-c.jpg
├── vendor/
│   └── 8thwall/              # Engine binary files from 8th.io/xrjs
├── research/                 # Already exists — research docs from prior chat
└── README.md
```

### Key Research Context:
There are detailed research documents already in `g:\Projects\SamandAR\research\`. The most important ones:
- `06_8thwall_implementation_blueprint.md` — has pipeline module code, multi-marker coordinate fusion logic, and project structure
- `07_marker_design_and_animation_guide.md` — has marker design specs for outdoor use
- `05_research_summary.md` — has all architecture decisions

Read these files before starting to understand the full context.

### Critical Requirements:
1. **Must work on iOS Safari** — 8th Wall provides its own SLAM via JS/WASM, doesn't rely on WebXR
2. **Must work on Android Chrome** — standard support
3. **Must use HTTPS** — GitHub Pages provides this
4. **Frontend only** — no server, no API calls, everything static
5. **Model must persist when looking away from marker** — SLAM world tracking
6. **Works with 1 marker** — must function when only a single marker is detected
7. **Improves with more markers** — position refines when additional markers are seen
8. **Easy on-site calibration** — I must be able to edit `calibration.js` numbers and redeploy quickly

### What I need from you:
1. Set up the project scaffold
2. Download and integrate the 8th Wall engine binary
3. Create/source 3 distinct printable marker images
4. Process them with the image-target-cli
5. Implement the multi-marker fusion system (`marker-manager.js`)
6. Implement the debug overlay
7. Write the pipeline that demonstrates: marker detection → rod position estimation → model placement → SLAM persistence → refinement on additional markers
8. Make sure it deploys to GitHub Pages
9. Include a simple README with instructions for on-site calibration (how to measure and update offsets)

### iOS Safari Note:
8th Wall works on iOS Safari because it runs its own SLAM algorithm in JavaScript/WebAssembly using `getUserMedia` for camera access. It does NOT use the WebXR API (which Safari doesn't support). The 8th Wall API is the same regardless of platform.

## PROMPT END — COPY TO HERE ⬆️
