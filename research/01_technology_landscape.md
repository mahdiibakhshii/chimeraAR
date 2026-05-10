# WebAR Technology Landscape Research

> **Project**: SamandAR — Animated Chimera Bird WebAR Experience  
> **Date**: 2026-05-10  
> **Purpose**: Survey of available WebAR technologies for SLAM, image tracking, and spatial anchoring

---

## 1. Overview of the Problem

We need a **frontend-only** WebAR experience (hosted on GitHub Pages) where:
1. User scans a QR code → opens a web page
2. The camera activates and shows a 3D animated Chimera bird in AR
3. The bird has **environment awareness** (SLAM/spatial understanding)
4. The bird animates along a path — finding a rod in the physical environment and flying to perch on it
5. Spatial anchoring is used — the QR code (or nearby marker) establishes a known reference frame, and the rod's position is pre-calibrated relative to that anchor

---

## 2. Technology Options Comparison

### 2.1 WebXR Device API (Native Browser Standard)

| Aspect | Details |
|--------|---------|
| **What it is** | W3C standard for AR/VR in the browser |
| **SLAM** | Delegates to device OS (ARCore on Android, ARKit via Safari — limited) |
| **Spatial Anchors** | Supported on Android Chrome, Meta Quest Browser. NOT on iOS Safari |
| **Hit Testing** | `XRHitTestSource` for detecting real-world surfaces |
| **Plane Detection** | Available on supporting browsers/devices |
| **iOS Support** | ❌ Safari does NOT support WebXR AR module on iPhones/iPads |
| **Android Support** | ✅ Full support on Chrome, Edge, Samsung Internet |
| **License** | Open standard, free |
| **GitHub Pages** | ✅ Works on static hosting (HTTPS required) |

> [!WARNING]
> WebXR is the gold standard on Android but **completely unavailable on iOS Safari** for AR sessions. This is a critical limitation if your audience includes iPhone users.

---

### 2.2 8th Wall Engine (Open Source / Binary)

| Aspect | Details |
|--------|---------|
| **What it is** | Former commercial WebAR platform, now open-sourced (Feb 2026) |
| **SLAM/World Tracking** | ✅ Available in the **Distributed Engine Binary** (closed-source binary, free to use) |
| **Image Targets** | ✅ Open-sourced (MIT license) |
| **Face Effects** | ✅ Open-sourced (MIT license) |
| **VPS/Maps/Hand Tracking** | ❌ NOT included |
| **iOS Support** | ✅ **Cross-platform** — uses its own JS-based SLAM, works on iOS Safari |
| **Android Support** | ✅ Full support |
| **License** | MIT (framework) + Binary-only (SLAM engine, free commercial use) |
| **GitHub Pages** | ✅ Self-hosted, static files work |
| **Key advantage** | **Only solution that provides reliable SLAM on BOTH iOS and Android in the browser** |

**Architecture:**
- The engine binary (`xr.js`) is loaded as a script tag
- SLAM chunk is loaded via `data-preload-chunks="slam"` or `XR8.loadChunk('slam')`
- Provides camera pose matrices you apply to your Three.js camera
- Framework-agnostic: works with Three.js, A-Frame, Babylon.js

**Current Links:**
- GitHub: https://github.com/8thwall/8thwall
- Engine Binary: https://github.com/8thwall/engine
- Samples: https://8th.io/examples
- Blog: https://8thwall.org/blog/8th-wall-open-source

---

### 2.3 AlvaAR (Open Source Visual SLAM)

| Aspect | Details |
|--------|---------|
| **What it is** | Open-source JS library for visual SLAM in the browser (WebAssembly) |
| **Based on** | OV²SLAM and ORB-SLAM2 (academic SLAM algorithms) |
| **SLAM** | ✅ Real camera pose estimation + plane detection |
| **Stars/Maturity** | 493 GitHub stars, 93 commits — relatively small community |
| **iOS Support** | ✅ Uses `getUserMedia` — works on iOS Safari |
| **Performance** | Experimental; may struggle on lower-end devices |
| **License** | ⚠️ **GPL-3.0** — copyleft, must open-source derivative works |
| **GitHub Pages** | ✅ Static files, WebAssembly-based |
| **Integration** | Provides camera pose → apply to Three.js scene |

**API Example:**
```javascript
const alva = await AlvaAR.Initialize(width, height);
const cameraPose = alva.findCameraPose(frame);  // rotation/translation
const planePose = alva.findPlane();               // detected plane
const points = alva.getFramePoints();             // tracked feature points
```

> [!NOTE]
> AlvaAR is a genuine open-source SLAM solution but is less polished than 8th Wall's binary. Good for learning and R&D, but may lack stability for production.

---

### 2.4 MindAR.js (Image Tracking)

| Aspect | Details |
|--------|---------|
| **What it is** | Open-source WebAR library for image and face tracking |
| **SLAM/World Tracking** | ❌ No world tracking / SLAM |
| **Image Tracking** | ✅ Excellent — multiple simultaneous targets supported |
| **iOS Support** | ✅ Works on iOS Safari |
| **Android Support** | ✅ Full support |
| **License** | MIT |
| **GitHub Pages** | ✅ Perfect for static hosting |
| **Integration** | A-Frame based, easy to use |

**Key feature**: Multiple image targets with `maxTrack: N` — can track several images simultaneously, each acting as an independent coordinate origin.

---

### 2.5 AR.js (Marker/Image Tracking)

| Aspect | Details |
|--------|---------|
| **What it is** | Lightweight open-source WebAR for marker and NFT tracking |
| **SLAM** | ❌ No world tracking |
| **Markers** | ✅ Hiro markers, custom pattern markers, NFT image tracking |
| **iOS Support** | ✅ Works on iOS Safari |
| **License** | MIT |
| **GitHub Pages** | ✅ Static hosting |

> [!NOTE]
> AR.js and MindAR are excellent for **marker/image-based AR** but cannot provide the environment understanding (SLAM) needed for our bird-to-rod flight animation.

---

## 3. Summary Matrix

| Feature | WebXR | 8th Wall Binary | AlvaAR | MindAR | AR.js |
|---------|-------|-----------------|--------|--------|-------|
| **SLAM/World Tracking** | ✅ (Android only) | ✅ (Cross-platform) | ✅ (Experimental) | ❌ | ❌ |
| **Image Tracking** | ❌ (not native) | ✅ | ❌ | ✅ | ✅ |
| **iOS Safari** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Android Chrome** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Spatial Anchors** | Partial | ✅ | Partial | ❌ | ❌ |
| **Hit Testing** | ✅ | ✅ | ✅ (plane detection) | ❌ | ❌ |
| **Self-Hosted** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **License** | Open Standard | MIT + Binary | GPL-3.0 | MIT | MIT |
| **Maturity** | High | High | Low-Medium | Medium | Medium |
| **Performance** | Native-level | High | Variable | Good | Good |

---

## 4. Initial Recommendation

For this project, the most promising approaches (ranked):

1. **8th Wall Engine Binary** — Best cross-platform SLAM, free, self-hostable, works on iOS+Android
2. **Hybrid: MindAR (image anchor) + 8th Wall (world tracking)** — Use MindAR for initial QR/image anchor, 8th Wall for world tracking
3. **WebXR + Three.js** — If targeting Android-only, this is the cleanest standards-based approach
4. **AlvaAR** — Interesting for R&D but risky for production due to GPL license and maturity

> [!IMPORTANT]
> The choice heavily depends on whether **iOS support is required**. If yes, 8th Wall Binary is essentially the only viable option for SLAM.
