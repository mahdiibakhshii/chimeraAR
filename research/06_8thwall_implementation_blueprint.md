# 8th Wall Implementation Blueprint — SamandAR

> **Project**: SamandAR — Animated Chimera Bird on Ship Deck  
> **Date**: 2026-05-10  
> **Architecture**: Approach B — Image Anchor → World Tracking Handoff  
> **Platform**: 8th Wall (Image Targets + SLAM Engine Binary), unified framework  
> **Status**: CONFIRMED — Ready for implementation

---

## 1. Confirmed Project Parameters

| Parameter | Decision | Rationale |
|-----------|----------|-----------|
| **iOS Support** | ✅ Must have | ~50% of users; 8th Wall binary handles this via JS/WASM SLAM |
| **Architecture** | Approach B: Image → SLAM handoff | Persistent AR, works when QR code leaves view |
| **Framework** | 8th Wall only (Image Targets + SLAM) | Single framework = no compatibility issues |
| **Location** | Ship deck (outdoor, known layout) | Pre-calibrated positions, but outdoor lighting challenges |
| **QR-to-Rod distance** | ~2 meters | Within SLAM tracking range; multiple markers help |
| **Additional markers** | Yes, on the rod + around location | Improves accuracy, enables re-localization |
| **3D Model** | Exists, needs animation work | Fly, glide, land, perch clips needed |
| **Hosting** | GitHub Pages | Static files, HTTPS, free |

---

## 2. 8th Wall Project Architecture

### Repository Structure
```
SamandAR/
├── index.html                    # Entry point
├── css/
│   └── style.css                 # Loading screen, UI overlays, fallback styling
├── js/
│   ├── app.js                    # Main init: load 8th Wall, setup Three.js scene
│   ├── ar-pipeline.js            # 8th Wall pipeline module (camera, SLAM, image targets)
│   ├── bird-controller.js        # FSM: idle → fly → glide → land → perch
│   ├── flight-path.js            # CatmullRomCurve3 path + interpolation
│   ├── calibration.js            # Pre-measured offsets (QR → rod, waypoints)
│   └── marker-manager.js         # Multi-marker tracking + coordinate fusion
├── assets/
│   ├── models/
│   │   └── chimera_bird.glb      # Animated 3D model (<5MB)
│   ├── targets/
│   │   ├── qr-marker.jpg         # Primary QR/marker image
│   │   ├── rod-marker.jpg        # Rod marker image
│   │   └── targets.dat           # Compiled image targets (from 8th Wall CLI)
│   └── textures/                 # Additional textures if needed
├── vendor/
│   └── 8thwall/
│       ├── xr.js                 # 8th Wall engine binary (from 8th.io/xrjs)
│       └── xrextras.js           # Helper utilities
├── research/                     # This research folder
│   ├── 01_technology_landscape.md
│   ├── 02_architecture_approaches.md
│   ├── 03_animation_and_assets.md
│   ├── 04_device_compatibility_deployment.md
│   ├── 05_research_summary.md
│   └── 06_8thwall_implementation_blueprint.md
└── README.md
```

### Key Dependencies (loaded via script tags or CDN)
```html
<!-- 8th Wall Engine Binary (self-hosted) — provides SLAM + Image Targets -->
<script async src="./vendor/8thwall/xr.js"
        data-preload-chunks="slam"></script>

<!-- 8th Wall Extras (helpers for loading screens, gestures, etc.) -->
<script async src="./vendor/8thwall/xrextras.js"></script>

<!-- Three.js (from CDN for lighter repo) -->
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170/examples/jsm/"
  }
}
</script>
```

---

## 3. Core Flow: Image → SLAM Handoff

### Sequence Diagram

```
User                    Browser                    8th Wall Engine
  │                        │                            │
  │ Scan QR code           │                            │
  │───────────────────────>│                            │
  │                        │ Load page + request camera │
  │                        │───────────────────────────>│
  │                        │                            │
  │                        │ SLAM initializing...       │
  │                        │<───────────────────────────│
  │                        │ (building world map)       │
  │                        │                            │
  │ Point camera at marker │                            │
  │───────────────────────>│ xrimagefound event         │
  │                        │<───────────────────────────│
  │                        │                            │
  │                        │ PHASE 1:                   │
  │                        │ - Record marker world pose │
  │                        │ - Calculate rod position   │
  │                        │ - Spawn bird at marker     │
  │                        │                            │
  │                        │ PHASE 2:                   │
  │                        │ - Reparent bird to world   │
  │                        │ - Start flight animation   │
  │                        │ - Bird flies to rod        │
  │                        │                            │
  │ Look toward rod        │ SLAM maintains world       │
  │───────────────────────>│ (bird visible mid-flight)  │
  │                        │                            │
  │                        │ Bird reaches rod            │
  │                        │ - Play landing animation   │
  │                        │ - Switch to perch idle     │
  │                        │                            │
  │ (optional: see rod     │ xrimagefound (rod marker)  │
  │  marker → refine pos)  │ - Correct rod position     │
  │                        │                            │
```

