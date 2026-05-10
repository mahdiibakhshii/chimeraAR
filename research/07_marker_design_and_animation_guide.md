# Marker Design & Blender Animation Guide

> **Project**: SamandAR — Animated Chimera Bird on Ship Deck  
> **Date**: 2026-05-10  
> **Purpose**: Specifications for physical AR markers and Blender animation workflow

---

## Part 1: AR Marker Design Specifications

### Why Marker Design Matters

The marker is the **foundation** of your AR experience. A poorly designed marker means:
- Failed detection in bright sunlight
- Jittery/unstable 3D content
- Frustrated users who can't start the experience

8th Wall's image target system uses computer vision to detect and track feature points in the marker image. The more unique, high-contrast features your image has, the better it tracks.

---

### Design Rules for Outdoor Ship Deck Markers

#### ✅ DO

| Rule | Why |
|------|-----|
| **High contrast** (dark vs light areas) | Camera needs clear edges to detect |
| **Asymmetric design** | Helps determine orientation (which way is "up") |
| **Rich detail / texture** | More feature points = better tracking |
| **Matte finish print** | Prevents glare in sunlight |
| **Minimum 20cm × 20cm** (primary QR marker) | Larger = detectable from farther away |
| **Minimum 10cm × 10cm** (rod marker) | Secondary marker can be smaller |
| **Bold border** (2-3cm solid frame) | Helps with edge detection |
| **Unique, non-repeating patterns** | Avoids false matches |

#### ❌ DON'T

| Rule | Why |
|------|-----|
| **No large solid-color areas** | No feature points to track |
| **No symmetrical designs** | Can't determine rotation |
| **No glossy/reflective printing** | Causes glare → tracking failure |
| **No very thin lines or small text** | Invisible at distance |
| **No pure QR code as the marker** | QR codes are poor tracking targets (too regular/repetitive) |

---

### Recommended Marker Layout

#### Primary Sign (QR Code + AR Marker)

```
┌─────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────┐ │
│ │          3cm SOLID DARK BORDER          │ │
│ │  ┌───────────┐   ┌──────────────────┐  │ │
│ │  │           │   │                  │  │ │
│ │  │  QR Code  │   │   AR MARKER      │  │ │
│ │  │  (links   │   │   IMAGE          │  │ │
│ │  │  to URL)  │   │   (high-detail,  │  │ │
│ │  │           │   │    asymmetric,   │  │ │
│ │  │  8×8 cm   │   │    artistic)     │  │ │
│ │  │           │   │                  │  │ │
│ │  │           │   │   12×12 cm       │  │ │
│ │  └───────────┘   └──────────────────┘  │ │
│ │                                         │ │
│ │   "Scan to see the Chimera"  ← text    │ │
│ │          3cm SOLID DARK BORDER          │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│          Total sign: ~30cm × 25cm           │
└─────────────────────────────────────────────┘
```

**Key**: The QR code handles the URL redirect. The AR marker image (next to the QR code) is what 8th Wall actually tracks. They are separate elements on the same physical sign.

#### Rod Marker (Secondary)

```
┌─────────────────────┐
│ ┌─────────────────┐ │
│ │  2cm BORDER     │ │
│ │  ┌───────────┐  │ │
│ │  │           │  │ │
│ │  │  Unique   │  │ │
│ │  │  Image    │  │ │
│ │  │  (bird    │  │ │
│ │  │   icon?)  │  │ │
│ │  │           │  │ │
│ │  └───────────┘  │ │
│ │  2cm BORDER     │ │
│ └─────────────────┘ │
│   Total: ~15cm      │
└─────────────────────┘
```

---

### Marker Image Suggestions

The AR marker image (not the QR code) should be something **visually interesting** that fits the Chimera/bird theme. Ideas:

1. **Stylized Chimera illustration** — detailed line art with varying textures
2. **Abstract feather pattern** — asymmetric, high-contrast feather design
3. **Persian/mythological artwork** — intricate patterns (Samandar = Salamander/Phoenix in Persian mythology)
4. **Mixed-media collage** — layered textures, stamps, handwriting fragments

Whatever you choose, run it through 8th Wall's image target quality checker or the CLI tool — it will score the image's tracking quality (aim for 4-5 stars out of 5).

---

### Printing & Mounting for Ship Deck

| Spec | Recommendation |
|------|----------------|
| **Print method** | Digital print on rigid board (Forex/Dibond) or heavy vinyl |
| **Finish** | **Matte lamination** — critical for anti-glare |
| **Mounting** | Screwed/bolted or heavy-duty adhesive; must resist wind |
| **Weather protection** | UV-resistant ink + clear matte seal |
| **Backup copies** | Print 2-3 extras in case of damage |
| **Viewing distance** | 20cm marker detectable from ~1.5m away |

---

## Part 2: Blender Animation Workflow

### Animation Strategy (Confirmed)

| What | Where | Notes |
|------|-------|-------|
| **Wing flap cycle** | Blender (skeletal animation) | Loop in GLB |
| **Head/tail movement** | Blender (skeletal animation) | Subtle secondary motion |
| **Takeoff pose** | Blender (skeletal animation) | Wings spread, body angled up |
| **Landing pose** | Blender (skeletal animation) | Wings brake, feet extend |
| **Perch idle** | Blender (skeletal animation) | Sitting, occasional head turn |
| **World position/movement** | JavaScript (Three.js) | `model.position.copy(pathPoint)` |
| **World rotation/orientation** | JavaScript (Three.js) | `model.lookAt(tangentPoint)` |
| **Path following** | JavaScript (Three.js) | `CatmullRomCurve3.getPointAt(t)` |

