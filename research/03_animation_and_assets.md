# 3D Animation & Asset Pipeline for WebAR

> **Project**: SamandAR — Animated Chimera Bird WebAR Experience  
> **Date**: 2026-05-10  
> **Purpose**: Technical guide for the 3D model, animation system, and flight path logic

---

## 1. Asset Requirements

### The Chimera Bird Model
The 3D model needs multiple animation clips baked into a single GLB file:

| Animation Clip | Purpose | Type |
|----------------|---------|------|
| `idle` | Bird resting / initial state | Looping |
| `fly` | Wing flapping, forward flight | Looping |
| `glide` | Wings spread, descending | Looping |
| `land` | Transition from flight to perch | One-shot |
| `perch` | Sitting on rod, subtle idle | Looping |

### Model Optimization Targets (Mobile WebAR)

| Metric | Target | Maximum |
|--------|--------|---------|
| **Triangle count** | 10k–20k | 50k |
| **Texture resolution** | 512×512 | 1024×1024 |
| **File size (GLB)** | < 2 MB | 5 MB |
| **Materials** | 1–2 | 4 |
| **Bones (skeleton)** | 15–30 | 50 |
| **Animation clips** | 3–5 | 8 |

### Optimization Tools
- **Blender**: Decimate modifier, texture baking, bone cleanup
- **gltf-transform**: `npx @gltf-transform/cli optimize input.glb output.glb`
- **gltfpack**: `gltfpack -i input.glb -o output.glb -tc -si 0.5`
- **Draco compression**: Reduces mesh data by up to 90% (Three.js has built-in `DRACOLoader`)
- **KTX2/Basis Universal**: GPU-friendly texture compression
- **gltf.report**: Web tool for inspecting and optimizing GLB files

### Export Settings (Blender → GLB)
```
Format: glTF Binary (.glb)
Include: ✅ Mesh, ✅ Animations, ✅ Skinning
Compression: ✅ Draco mesh compression
Animation: ✅ Export all actions as separate clips
Transform: ✅ +Y Up
Unit Scale: Meters
```

---

## 2. Animation System (Three.js)

### Core Components

```javascript
// Load model
const loader = new THREE.GLTFLoader();
const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
loader.setDRACOLoader(dracoLoader);

const gltf = await loader.loadAsync('./chimera_bird.glb');
const model = gltf.scene;
const animations = gltf.animations;

// Animation mixer
const mixer = new THREE.AnimationMixer(model);
const clock = new THREE.Clock();

// Create actions for each clip
const actions = {};
animations.forEach(clip => {
  actions[clip.name] = mixer.clipAction(clip);
});

// Play initial idle
actions['idle'].play();
```

### State Machine for Bird Behavior

```javascript
const BirdState = {
  IDLE: 'idle',
  FLYING: 'flying',
  GLIDING: 'gliding',
  LANDING: 'landing',
  PERCHED: 'perched'
};

class BirdController {
  constructor(model, mixer, actions) {
    this.model = model;
    this.mixer = mixer;
    this.actions = actions;
    this.state = BirdState.IDLE;
    this.currentAction = actions['idle'];
    this.pathProgress = 0;
  }

  transitionTo(newState) {
    const prevAction = this.currentAction;
    const nextAction = this.actions[newState];
    
    // Smooth crossfade between animations
    prevAction.fadeOut(0.3);
    nextAction.reset().fadeIn(0.3).play();
    
    this.currentAction = nextAction;
    this.state = newState;
  }

  update(delta) {
    this.mixer.update(delta);
    
    switch(this.state) {
      case BirdState.FLYING:
        this.updateFlightPath(delta);
        break;
      case BirdState.GLIDING:
        this.updateGlidePath(delta);
        break;
      case BirdState.LANDING:
        this.updateLanding(delta);
        break;
    }
  }
}
```

---

## 3. Flight Path System

### Defining the Path

The flight path from the bird's spawn point to the rod is defined as a 3D curve:

```javascript
// Pre-calibrated positions (relative to the anchor/marker)
const BIRD_SPAWN = new THREE.Vector3(0, 0.1, 0);      // At the marker
const FLIGHT_APEX = new THREE.Vector3(0.5, 1.5, -0.5); // Peak of flight arc
const APPROACH = new THREE.Vector3(1.2, 1.0, -1.0);    // Approaching rod
const ROD_TOP = new THREE.Vector3(1.5, 0.8, -1.2);     // Rod perch position

// Create smooth curve through waypoints
const flightPath = new THREE.CatmullRomCurve3([
  BIRD_SPAWN,
  FLIGHT_APEX,
  APPROACH,
  ROD_TOP
]);

// Optional: adjust tension for smoother/sharper curves
flightPath.tension = 0.5;
```

