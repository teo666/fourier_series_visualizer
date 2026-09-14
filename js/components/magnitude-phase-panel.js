import { store } from '../store.js';
import { isHarmonicActive } from '../fourier-math.js';
import { safeSetPointerCapture, safeReleasePointerCapture } from '../pointer-utils.js';
import { coeffColumnWidth, harmonicAtX } from '../panel-geometry.js';

// ---------------------------------------------------------------------
// Rendering + editing: derived magnitude / phase per harmonic
// ---------------------------------------------------------------------

const MP_LAYOUT = {
  magLabelY: 12,
  magTop: 18,
  magHeight: 90,
  phaseLabelY: 122,
  phaseTop: 128,
  phaseHeight: 90,
};

const COEFF_DRAG_CLAMP = 4;

function computeMagnitudesAndPhases(coeffs, n) {
  const magnitudes = [0];
  const phases = [0];
  let maxMag = 1e-6;
  for (let k = 1; k <= n; k++) {
    const an = coeffs.an[k];
    const bn = coeffs.bn[k];
    const mag = Math.sqrt(an * an + bn * bn);
    magnitudes[k] = mag;
    phases[k] = Math.atan2(bn, an);
    maxMag = Math.max(maxMag, mag);
  }
  return { magnitudes, phases, maxMag };
}

// Shared geometry between rendering and pointer interaction.
function computeMPLayout(canvas, coeffs, nHarmonics) {
  const L = MP_LAYOUT;
  const n = Math.min(nHarmonics, coeffs.an.length - 1);
  const colWidth = coeffColumnWidth(canvas, n);
  const { magnitudes, phases, maxMag } = computeMagnitudesAndPhases(coeffs, n);
  const magBaseY = L.magTop + L.magHeight - 4;
  const magScale = (L.magHeight - 8) / maxMag;
  const phaseMidY = L.phaseTop + L.phaseHeight / 2;
  const phaseScale = (L.phaseHeight / 2 - 4) / Math.PI;
  return { n, colWidth, magnitudes, phases, magBaseY, magScale, phaseMidY, phaseScale };
}

function renderMagnitudePhaseCanvas(canvas, coeffs, nHarmonics, harmonicState) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const L = MP_LAYOUT;
  ctx.clearRect(0, 0, width, height);

  const layout = computeMPLayout(canvas, coeffs, nHarmonics);
  const { n, colWidth, magnitudes, phases, magBaseY, magScale, phaseMidY, phaseScale } = layout;

  ctx.fillStyle = '#9498a8';
  ctx.font = '11px sans-serif';
  ctx.fillText('Magnitude (drag to edit)', 4, L.magLabelY);
  ctx.fillText('Phase -π..π (drag to edit)', 4, L.phaseLabelY);

  ctx.strokeStyle = '#2c3042';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, magBaseY);
  ctx.lineTo(width, magBaseY);
  ctx.moveTo(0, phaseMidY);
  ctx.lineTo(width, phaseMidY);
  ctx.stroke();

  for (let k = 1; k <= n; k++) {
    const active = isHarmonicActive(harmonicState, n, k);
    const xCenter = (k - 0.5) * colWidth;

    const magY = magBaseY - magnitudes[k] * magScale;
    ctx.strokeStyle = active ? 'rgba(255,159,94,0.7)' : 'rgba(90,95,119,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xCenter, magBaseY);
    ctx.lineTo(xCenter, magY);
    ctx.stroke();
    ctx.fillStyle = active ? '#ff9f5e' : '#4a4e63';
    ctx.beginPath();
    ctx.arc(xCenter, magY, Math.max(2.5, Math.min(4, colWidth / 3)), 0, 2 * Math.PI);
    ctx.fill();

    const phaseY = phaseMidY - phases[k] * phaseScale;
    ctx.strokeStyle = active ? 'rgba(94,176,255,0.7)' : 'rgba(90,95,119,0.35)';
    ctx.beginPath();
    ctx.moveTo(xCenter, phaseMidY);
    ctx.lineTo(xCenter, phaseY);
    ctx.stroke();
    ctx.fillStyle = active ? '#5eb0ff' : '#4a4e63';
    ctx.beginPath();
    ctx.arc(xCenter, phaseY, Math.max(2.5, Math.min(4, colWidth / 3)), 0, 2 * Math.PI);
    ctx.fill();
  }

  if (canvas._dragReadout) {
    ctx.fillStyle = '#e8e9f0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(canvas._dragReadout, width - 6, L.magLabelY);
    ctx.textAlign = 'left';
  }
}

