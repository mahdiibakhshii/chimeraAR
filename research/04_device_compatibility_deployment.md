# Device Compatibility & Deployment Guide

> **Project**: SamandAR — Animated Chimera Bird WebAR Experience  
> **Date**: 2026-05-10  
> **Purpose**: Browser/device support matrix, deployment strategy, and cross-platform considerations

---

## 1. Browser & Device Support Matrix (May 2026)

### WebXR AR Support

| Platform | Browser | WebXR AR | Camera | SLAM (Native) | Notes |
|----------|---------|----------|--------|----------------|-------|
| Android 10+ | Chrome 80+ | ✅ | ✅ | ✅ (ARCore) | Best WebXR support |
| Android 10+ | Edge | ✅ | ✅ | ✅ | Chromium-based |
| Android 10+ | Samsung Internet | ✅ | ✅ | ✅ | Good support |
| Android 10+ | Firefox | ❌ | ✅ | ❌ | No WebXR |
| iOS 15+ | Safari | ❌ | ✅ | ❌ | **No WebXR AR** |
| iOS 15+ | Chrome (iOS) | ❌ | ✅ | ❌ | Uses WebKit engine |
| iPadOS | Safari | ❌ | ✅ | ❌ | Same as iOS |
| visionOS 2.0 | Safari | Partial (VR only) | N/A | ❌ | No AR module |
| Desktop | Chrome/Edge | ✅ (dev mode) | ✅ | ❌ | For testing only |

### JS-Based AR Libraries (getUserMedia)

| Platform | MindAR | AR.js | 8th Wall Binary | AlvaAR |
|----------|--------|-------|------------------|--------|
| Android Chrome | ✅ | ✅ | ✅ | ✅ |
| iOS Safari | ✅ | ✅ | ✅ | ✅ |
| Android Firefox | ✅ | ✅ | ✅ | ✅ |
| Desktop Chrome | ✅ (webcam) | ✅ | ✅ | ✅ |

> [!IMPORTANT]
> **JS-based libraries use `getUserMedia` for camera access**, which is universally supported. This is how 8th Wall achieves iOS SLAM — it runs its own SLAM algorithm in JS/WASM rather than relying on the browser's WebXR API.

---

## 2. iOS Safari — The Critical Platform Challenge

### Why iOS Matters
- ~50% of mobile users in many Western markets use iPhones
- Safari is the ONLY rendering engine allowed on iOS (all browsers use WebKit)
- Apple has not implemented the WebXR AR Module in Safari

### iOS-Compatible Solutions

| Solution | How it works on iOS | Quality |
|----------|---------------------|---------|
| **8th Wall Binary** | Custom SLAM via JS/WASM over `getUserMedia` | ★★★★★ Professional |
| **MindAR** | Image tracking via `getUserMedia` | ★★★★ Good (no SLAM) |
| **AR.js** | Marker tracking via `getUserMedia` | ★★★ Decent |
| **AlvaAR** | Visual SLAM via WASM over `getUserMedia` | ★★★ Experimental |
| **AR Quick Look** | Opens native USDZ viewer (limited interaction) | ★★ Basic, no custom logic |

### Recommended iOS Strategy
```
IF full SLAM needed on iOS:
    → Use 8th Wall Engine Binary
ELSE IF image-tracking only:
    → Use MindAR.js (lighter, fully open-source)
```

---

## 3. Camera Access Requirements

### HTTPS Mandatory
All modern browsers require HTTPS for camera access (`getUserMedia`). GitHub Pages provides this automatically.

### Permission Flow
```
User opens URL (from QR scan)
    └── Browser prompts: "Allow camera access?"
            ├── User accepts → AR experience starts
            └── User denies → Show fallback (3D preview without AR)
```

### Fallback Strategy
Always implement a non-AR fallback for:
- Users who deny camera permission
- Unsupported browsers
- Desktop users without webcam

```javascript
async function initAR() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    // AR mode: initialize tracking, show 3D in AR
    startARExperience(stream);
  } catch (err) {
    // Fallback mode: show 3D model viewer without AR
    startFallbackViewer();
  }
}
```

---

## 4. GitHub Pages Deployment

### Project Structure for Deployment

```
SamandAR/
├── index.html              # Main entry point
├── css/
│   └── style.css           # Loading screen, UI overlays
├── js/
│   ├── app.js              # Main application logic
│   ├── bird-controller.js  # Bird animation state machine
│   ├── flight-path.js      # Path interpolation
│   └── calibration.js      # Pre-measured positions
├── assets/
│   ├── chimera_bird.glb    # 3D model (<5MB)
│   ├── marker.mind         # MindAR compiled target (if using MindAR)
│   └── marker.png          # Source marker image
├── lib/
│   ├── three.min.js        # Three.js (or CDN)
│   ├── GLTFLoader.js       # GLTF loader
│   ├── DRACOLoader.js      # Draco decoder
│   └── draco/              # Draco WASM decoder files
│       ├── draco_decoder.wasm
│       └── draco_decoder.js
├── vendor/
│   └── (8th Wall binary files if using that approach)
│       ├── xr.js
│       └── xr-slam.wasm
└── README.md
```

### GitHub Pages Configuration
1. Push to `main` branch
2. Settings → Pages → Source: "Deploy from a branch" → `main` / `/ (root)`
3. Site live at: `https://<username>.github.io/SamandAR/`

### CDN for Large Dependencies
To keep the repo lightweight, use CDNs for framework files:
```html
<!-- Three.js from CDN -->
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

## 5. Performance Optimization for Devices

### Loading Strategy
```
1. Show loading screen immediately (CSS only, no JS)
2. Load Three.js framework
3. Load AR library (MindAR/8th Wall)
4. Load 3D model (with progress indicator)
5. Request camera permission
6. Start AR session
```

### Progressive Enhancement
```javascript
// Detect device capabilities and adjust quality
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
const isLowEnd = navigator.hardwareConcurrency <= 4;

const quality = {
  textureSize: isLowEnd ? 512 : 1024,
  shadows: !isLowEnd,
  antialiasing: !isMobile,
  pixelRatio: Math.min(window.devicePixelRatio, isLowEnd ? 1.5 : 2)
};
```

### Memory Management
```javascript
// Dispose resources when AR session ends
function cleanup() {
  model.traverse(child => {
    if (child.isMesh) {
      child.geometry.dispose();
      child.material.dispose();
      if (child.material.map) child.material.map.dispose();
    }
  });
  renderer.dispose();
}
```

---

## 6. QR Code Design Considerations

### QR Code as Both Link AND Marker

| Strategy | Pros | Cons |
|----------|------|------|
| **QR code only** — links to URL, also used as AR marker | Simple, one physical element | QR codes are poor image tracking targets (too uniform) |
| **QR code + separate marker** — QR links to URL, nearby image is the AR anchor | Best tracking stability | Two physical elements needed |
| **Custom QR code** — stylized QR with embedded logo/design | Good tracking + functional QR | Requires careful design to maintain scannability |

### Recommended: QR + Companion Marker
```
┌────────────────────────────────────────┐
│                                        │
│   ┌──────────┐    ┌──────────────┐     │
│   │ QR Code  │    │  AR Marker   │     │
│   │ (scan to │    │ (high-detail │     │
│   │  open)   │    │  image for   │     │
│   │          │    │  tracking)   │     │
│   └──────────┘    └──────────────┘     │
│                                        │
│         Installation Signage           │
└────────────────────────────────────────┘
```

The AR marker image should have:
- High contrast
- Unique, non-repeating features
- Asymmetric design (helps orientation detection)
- Minimum physical size: 10cm × 10cm
