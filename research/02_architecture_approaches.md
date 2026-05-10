# Architecture Approaches for SamandAR

> **Project**: SamandAR — Animated Chimera Bird WebAR Experience  
> **Date**: 2026-05-10  
> **Purpose**: Detailed analysis of viable architectural approaches for implementing SLAM + spatial anchoring + animated 3D bird

---

## The Core Challenge

The project requires three capabilities working together:

1. **Spatial Anchor** — Establish a known reference point (QR code / image marker) with a known position in the real world
2. **Environment Understanding** — Know where surfaces/objects are, or at minimum, maintain a stable world coordinate system
3. **Animated 3D Path** — A bird Chimera that flies from one point to another (from initial position to a rod) and sits on it

Since this is deployed for a **specific, known location**, we can exploit pre-calibrated spatial relationships rather than runtime environment scanning.

---

## Approach A: "Pure Image Anchor" (No SLAM Required)

### Concept
Use the QR code (or a custom image marker next to it) as the **only anchor**. Since you know the exact physical relationship between the QR code and the rod, you pre-program the rod's position as a fixed offset from the marker.

### How It Works
```
[Physical World]
    QR Code ──── known offset (measured) ────> Rod
    (0,0,0)                                   (dx, dy, dz)

[AR Scene]
    Image Target Entity (origin)
        └── Bird Model (animated along CatmullRomCurve3)
        └── Virtual Rod (placed at measured offset)
```

### Implementation
1. Use **MindAR.js** or **AR.js** for image tracking
2. Register the QR code (or a companion marker) as an image target
3. Place the bird and a virtual rod as children of the image target entity
4. Animate the bird along a `THREE.CatmullRomCurve3` path from its spawn point to the rod
5. Bird plays "fly" animation during path traversal, switches to "perch/sit" at destination

### Pros
- ✅ **Simplest implementation** — no SLAM needed at all
- ✅ Works on ALL browsers (iOS Safari, Android Chrome)
- ✅ Lightweight, fast loading
- ✅ 100% open-source (MindAR is MIT)
- ✅ Perfect for GitHub Pages

### Cons
- ❌ **Object disappears when marker is lost** (user moves camera away from QR code)
- ❌ If the rod is far from the QR code, the virtual rod position drifts/jitters
- ❌ Limited to the viewing angle that includes the marker
- ❌ No real environment understanding — bird can't "interact" with real surfaces

### Mitigation: Marker Persistence
You can partially mitigate the "disappears on marker loss" issue:
```javascript
AFRAME.registerComponent('persist-on-lost', {
  init: function() {
    this.el.addEventListener('targetLost', event => {
      this.el.object3D.visible = true;  // Force visible
    });
  }
});
```
But the object will "freeze" in the last known position — it won't track with the environment.

### Verdict
> **Best for**: Proof of concept, or if the rod is very close to the QR code. **Not ideal** if the user needs to look away from the QR code area to see the rod.

---

## Approach B: "Image Anchor → World Tracking Handoff" (Hybrid)

### Concept
Start with image tracking to establish the coordinate origin, then hand off to SLAM/world tracking so the AR scene persists even when the marker is no longer visible.

### How It Works
```
Phase 1: Image Detection (MindAR or 8th Wall Image Targets)
    ┌─────────────────────────────┐
    │ Camera sees QR code/marker  │
    │ → Establishes world origin  │
    │ → Spawns bird at marker     │
    └──────────┬──────────────────┘
               │
Phase 2: World Tracking (8th Wall SLAM or WebXR)
    ┌──────────▼──────────────────┐
    │ Bird is reparented to world │
    │ → SLAM maintains position   │
    │ → Bird flies toward rod     │
    │ → Rod position = pre-cal.   │
    └─────────────────────────────┘
```

### Implementation with 8th Wall
1. Load 8th Wall engine binary with `slam` chunk
2. Configure both Image Targets and World Tracking
3. On `image-found` event:
   - Record the marker's world-space transform
   - Calculate the rod position using pre-measured offset
   - Spawn the bird at the marker location
4. Reparent the bird from image-target entity to scene root (world space)
5. Animate the bird along the path to the rod
6. SLAM keeps everything stable regardless of where the user looks

### Implementation with WebXR (Android only)
1. Start WebXR `immersive-ar` session with `hit-test` and `anchors` features
2. Use a custom image detection step (could use a separate library or manual approach)
3. Create an `XRAnchor` at the detected position
4. Animate the bird in world space