### 8th Wall Pipeline Module

```javascript
// ar-pipeline.js — The core 8th Wall integration

const initPipelineModule = () => {
  let worldOriginSet = false;
  let markerWorldPosition = null;
  let markerWorldRotation = null;

  return {
    name: 'samandar-pipeline',

    // Called when 8th Wall has initialized
    onStart: ({canvas}) => {
      // Initialize Three.js scene, renderer, camera
      initThreeScene(canvas);
      
      // Load 3D bird model
      loadBirdModel('./assets/models/chimera_bird.glb');
    },

    // Called on every camera frame
    onUpdate: ({processCpuResult}) => {
      // Update animation mixer
      updateAnimations();
    },

    // Called when an image target is found
    onImageFound: ({detail}) => {
      const {name, position, rotation, scale} = detail;
      
      if (name === 'qr-marker' && !worldOriginSet) {
        // PHASE 1: Establish world coordinate origin
        markerWorldPosition = new THREE.Vector3(
          position.x, position.y, position.z
        );
        markerWorldRotation = new THREE.Quaternion(
          rotation.x, rotation.y, rotation.z, rotation.w
        );

        // Calculate rod position in world space
        const rodOffset = CALIBRATION.rod.position;
        const rodWorldPos = calculateWorldPosition(
          markerWorldPosition, markerWorldRotation, rodOffset
        );

        // Spawn bird at marker position (in world space)
        spawnBird(markerWorldPosition);

        // Create flight path from marker to rod
        createFlightPath(markerWorldPosition, rodWorldPos);

        worldOriginSet = true;

        // Start the experience!
        startBirdFlight();
      }
      
      if (name === 'rod-marker') {
        // OPTIONAL: Refine rod position using direct marker detection
        refineRodPosition(position, rotation);
      }
    },

    // Called when an image target is updated (still visible)
    onImageUpdated: ({detail}) => {
      // Can use this to continuously refine positions while marker visible
    },

    // Called when an image target is lost
    onImageLost: ({detail}) => {
      // No action needed — SLAM maintains world tracking
      // Bird continues flying in world space
    },

    // Called on render
    onRender: () => {
      renderThreeScene();
    },
  };
};
```

---

## 4. Multi-Marker Strategy for Ship Deck

### Physical Marker Layout

```
                            Ship Deck (Top View)
    ┌─────────────────────────────────────────────────────────┐
    │                                                         │
    │    ┌──────────┐                                         │
    │    │ QR Code  │ ← Primary anchor (user scans this)     │
    │    │ + Marker │    Image target: "qr-marker"            │
    │    │ Sign     │                                         │
    │    └──────────┘                                         │
    │         │                                               │
    │         │  ~2 meters                                    │
    │         │                                               │
    │         ▼                                               │
    │    ┌──────────┐                                         │
    │    │   Rod    │ ← Target destination                    │
    │    │  ┌────┐  │    Sign on rod: "rod-marker"            │
    │    │  │Sign│  │    (optional: refines position)         │
    │    │  └────┘  │                                         │
    │    └──────────┘                                         │
    │                                                         │
    └─────────────────────────────────────────────────────────┘
```

### Image Target Processing

The 8th Wall repo includes an **image-target-cli** tool for processing marker images:

```bash
# Install the CLI tool
cd apps/image-target-cli
npm install

# Process each marker image → generates .dat file
node index.js --input ./qr-marker.jpg --output ./targets/qr-marker.dat
node index.js --input ./rod-marker.jpg --output ./targets/rod-marker.dat
```

### Multi-Marker Coordinate Fusion