// Dragging a magnitude dot rescales that harmonic's (an, bn) pair while
// keeping its phase fixed; dragging a phase dot rotates it while keeping
// its magnitude fixed.
function attachMagnitudePhaseInteraction(canvas, getState, onChange) {
  let drag = null; // { mode: 'magnitude' | 'phase', k, ...scale info }

  const toCanvasPoint = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  };

  const applyDrag = (y) => {
    if (!drag) return;
    const { coeffs } = getState();
    const k = drag.k;
    const currentPhase = Math.atan2(coeffs.bn[k], coeffs.an[k]);
    const currentMag = Math.sqrt(coeffs.an[k] ** 2 + coeffs.bn[k] ** 2);

    if (drag.mode === 'magnitude') {
      const raw = (drag.magBaseY - y) / drag.magScale;
      const mag = Math.max(0, Math.min(COEFF_DRAG_CLAMP, raw));
      coeffs.an[k] = mag * Math.cos(currentPhase);
      coeffs.bn[k] = mag * Math.sin(currentPhase);
      canvas._dragReadout = `|H${k}| = ${mag.toFixed(3)}`;
    } else {
      const raw = (drag.phaseMidY - y) / drag.phaseScale;
      const phase = Math.max(-Math.PI, Math.min(Math.PI, raw));
      coeffs.an[k] = currentMag * Math.cos(phase);
      coeffs.bn[k] = currentMag * Math.sin(phase);
      canvas._dragReadout = `φ${k} = ${phase.toFixed(3)} rad`;
    }
    onChange();
  };

  const pointerDown = (evt) => {
    const { coeffs, nHarmonics } = getState();
    const { x, y } = toCanvasPoint(evt);
    const layout = computeMPLayout(canvas, coeffs, nHarmonics);
    const L = MP_LAYOUT;
    const k = harmonicAtX(x, layout.colWidth, layout.n);

    if (y >= L.magTop && y <= L.magTop + L.magHeight) {
      safeSetPointerCapture(canvas, evt.pointerId);
      drag = { mode: 'magnitude', k, magBaseY: layout.magBaseY, magScale: layout.magScale };
      applyDrag(y);
      return;
    }
    if (y >= L.phaseTop && y <= L.phaseTop + L.phaseHeight) {
      safeSetPointerCapture(canvas, evt.pointerId);
      drag = { mode: 'phase', k, phaseMidY: layout.phaseMidY, phaseScale: layout.phaseScale };
      applyDrag(y);
    }
  };

  const pointerMove = (evt) => {
    if (!drag) return;
    evt.preventDefault();
    const { y } = toCanvasPoint(evt);
    applyDrag(y);
  };

  const pointerUp = (evt) => {
    if (!drag) return;
    safeReleasePointerCapture(canvas, evt.pointerId);
    drag = null;
    canvas._dragReadout = null;
    onChange();
  };

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
}

class MagnitudePhasePanel extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <h2>Magnitude and phase per harmonic</h2>
      <canvas id="magnitudePhaseCanvas" width="700" height="220"></canvas>
      <p class="hint">Drag a dot to change magnitude or phase; the sine/cosine coefficients above update accordingly.</p>
    `;
    this.canvas = this.querySelector('#magnitudePhaseCanvas');

    attachMagnitudePhaseInteraction(
      this.canvas,
      () => ({ coeffs: store.coeffs, nHarmonics: store.nHarmonics, harmonicState: store.harmonicState }),
      () => store.notifyManualEdit()
    );

    this._onChange = () => this.render();
    store.addEventListener('change', this._onChange);
    this.render();
  }

  disconnectedCallback() {
    store.removeEventListener('change', this._onChange);
  }

  render() {
    renderMagnitudePhaseCanvas(this.canvas, store.coeffs, store.nHarmonics, store.harmonicState);
  }
}

customElements.define('magnitude-phase-panel', MagnitudePhasePanel);