### Pros
- ✅ **Best visual result** — AR content persists in world space
- ✅ Bird can fly across the room to the rod naturally
- ✅ User can look around freely without losing the scene
- ✅ Professional-grade experience

### Cons
- ⚠️ Requires 8th Wall binary for iOS support (closed-source binary, though free)
- ⚠️ More complex implementation
- ⚠️ Larger file size (8th Wall SLAM binary ~2-4MB)
- ⚠️ WebXR-only approach excludes iOS Safari users

### Verdict
> **Best for**: Production-quality experience. **Recommended approach** if cross-platform support matters.

---

## Approach C: "Pure World Tracking" (No Image Anchor)

### Concept
Skip the image anchor entirely. Use SLAM to detect a surface, then the user taps to place the bird. The rod position is a fixed offset from the placement point.

### How It Works
1. Camera activates → SLAM starts mapping the environment
2. User sees a reticle on detected surfaces
3. User taps to place the bird → bird spawns at tap location
4. Rod is placed at a pre-defined offset from the bird's spawn
5. Bird animates to the rod

### Pros
- ✅ No need for physical marker maintenance
- ✅ User has full freedom of placement
- ✅ Clean UX after initial placement

### Cons
- ❌ **Loses the spatial precision** — rod placement is relative to an arbitrary user tap, not a real-world anchor
- ❌ The bird won't fly to the ACTUAL rod in the physical space
- ❌ Requires user interaction (tap to place)
- ❌ Still needs 8th Wall binary for iOS SLAM

### Verdict
> **Not recommended** for this project because the goal is environment-aware animation tied to specific physical objects (the rod).

---

## Approach D: "Multi-Marker Triangulation" (No SLAM, High Precision)

### Concept
Place multiple image markers at known positions in the installation space. Track them simultaneously to triangulate the world coordinate system with higher precision.

### How It Works
```
[Physical Installation]
    Marker A (QR code)    ───── 2m ─────    Marker B (logo)
         │                                       │
         │              Rod (target)              │
         └──── 1.5m ────    ●    ──── 1.8m ──────┘
                         (known position)

[AR Logic]
    If Marker A visible → origin = Marker A transform
    If Marker B visible → origin = Marker B transform (with offset)
    If both visible → triangulate for highest accuracy
    
    Rod position always calculated from whichever marker is active
```

### Implementation
1. Use **MindAR.js** with `maxTrack: 2` (or more)
2. Register multiple image targets (QR code, additional markers)
3. When any marker is detected, calculate the world origin
4. Use consistent world coordinates regardless of which marker is visible
5. Animate the bird in this coordinate system

### Pros
- ✅ **No SLAM required** — pure image tracking
- ✅ Works on all browsers including iOS Safari
- ✅ Higher precision than single marker (redundancy)
- ✅ User can move between markers without losing the scene
- ✅ Fully open-source (MIT)

### Cons
- ⚠️ Requires physical installation of multiple markers
- ⚠️ Still requires at least ONE marker to be visible at all times
- ⚠️ More complex coordinate math
- ⚠️ MindAR tracking multiple targets increases CPU usage

### Verdict
> **Excellent compromise** if you don't want SLAM dependency. **Best for specific installations** where you control the physical space.

---

## Recommended Architecture Decision

### For Maximum Compatibility + Quality: **Approach B (Hybrid) using 8th Wall Binary**

```
8th Wall Engine Binary (free, self-hosted)
    ├── Image Target: QR Code / Custom Marker
    ├── SLAM: World Tracking for persistence
    └── Three.js: Rendering + Animation
        ├── GLTFLoader → Bird Chimera model
        ├── AnimationMixer → fly / perch animations
        └── CatmullRomCurve3 → flight path
```

### For Simplicity + Full Open Source: **Approach D (Multi-Marker) using MindAR**

```
MindAR.js (MIT, open-source)
    ├── Image Targets: QR Code + additional markers
    ├── Coordinate triangulation logic
    └── A-Frame / Three.js: Rendering + Animation
        ├── GLTF model loading
        ├── Animation system
        └── Path interpolation
```

---

## Key Decision Points (Need Your Input)

1. **Is iOS Safari support critical?** → This determines whether we need 8th Wall or can use WebXR
2. **How far is the rod from the QR code?** → If <1m, pure image tracking (Approach A) might suffice
3. **Can you install additional markers?** → If yes, Approach D becomes very attractive
4. **Is the bird visible while the QR code is out of view?** → If yes, we need SLAM (Approach B)
5. **GPL-3.0 acceptable?** → If yes, AlvaAR becomes an option for SLAM