### Animating Along the Path

```javascript
class FlightPathAnimator {
  constructor(path, duration = 5.0) {
    this.path = path;
    this.duration = duration; // seconds for full flight
    this.progress = 0;       // 0 to 1
    this.speed = 1.0 / duration;
  }

  update(delta, birdModel) {
    if (this.progress >= 1.0) return true; // Flight complete

    this.progress = Math.min(this.progress + this.speed * delta, 1.0);

    // Get position on curve
    const position = this.path.getPointAt(this.progress);
    birdModel.position.copy(position);

    // Orient bird to face flight direction
    const tangent = this.path.getTangentAt(this.progress);
    const lookTarget = position.clone().add(tangent);
    birdModel.lookAt(lookTarget);

    return false; // Still flying
  }
}
```

### Flight Phases

```
Timeline: 0.0 ────────────────────────────── 1.0
          │                                    │
Phase:    ├─── Takeoff ──┼─── Flight ──┼─── Landing ───┤
Progress: 0.0          0.15          0.75             1.0
Anim:     idle→fly      fly           fly→glide→land  perch
Speed:    accelerating  constant      decelerating     0
```

```javascript
updateBirdPhase(progress) {
  if (progress < 0.15) {
    // Takeoff phase - transition from idle to flying
    if (this.state !== BirdState.FLYING) {
      this.transitionTo(BirdState.FLYING);
    }
  } else if (progress < 0.75) {
    // Cruise phase - steady flight
    // Already in FLYING state
  } else if (progress < 0.95) {
    // Approach phase - transition to gliding
    if (this.state !== BirdState.GLIDING) {
      this.transitionTo(BirdState.GLIDING);
    }
  } else {
    // Landing phase
    if (this.state !== BirdState.LANDING) {
      this.transitionTo(BirdState.LANDING);
    }
  }
}
```

---

## 4. Coordinate System & Calibration

### Pre-Calibration Process

Since the installation is at a known location, you need to measure the physical positions once:

```
Step 1: Place QR code at known position
Step 2: Measure the rod position relative to QR code
Step 3: Record offset in meters:
    - X: horizontal distance (left/right)
    - Y: vertical distance (up/down)  
    - Z: depth distance (forward/back from camera)

Example measurement:
    QR Code → Rod = (1.5m right, 0.8m up, 1.2m forward)
    In Three.js: Vector3(1.5, 0.8, -1.2)  // Note: Z is typically negative (into screen)
```

### Calibration Config File

```javascript
// calibration.js — Edit these values after physical measurement
export const CALIBRATION = {
  // Anchor marker info
  marker: {
    type: 'image',           // 'image' or 'qr'
    physicalWidth: 0.15,     // Physical marker width in meters (15cm)
    imageFile: 'marker.mind' // MindAR compiled target
  },
  
  // Rod position relative to marker center (in meters)
  rod: {
    position: { x: 1.5, y: 0.8, z: -1.2 },
    rotation: { x: 0, y: 0, z: 0 },
    length: 0.5  // Rod length for visual reference
  },
  
  // Bird spawn position relative to marker
  bird: {
    spawnOffset: { x: 0, y: 0.1, z: 0 },
    scale: 0.3  // Model scale
  },
  
  // Flight path waypoints (relative to marker)
  flightPath: [
    { x: 0, y: 0.1, z: 0 },        // Start (at marker)
    { x: 0.5, y: 1.5, z: -0.5 },    // Apex
    { x: 1.2, y: 1.0, z: -1.0 },    // Approach
    { x: 1.5, y: 0.8, z: -1.2 }     // Rod (landing)
  ],
  
  flightDuration: 5.0  // seconds
};
```

---

## 5. Rendering Considerations for Mobile

### Performance Budget

| Resource | Budget |
|----------|--------|
| Draw calls per frame | < 20 |
| Triangle count (total scene) | < 100k |
| Texture memory | < 32 MB |
| Target frame rate | 60 FPS (minimum 30 FPS) |
| Initial load time | < 3 seconds on 4G |

### Optimization Techniques

1. **Use `InstancedMesh`** for repeated geometry (if any)
2. **Disable shadows** or use baked shadows
3. **Use `MeshBasicMaterial`** or `MeshLambertMaterial` instead of `MeshStandardMaterial` for non-hero objects
4. **Frustum culling** (Three.js does this by default)
5. **LOD (Level of Detail)** — swap to simpler model when bird is far away
6. **Texture atlasing** — combine textures into one material
7. **Object pooling** for any particle effects

### Lighting in AR
```javascript
// AR scenes need careful lighting — the real world provides most light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 10, 5);

// For more realism, estimate lighting from camera feed
// (8th Wall provides this automatically via their lighting module)
```