**In other words**: Blender handles how the bird *looks* (wing motion, body poses). JavaScript handles where the bird *is* (position, facing direction, speed).

---

### Required Blender Actions (Animation Clips)

Create these as separate **Actions** in Blender's Action Editor:

#### 1. `idle` (2-3 seconds, looping)
- Bird standing/resting
- Subtle breathing (chest expand/contract)
- Occasional head turn left/right
- Tail slight sway
- Wings folded against body

#### 2. `fly` (1-2 seconds, looping)
- Full wing flap cycle (up → down → up)
- Body angled slightly forward (~15° pitch)
- Tail streaming behind
- Head stable, looking forward
- Legs tucked under body

#### 3. `glide` (2-3 seconds, looping)
- Wings fully spread, held still (or very slight oscillation)
- Body level or slightly nose-down (descending)
- Tail spread for steering
- Peaceful, smooth pose

#### 4. `land` (1.5-2 seconds, one-shot)
- Wings flare wide (braking)
- Body rotates upright (from flight angle to perch angle)
- Legs extend downward
- Wings fold progressively
- Transition from flight pose to perch pose

#### 5. `perch` (3-5 seconds, looping)
- Sitting pose, feet gripping (if visible)
- Wings fully folded
- Occasional head movement (look left, right, tilt)
- Breathing motion
- Optional: tail adjustment

---

### Blender Export Checklist

```
Before Export:
├── ✅ All animations are separate Actions (not one long timeline)
├── ✅ Each Action is named exactly: idle, fly, glide, land, perch
├── ✅ Armature is at world origin (0,0,0)
├── ✅ Model faces -Y or +Y consistently (check in Three.js)
├── ✅ Scale is in meters (1 unit = 1 meter)
├── ✅ No unused materials/textures/objects
├── ✅ Texture resolution ≤ 1024×1024
├── ✅ Triangle count < 30k (target: 10-20k)
├── ✅ Remove any cameras, lights, empty objects

Export Settings (File → Export → glTF 2.0):
├── Format: glTF Binary (.glb)
├── Include: ✅ Selected Objects only (bird + armature)
├── Transform: +Y Up
├── Mesh:
│   ├── ✅ Apply Modifiers
│   ├── ✅ UVs
│   ├── ✅ Normals
│   └── ✅ Vertex Colors (if used)
├── Animation:
│   ├── ✅ Export Animations
│   ├── ✅ Group by NLA Track (exports separate clips)
│   ├── ✅ Optimize Keyframes
│   └── Sampling Rate: default (usually fine)
└── Compression:
    └── ✅ Draco mesh compression (quality: 6)
```

### How Three.js Reads Your Animations

```javascript
// After loading:
const gltf = await loader.loadAsync('./chimera_bird.glb');
console.log(gltf.animations);
// Output: [
//   AnimationClip { name: "idle", duration: 2.5, tracks: [...] },
//   AnimationClip { name: "fly", duration: 1.2, tracks: [...] },
//   AnimationClip { name: "glide", duration: 2.0, tracks: [...] },
//   AnimationClip { name: "land", duration: 1.8, tracks: [...] },
//   AnimationClip { name: "perch", duration: 4.0, tracks: [...] }
// ]

// The mixer plays these clips on the model's skeleton
const mixer = new THREE.AnimationMixer(gltf.scene);
const flyAction = mixer.clipAction(
  gltf.animations.find(c => c.name === 'fly')
);
flyAction.play();  // Bird's wings start flapping

// Meanwhile, JS moves the model through space:
gltf.scene.position.copy(pathPosition);  // Move bird along curve
gltf.scene.lookAt(pathTarget);           // Face flight direction
```

### Tip: NLA Editor for Clean Export

In Blender, use the **NLA Editor** to organize your Actions:

1. Open the NLA Editor
2. For each Action, click the "Push Down" snowflake icon → creates an NLA strip
3. Each NLA strip becomes a separate `AnimationClip` in the GLB export
4. Name each strip clearly (idle, fly, glide, land, perch)

If you skip this step and just have Actions without NLA strips, the export may merge them into one long clip, which makes it harder to play individual animations in Three.js.

---

## Part 3: Quick Validation Checklist

Before handing off to implementation:

```
Marker Design:
├── [ ] Primary marker image designed (high-contrast, asymmetric)
├── [ ] Run through 8th Wall image-target-cli → check quality score
├── [ ] Rod marker image designed
├── [ ] Both markers printed (matte lamination)
├── [ ] QR code generated pointing to GitHub Pages URL

3D Model:
├── [ ] Bird model polygon count < 30k triangles
├── [ ] Textures ≤ 1024×1024
├── [ ] 5 animation clips exported as separate clips in GLB
├── [ ] GLB file size < 5MB
├── [ ] Test load in https://gltf.report/ — verify all clips present
├── [ ] Test in Three.js editor — verify animations play correctly

On-Site:
├── [ ] Measure QR marker position (height from deck, placement)
├── [ ] Measure rod position relative to QR (x, y, z in meters)
├── [ ] Note any obstructions between QR and rod
├── [ ] Test phone camera in the location (sunlight levels)
├── [ ] Install markers securely
```
