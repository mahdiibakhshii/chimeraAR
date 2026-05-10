import { MARKERS } from './calibration.js';

// Renders the debug panel and wires up its controls.
// Receives a MarkerManager and two callbacks (onReset, onCylinderToggle).

export class DebugOverlay {
  constructor(markerManager, onReset, onCylinderToggle) {
    this._manager = markerManager;
    this._panelVisible = true;
    this._cylinderOn = true;

    this._buildMarkerRows();
    this._bindButtons(onReset, onCylinderToggle);
    this._bindToggle();

    markerManager.addEventListener('positionUpdate', (e) => this._update(e.detail));
    markerManager.addEventListener('reset', () => this._onReset());
  }

  // ── private ──────────────────────────────────────────────────────────────

  _buildMarkerRows() {
    const container = document.getElementById('marker-status');
    container.innerHTML = '';
    for (const [name, cfg] of Object.entries(MARKERS)) {
      const row = document.createElement('div');
      row.className = 'marker-row';
      row.innerHTML = `
        <span class="marker-icon" id="micon-${name}">⬜</span>
        <span class="marker-name">${cfg.label}</span>
        <span class="marker-weight">w=${cfg.weight.toFixed(1)}</span>
      `;
      container.appendChild(row);
    }
  }

  _bindButtons(onReset, onCylinderToggle) {
    document.getElementById('reset-btn').addEventListener('click', () => {
      onReset();
    });

    document.getElementById('cylinder-toggle').addEventListener('click', () => {
      this._cylinderOn = !this._cylinderOn;
      onCylinderToggle(this._cylinderOn);
      document.getElementById('cylinder-toggle').textContent =
        this._cylinderOn ? 'Hide Debug Cylinder' : 'Show Debug Cylinder';
    });
  }

  _bindToggle() {
    document.getElementById('debug-toggle').addEventListener('click', () => {
      this._panelVisible = !this._panelVisible;
      document.getElementById('debug-content').style.display =
        this._panelVisible ? '' : 'none';
      document.getElementById('debug-toggle').textContent =
        this._panelVisible ? 'Hide' : 'Show';
    });
  }

  _update({ position, confidence, detectedCount, detectedNames }) {
    for (const name of Object.keys(MARKERS)) {
      const icon = document.getElementById(`micon-${name}`);
      if (icon) icon.textContent = detectedNames.includes(name) ? '✅' : '⬜';
    }

    const posEl = document.getElementById('rod-position');
    posEl.textContent = position
      ? `x:${position.x.toFixed(3)}  y:${position.y.toFixed(3)}  z:${position.z.toFixed(3)}`
      : '— scan a marker —';

    const pct = Math.round(confidence * 100);
    document.getElementById('confidence-fill').style.width = `${pct}%`;
    document.getElementById('confidence-text').textContent = `${pct}%`;

    document.getElementById('markers-seen').textContent = detectedCount === 0
      ? 'No markers detected yet'
      : `${detectedCount} marker${detectedCount > 1 ? 's' : ''} contributing to estimate`;
  }

  _onReset() {
    for (const name of Object.keys(MARKERS)) {
      const icon = document.getElementById(`micon-${name}`);
      if (icon) icon.textContent = '⬜';
    }
    document.getElementById('rod-position').textContent = '— scan a marker —';
    document.getElementById('confidence-fill').style.width = '0%';
    document.getElementById('confidence-text').textContent = '0%';
    document.getElementById('markers-seen').textContent = 'No markers detected yet';
  }
}
