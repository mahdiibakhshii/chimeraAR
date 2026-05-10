import * as THREE from 'three';
import { MARKERS, UPDATE_LERP } from './calibration.js';

// Tracks multiple marker detections and fuses them into a single rod position estimate.
// Each detected marker contributes a weighted estimate of the rod's world-space position.
// The fused estimate improves as more markers are seen.
//
// Estimation math:
//   rodEst(marker) = markerWorldPos + markerWorldRot.rotate(marker.offsetToRod)
//   rodFused = weighted_avg(all estimates)

export class MarkerManager extends EventTarget {
  constructor() {
    super();
    // Stores the last known pose for each detected marker
    // markerName → { position: THREE.Vector3, quaternion: THREE.Quaternion, timestamp: number }
    this._detections = new Map();
    // Running weighted-average rod position in world space
    this.rodPosition = null;
    this._totalPossibleWeight = Object.values(MARKERS)
      .reduce((sum, m) => sum + m.weight, 0);
  }

  // Called by app.js on xrimagefound / xrimageupdated
  onMarkerDetected(name, position, rotation) {
    const config = MARKERS[name];
    if (!config) return;

    const pos = new THREE.Vector3(position.x, position.y, position.z);
    const quat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);

    this._detections.set(name, { position: pos, quaternion: quat, timestamp: Date.now() });

    const fused = this._fuseEstimates();
    if (!fused) return;

    if (!this.rodPosition) {
      this.rodPosition = fused.clone();
    } else {
      // Lerp toward new estimate — smooths jitter while remaining responsive
      this.rodPosition.lerp(fused, UPDATE_LERP);
    }

    this._emit();
  }

  // Called on xrimagelost — we do NOT remove the detection.
  // The stored position is world-space (from SLAM) and remains valid.
  onMarkerLost(_name) {
    // No-op: SLAM maintains world space, estimate is still valid
    this._emit(); // update overlay icons
  }

  reset() {
    this._detections.clear();
    this.rodPosition = null;
    this.dispatchEvent(new CustomEvent('reset'));
    this._emit();
  }

  get detectedMarkerNames() {
    return [...this._detections.keys()];
  }

  // 0–1: ratio of detected weight vs. total possible weight
  get confidence() {
    if (this._detections.size === 0) return 0;
    const detected = [...this._detections.keys()]
      .reduce((sum, name) => sum + (MARKERS[name]?.weight ?? 0), 0);
    return Math.min(detected / this._totalPossibleWeight, 1.0);
  }

  // ── private ──────────────────────────────────────────────────────────────

  // Transforms a marker's local offsetToRod into world-space rod position
  _estimateRodFromMarker(name, markerPos, markerQuat) {
    const cfg = MARKERS[name];
    const localOffset = new THREE.Vector3(
      cfg.offsetToRod.x,
      cfg.offsetToRod.y,
      cfg.offsetToRod.z,
    );
    // Rotate offset into world space using the marker's world orientation
    localOffset.applyQuaternion(markerQuat);
    return markerPos.clone().add(localOffset);
  }

  // Weighted average of all per-marker rod estimates
  _fuseEstimates() {
    if (this._detections.size === 0) return null;

    const fused = new THREE.Vector3();
    let totalWeight = 0;

    for (const [name, det] of this._detections) {
      const cfg = MARKERS[name];
      const estimate = this._estimateRodFromMarker(name, det.position, det.quaternion);
      fused.addScaledVector(estimate, cfg.weight);
      totalWeight += cfg.weight;
    }

    fused.divideScalar(totalWeight);
    return fused;
  }

  _emit() {
    this.dispatchEvent(new CustomEvent('positionUpdate', {
      detail: {
        position: this.rodPosition ? this.rodPosition.clone() : null,
        confidence: this.confidence,
        detectedCount: this._detections.size,
        detectedNames: this.detectedMarkerNames,
      },
    }));
  }
}