```javascript
// marker-manager.js — Tracks multiple markers, fuses coordinates

const MARKER_CONFIG = {
  'qr-marker': {
    role: 'primary-anchor',
    physicalWidth: 0.20,  // 20cm marker
    offsetToRod: { x: 0, y: 0, z: -2.0 },  // Rod is 2m "forward" from QR
  },
  'rod-marker': {
    role: 'secondary-anchor',
    physicalWidth: 0.10,  // 10cm marker on rod
    offsetToRod: { x: 0, y: 0.3, z: 0 },  // 30cm above marker = rod top
  }
};

class MarkerManager {
  constructor() {
    this.detectedMarkers = {};
    this.worldOrigin = null;
    this.rodWorldPosition = null;
  }

  onMarkerFound(name, position, rotation) {
    this.detectedMarkers[name] = { position, rotation, timestamp: Date.now() };
    
    if (name === 'qr-marker' && !this.worldOrigin) {
      // Set world origin from QR marker
      this.worldOrigin = { position, rotation };
      this.rodWorldPosition = this.calculateRodFromQR(position, rotation);
    }
    
    if (name === 'rod-marker' && this.rodWorldPosition) {
      // Refine rod position with direct observation
      const directRodPos = this.calculateRodFromRodMarker(position, rotation);
      this.rodWorldPosition = this.fusePositions(
        this.rodWorldPosition, directRodPos, 0.7  // 70% weight to direct observation
      );
    }
  }

  calculateRodFromQR(qrPos, qrRot) {
    const config = MARKER_CONFIG['qr-marker'];
    const offset = new THREE.Vector3(
      config.offsetToRod.x,
      config.offsetToRod.y,
      config.offsetToRod.z
    );
    offset.applyQuaternion(qrRot);  // Rotate offset by marker orientation
    return qrPos.clone().add(offset);
  }

  fusePositions(posA, posB, weightB) {
    return posA.clone().lerp(posB, weightB);
  }
}
```

---

## 5. Ship Deck Environment Challenges & Mitigations

### Outdoor/Maritime Challenges

| Challenge | Impact | Mitigation |
|-----------|--------|------------|
| **Bright sunlight / glare** | Camera overexposure → marker tracking fails | Use high-contrast markers with bold borders; matte laminated prints |
| **Variable lighting** | Clouds, shadows → inconsistent tracking | SLAM is more robust than pure image tracking; use it for persistence |
| **Wind** | User can't hold phone steady | Increase smoothing filters; wider tolerance for jitter |
| **Ship motion** | Deck moves (swell, vibration) | SLAM handles this — it tracks relative to the camera, not absolute position |
| **Reflective surfaces** | Metal deck, water reflections confuse SLAM | Ensure markers are on non-reflective surfaces; matte finish |
| **Device overheating** | Sun + AR processing → thermal throttling | Performance budget discipline; LOD system; time-limited experience |

### Marker Design Requirements for Ship Deck

```
Marker Requirements:
├── Print size: Minimum 20cm × 20cm (larger = better for outdoor)
├── Material: Matte lamination (anti-glare)
├── Colors: High contrast (black/white + one accent color)
├── Design: Asymmetric, non-repeating patterns
├── Mounting: Flat, secured against wind (sticker or bolted sign)
├── Weatherproofing: Waterproof printing or clear seal
└── Backup: Have spare copies in case of damage
```

---

## 6. Bird Animation Requirements

### Animation Clips Needed in GLB

| Clip Name | Duration | Loop | Description |
|-----------|----------|------|-------------|
| `idle` | 2-3s | ✅ Yes | Bird resting, subtle breathing/looking around |
| `takeoff` | 1-2s | ❌ No | Wings spread, launches upward |
| `fly` | 1-2s | ✅ Yes | Full wing flap cycle, forward flight pose |
| `glide` | 2-3s | ✅ Yes | Wings spread, gentle descent angle |
| `land` | 1-2s | ❌ No | Wings brake, feet extend, touchdown |
| `perch` | 3-5s | ✅ Yes | Sitting on rod, occasional head movement |

### Blender Animation Notes
- Each animation should be a separate **Action** in Blender
- Use **NLA Editor** to organize actions before GLB export
- Root bone should be at origin — the code handles world positioning
- Wing bones need clear fold/unfold poses
- Tail/head bones add secondary motion for realism

---

## 7. Flight Path Design for 2m Distance

```
Side View (ship deck):

     1.5m ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ FLIGHT APEX
                                 ╱         ╲
     1.2m ─ ─ ─ ─ ─ ─ ─ ─ ─ ╱               ╲ APPROACH
                             ╱                   ╲
     0.8m ─ ─ ─ ─ ─ ─ ─  ╱                       ● ROD TOP (landing)
                          ╱                         │
     0.3m ─ ─ ─  TAKEOFF╱                          │ rod
                  ╱                                 │
     0.1m ── ● SPAWN                               │
             │                                      │
     0.0m ═══╧══════════════════════════════════════╧════ deck
           QR code                                  Rod
           (0,0,0)                          (~2m forward)
```

### Calibration Config (to be measured on-site)

