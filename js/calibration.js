// calibration.js — EDIT THESE VALUES ON SITE
//
// COORDINATE SYSTEM (8th Wall / Three.js world space, SLAM origin):
//   X = right   (positive = right when facing marker)
//   Y = up       (positive = skyward)
//   Z = forward  (NEGATIVE = into the scene away from viewer)
//
// offsetToRod: vector FROM the printed marker center TO the rod center, meters.
// Measurement tip: use tape measure in 3D. Forward distance is negative Z.
//
// WEIGHT: how much to trust this marker's estimate (0–1).
//   ON the rod or <30cm away → 1.0
//   ~1m away                 → 0.7
//   ~2m away                 → 0.4–0.5
//
// HOW TO UPDATE ON SITE:
//   1. Hold phone at arm's length, scan marker-a
//   2. Use debug overlay to see where the model appears
//   3. Measure discrepancy with tape (e.g. model is 0.3m too far right → subtract 0.3 from x)
//   4. Edit this file, push to GitHub, reload page

export const MARKERS = {
  'marker-a': {
    label: 'QR Sign (primary)',
    // Rod is ~2m forward and ~0.8m above this marker
    offsetToRod: { x: 0.0, y: 0.8, z: -2.0 },
    physicalWidth: 0.20,  // meters — this is the printed marker width (20 cm)
    weight: 0.5,
  },

  'marker-b': {
    label: 'Railing Sign',
    // Adjust x/y/z after placing marker-b on the railing
    offsetToRod: { x: -0.5, y: 0.3, z: -0.8 },
    physicalWidth: 0.20,
    weight: 0.7,
  },

  'marker-c': {
    label: 'Rod Sign',
    // This marker goes ON the rod — offset is just the distance to rod center
    offsetToRod: { x: 0.0, y: 0.3, z: 0.0 },
    physicalWidth: 0.10,  // 10 cm — smaller marker affixed to the rod
    weight: 1.0,
  },
};

// GLB model uniform scale (adjust so model looks right-sized relative to scene)
export const MODEL_SCALE = 0.3;

// Show translucent wireframe cylinder at estimated rod position for debugging
export const ROD_VISUAL = true;

// Smoothing factor when rod position updates with new estimates (0–1)
// Higher = snappier, Lower = smoother / more averaged
export const UPDATE_LERP = 0.35;
