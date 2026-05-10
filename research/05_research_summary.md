# Research Summary & Decision Guide

> **Project**: SamandAR — Animated Chimera Bird WebAR Experience  
> **Date**: 2026-05-10 (Updated with user decisions)  
> **Status**: ✅ DECISIONS CONFIRMED — Ready for implementation

---

## Research Documents Index

| # | Document | Contents |
|---|----------|----------|
| 01 | [01_technology_landscape.md](./01_technology_landscape.md) | Survey of WebAR technologies: WebXR, 8th Wall, AlvaAR, MindAR, AR.js |
| 02 | [02_architecture_approaches.md](./02_architecture_approaches.md) | Four architecture options with trade-offs analysis |
| 03 | [03_animation_and_assets.md](./03_animation_and_assets.md) | 3D model specs, animation state machine, flight path system, calibration |
| 04 | [04_device_compatibility_deployment.md](./04_device_compatibility_deployment.md) | Browser support matrix, iOS challenges, GitHub Pages deployment |
| 05 | [05_research_summary.md](./05_research_summary.md) | This document — summary and decision guide |
| 06 | [06_8thwall_implementation_blueprint.md](./06_8thwall_implementation_blueprint.md) | **Detailed implementation plan with 8th Wall, code examples, ship deck specifics** |
| 07 | [07_marker_design_and_animation_guide.md](./07_marker_design_and_animation_guide.md) | **Marker design specs for outdoor use + Blender animation workflow** |

---

## Confirmed Decisions

### ✅ Q1: iOS Safari → MUST HAVE
iOS support is required. This mandates using 8th Wall's engine binary for SLAM since Safari has no WebXR AR support.

### ✅ Q2: Location → Ship Deck, ~2m QR-to-Rod distance
Outdoor maritime environment. Rod is approximately 2 meters from the QR code. This is within SLAM range but too far for reliable image-only tracking when looking away from the marker.

### ✅ Q3: Persistence → YES, bird must remain visible after looking away
The bird must stay in its world-space position even when the QR code marker leaves the camera view. This confirms the need for SLAM world tracking (not just image tracking).

### ✅ Q4: Additional Markers → YES, can install on rod + around location
Multiple physical markers are available. A sign can be placed on the rod itself as a secondary anchor for position refinement.

### ✅ Q5: 3D Model → EXISTS, animations need work
The Chimera bird 3D model exists but needs animation clips: idle, takeoff, fly, glide, land, perch.

### ✅ Architecture Choice: Approach B — Image Anchor → World Tracking Handoff

### ✅ Framework: 8th Wall unified (Image Targets + SLAM engine binary)
Single framework to avoid compatibility issues between multiple libraries.

---

## Key Findings

### 1. 8th Wall Is the Right Choice
- **Only cross-platform SLAM solution** that works on both iOS Safari and Android Chrome
- Image Targets + SLAM can run simultaneously in the same project (up to 5 targets with SLAM enabled)
- Engine binary is **free** for commercial/non-commercial use
- Self-hostable on GitHub Pages (static files + HTTPS)
- The `xrimagefound` → `xrimagelost` event system handles the marker detection lifecycle

### 2. Ship Deck Presents Unique Challenges
- **Bright sunlight**: Camera overexposure can break marker tracking → use matte laminated, high-contrast markers
- **Wind/ship motion**: SLAM tracks relative to camera, so ship movement is actually handled well
- **Reflective surfaces**: Metal deck and water reflections can confuse SLAM → markers on non-reflective surfaces
- **Device overheating**: Sun + AR processing can throttle devices → strict performance budget

### 3. Multi-Marker Strategy Is Powerful
- Primary marker (QR code): establishes world origin when user first scans
- Secondary marker (on rod): refines rod position when the user looks toward the rod
- Coordinate fusion: when both markers have been seen, average their position estimates with weighting

### 4. Flight Path Implementation Is Straightforward
- `THREE.CatmullRomCurve3` through 5 waypoints (spawn → takeoff → apex → approach → landing)
- `getPointAt(t)` for smooth interpolation along the curve
- `getTangentAt(t)` for bird orientation (lookAt direction)
- Animation state machine crossfades between fly/glide/land clips based on progress

---

## Recommended Architecture (CONFIRMED)

```
8th Wall Engine Binary (free, self-hosted on GitHub Pages)
├── SLAM: World Tracking for persistent AR
├── Image Targets: QR code (primary) + Rod sign (secondary)
└── Three.js: Rendering + Animation
    ├── GLTFLoader → Chimera bird model
    ├── AnimationMixer → fly / glide / land / perch animations  
    ├── CatmullRomCurve3 → flight path
    └── BirdController FSM → state management
```

### Flow
```
1. User scans QR code → browser opens
2. 8th Wall initializes SLAM + starts building world map
3. User points camera at QR marker → xrimagefound fires
4. Bird spawns at marker, world origin established
5. Bird reparented to world space (SLAM handoff)
6. Bird flies along pre-calibrated path toward rod
7. (Optional) Rod marker detected → refine rod position
8. Bird lands on rod, plays perch animation
9. User can look freely — AR content persists via SLAM
```

---

## Additional Confirmed Details

- **Ship**: Static/docked — no motion compensation needed
- **Animations**: Skeletal animations (wing flap, head movement) in Blender → movement/pathfinding in JS
- **Markers**: Not yet designed — see doc 07 for design specs
- **Timeline**: 1 week (7 days) — parallel tracks (code + art)

---

## Next Steps for Implementation Agent

1. **Read documents 06 + 07** — contains complete code scaffolding, pipeline module, compressed 7-day plan, marker design specs, and Blender animation guide
2. **Download 8th Wall engine binary** from https://8th.io/xrjs
3. **Set up project scaffold** following the structure in doc 06
4. **Follow the compressed 7-day plan** with two parallel tracks (code + art)

### Compressed 7-Day Plan
```
Day 1: Scaffold + 8th Wall + Three.js integration
Day 2: Image target detection + marker processing
Day 3: Bird model loading + flight path + state machine
Day 4: SLAM handoff + world persistence
Day 5: Full integration + polish + UX
Day 6: On-site ship deck calibration + device testing
Day 7: Final fixes + deploy to GitHub Pages
```

> Art track runs in parallel: marker design (Days 1-2), Blender animations (Days 2-4), export + print (Day 5-6)