```javascript
// calibration.js — MEASURE THESE VALUES ON THE SHIP DECK

export const CALIBRATION = {
  // Primary QR marker
  markers: {
    'qr-marker': {
      physicalWidth: 0.20,      // 20cm
    },
    'rod-marker': {
      physicalWidth: 0.10,      // 10cm sign on the rod
    }
  },

  // Rod position relative to QR marker center (in meters)
  // Coordinate system: X = right, Y = up, Z = backward (toward camera)
  // Negative Z = forward (into the scene, away from camera)
  rod: {
    position: { x: 0, y: 0.8, z: -2.0 },   // 2m forward, 0.8m high
    topOffset: { x: 0, y: 0.3, z: 0 },      // Rod top relative to rod base
  },

  // Bird spawn (relative to QR marker)
  bird: {
    spawnOffset: { x: 0, y: 0.1, z: 0 },    // Slightly above marker
    scale: 0.15,                              // Adjust based on model size
  },

  // Flight path waypoints (relative to QR marker)
  // These create the smooth curve the bird follows
  flightPath: [
    { x: 0.0,  y: 0.1,  z:  0.0 },          // Start: at QR marker
    { x: 0.0,  y: 0.3,  z:  0.0 },          // Takeoff: rise up
    { x: -0.3, y: 1.5,  z: -0.8 },          // Apex: highest point, slight curve
    { x: 0.1,  y: 1.2,  z: -1.5 },          // Approach: descending toward rod
    { x: 0.0,  y: 0.8,  z: -2.0 },          // Landing: rod top
  ],

  // Timing
  flightDuration: 6.0,       // seconds for full flight
  delayBeforeFlight: 1.5,    // seconds of idle after marker detection
};
```

---

## 8. Implementation Phases — COMPRESSED 7-DAY PLAN

> **Deadline**: 1 week from start  
> **Strategy**: Two parallel work tracks — code development + Blender animation run simultaneously  
> **Ship**: Static/docked — no motion compensation needed  

### Parallel Work Tracks

```
TRACK A (Code — implementing agent):
Day 1 ──── Day 2 ──── Day 3 ──── Day 4 ──── Day 5 ──── Day 6 ──── Day 7
Scaffold   Image      Flight     SLAM        Polish     On-site    Final
+8thWall   Targets    Path       Handoff     +UX        Testing    Fixes
+Three.js  +Events   +BirdFSM   +Persist    +Fallback  +Calib.    +Deploy

TRACK B (Art — you, in parallel):
Day 1 ──── Day 2 ──── Day 3 ──── Day 4 ──── Day 5 ──── Day 6 ──── Day 7
Marker     Marker     Bird       Bird        Export     Print      Install
Design     Process    Anim:fly   Anim:land   GLB+test   Markers   on ship
                      +idle      +perch      <5MB
```

### Day 1: Scaffold + 8th Wall Integration
**Code track:**
```
- [ ] Download 8th Wall engine binary from 8th.io/xrjs
- [ ] Create project structure (index.html, js/, css/, assets/, vendor/)
- [ ] Set up Three.js scene with 8th Wall pipeline module
- [ ] Get camera feed + SLAM world tracking running in browser
- [ ] Deploy to GitHub Pages, verify HTTPS + mobile camera access
```
**Art track:**
```
- [ ] Design primary marker image (high-contrast, asymmetric, ship/bird theme)
- [ ] Design rod marker image (smaller, distinct from primary)
- [ ] Generate QR code pointing to GitHub Pages URL
```

### Day 2: Image Targets + Marker Detection
**Code track:**
```
- [ ] Process marker images with 8thwall image-target-cli
- [ ] Add image targets to pipeline (xrimagefound / xrimagelost events)
- [ ] On marker found: log world position to console
- [ ] Load a placeholder cube at marker position to verify alignment
- [ ] Test on phone (outdoor if possible)
```
**Art track:**
```
- [ ] Validate markers through image-target-cli (aim for 4-5 star quality)
- [ ] Iterate on marker design if quality is low
- [ ] Begin bird animation: idle clip (subtle breathing, head turn)
```

### Day 3: Bird Loading + Flight Path
**Code track:**
```
- [ ] Implement GLTFLoader + DRACOLoader for bird model
- [ ] (Use placeholder model or rough GLB until final animations ready)
- [ ] Implement CatmullRomCurve3 flight path with calibration waypoints
- [ ] Implement FlightPathAnimator (getPointAt, lookAt tangent)
- [ ] Implement BirdController FSM (state machine skeleton)
```
**Art track:**
```
- [ ] Bird animation: fly clip (wing flap cycle, looping)
- [ ] Bird animation: glide clip (wings spread, descending)
```

### Day 4: SLAM Handoff + Persistence
**Code track:**
```
- [ ] On xrimagefound: establish world origin, calculate rod position
- [ ] Reparent bird from marker-relative to world space
- [ ] Start flight animation along pre-calibrated path
- [ ] Verify bird remains visible when camera looks away from marker
- [ ] Connect animation clips to flight progress phases
```
**Art track:**
```
- [ ] Bird animation: land clip (wings brake, transition to perch)
- [ ] Bird animation: perch clip (sitting, idle on rod)
- [ ] Clean up NLA editor, verify all 5 actions are separate
```

### Day 5: Integration + Polish
**Code track:**
```
- [ ] Integrate final bird GLB with all animation clips
- [ ] Test full flow: scan marker → bird spawns → flies → lands on rod
- [ ] Loading screen (CSS spinner while assets download)
- [ ] Camera permission request UX
- [ ] Fallback view for unsupported browsers (static 3D preview)
- [ ] Performance check: target 30+ FPS on mid-range phones
```
**Art track:**
```
- [ ] Export final GLB (<5MB, Draco compressed)
- [ ] Validate in gltf.report — all 5 clips present
- [ ] Print markers (matte lamination) — send to print shop
```

### Day 6: On-Site Calibration + Testing
```
- [ ] Visit ship deck with printed markers
- [ ] Install QR marker sign at chosen position
- [ ] Install rod marker
- [ ] Measure exact QR → rod offset (x, y, z in meters)
- [ ] Update calibration.js with real measurements
- [ ] Test on iOS Safari (iPhone) — verify SLAM works
- [ ] Test on Android Chrome — verify SLAM works
- [ ] Adjust flight path waypoints based on real-world feel
- [ ] Check sunlight conditions — does marker detection work?
```

### Day 7: Final Fixes + Go Live
```
- [ ] Fix any issues found during Day 6 testing
- [ ] Fine-tune animation timing and path curvature
- [ ] Optimize for any devices that struggled
- [ ] Generate final QR code with production GitHub Pages URL
- [ ] Push final version to GitHub Pages
- [ ] Full end-to-end test on ship deck
- [ ] Done! 🎉
```

### Stretch Goals (if time permits)
```
- [ ] Multi-marker coordinate fusion (rod marker refines position)
- [ ] Sound effects (wing flaps, landing)
- [ ] Particle effects (feathers, dust on landing)
- [ ] "Replay" button to re-trigger the flight animation
- [ ] Analytics (how many users completed the experience)
```

---

## 9. Critical Setup Steps

### Step 1: Get the 8th Wall Engine Binary

```bash
# Download from https://8th.io/xrjs
# OR from the GitHub release: https://github.com/8thwall/engine

# Unzip into your project
unzip xr-standalone.zip -d vendor/8thwall/
```

### Step 2: Process Image Targets

```bash
# Clone the 8th Wall repo for the CLI tool
git clone https://github.com/8thwall/8thwall.git
cd 8thwall/apps/image-target-cli
npm install

# Process your marker images
node index.js --input /path/to/qr-marker.jpg --output /path/to/project/assets/targets/
node index.js --input /path/to/rod-marker.jpg --output /path/to/project/assets/targets/
```

### Step 3: Local Development Server (HTTPS required)

```bash
# Install a simple HTTPS dev server
npx -y local-ssl-proxy --source 3001 --target 3000

# OR use the 8th Wall recommended approach:
npx -y http-server . --ssl --port 443
```

---

## 10. Open Items & Risks

| Item | Status | Action Required |
|------|--------|-----------------|
| **8th Wall binary download** | 🔲 Not yet done | Download from 8th.io/xrjs — **Day 1 priority** |
| **Marker images** | 🔲 Need design | See doc 07 for design specs — **Day 1 art track** |
| **Bird animation clips** | 🟡 In progress | 5 clips in Blender — **Days 2-4 art track** |
| **On-site measurements** | 🔲 Not yet done | Visit ship, measure offsets — **Day 6** |
| **iOS Safari testing** | 🔲 Not yet done | Critical: bring an iPhone to ship — **Day 6** |
| **Outdoor lighting test** | 🔲 Not yet done | Test at same time of day users will visit — **Day 6** |
| **Ship motion** | ✅ N/A | Ship is static/docked — no compensation needed |
| **Engine binary license** | ✅ Reviewed | Free for commercial/non-commercial use (binary-only) |
| **Marker printing** | 🔲 Not yet done | Matte lamination, weatherproof — **Day 5 art track** |
