import { store } from '../store.js';
import { isHarmonicActive } from '../fourier-math.js';
import { safeSetPointerCapture, safeReleasePointerCapture } from '../pointer-utils.js';
import { coeffColumnWidth, harmonicAtX } from '../panel-geometry.js';

// ---------------------------------------------------------------------
// Rendering: per-harmonic sine/cosine coefficients, with mute/solo rows
// ---------------------------------------------------------------------

const COEFF_LAYOUT = {
  sinesLabelY: 12,
  sinesTop: 18,
  sinesHeight: 90,
  cosinesLabelY: 122,
  cosinesTop: 128,
  cosinesHeight: 90,
  mRowTop: 228,
  mRowHeight: 24,
  sRowTop: 258,
  sRowHeight: 24,
};

const COEFF_DRAG_CLAMP = 4;

function coeffMaxAbs(coeffs, nHarmonics) {
  let maxAbs = 1e-6;
  const n = Math.min(nHarmonics, coeffs.an.length - 1);
  for (let k = 1; k <= n; k++) {
    maxAbs = Math.max(maxAbs, Math.abs(coeffs.an[k]), Math.abs(coeffs.bn[k]));
  }
  return maxAbs;
}

// Shared geometry between rendering and pointer interaction, so a drag
// always maps to exactly what is drawn on screen.
function computeCoeffLayout(canvas, coeffs, nHarmonics) {
  const L = COEFF_LAYOUT;
  const n = Math.min(nHarmonics, coeffs.an.length - 1);
  const colWidth = coeffColumnWidth(canvas, n);
  const maxAbs = coeffMaxAbs(coeffs, n);
  const sinesMidY = L.sinesTop + L.sinesHeight / 2;
  const cosinesMidY = L.cosinesTop + L.cosinesHeight / 2;
  const scaleFor = (bandHeight) => (bandHeight / 2 - 4) / maxAbs;
  return {
    n,
    colWidth,
    maxAbs,
    sinesMidY,
    cosinesMidY,
    sinesScale: scaleFor(L.sinesHeight),
    cosinesScale: scaleFor(L.cosinesHeight),
  };
}

function renderCoefficientsCanvas(canvas, coeffs, nHarmonics, harmonicState) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const L = COEFF_LAYOUT;
  ctx.clearRect(0, 0, width, height);

  const layout = computeCoeffLayout(canvas, coeffs, nHarmonics);
  const { n, colWidth, sinesMidY, cosinesMidY } = layout;

  ctx.fillStyle = '#9498a8';
  ctx.font = '11px sans-serif';
  ctx.fillText('Sines (drag the dots to edit)', 4, L.sinesLabelY);
  ctx.fillText('Cosines (drag the dots to edit)', 4, L.cosinesLabelY);

  ctx.strokeStyle = '#2c3042';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, sinesMidY);
  ctx.lineTo(width, sinesMidY);
  ctx.moveTo(0, cosinesMidY);
  ctx.lineTo(width, cosinesMidY);
  ctx.stroke();

  const drawStems = (values, midY, scale) => {
    for (let k = 1; k <= n; k++) {
      const active = isHarmonicActive(harmonicState, n, k);
      const xCenter = (k - 0.5) * colWidth;
      const yValue = midY - values[k] * scale;
      ctx.strokeStyle = active ? 'rgba(94,176,255,0.7)' : 'rgba(90,95,119,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xCenter, midY);
      ctx.lineTo(xCenter, yValue);
      ctx.stroke();

      ctx.fillStyle = active ? '#5eb0ff' : '#4a4e63';
      ctx.beginPath();
      ctx.arc(xCenter, yValue, Math.max(2.5, Math.min(4, colWidth / 3)), 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  drawStems(coeffs.bn, sinesMidY, layout.sinesScale);
  drawStems(coeffs.an, cosinesMidY, layout.cosinesScale);

  const drawToggleRow = (top, rowHeight, letter, isOn) => {
    const midY = top + rowHeight / 2;
    const fontSize = Math.max(7, Math.min(12, colWidth * 0.8));
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = 1; k <= n; k++) {
      const xCenter = (k - 0.5) * colWidth;
      const on = isOn(k);
      ctx.fillStyle = on ? '#ff9f5e' : '#4a4e63';
      ctx.fillText(letter, xCenter, midY);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  };

  drawToggleRow(L.mRowTop, L.mRowHeight, 'm', (k) => harmonicState[k] && harmonicState[k].muted);
  drawToggleRow(L.sRowTop, L.sRowHeight, 's', (k) => harmonicState[k] && harmonicState[k].solo);

  if (canvas._dragReadout) {
    ctx.fillStyle = '#e8e9f0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(canvas._dragReadout, width - 6, L.sinesLabelY);
    ctx.textAlign = 'left';
  }
}

// Wires up both the mute/solo toggle rows and direct drag-editing of each
// harmonic's sine (bn) / cosine (an) coefficient by dragging its dot.
function attachCoefficientsInteraction(canvas, getState, onChange) {
  let drag = null; // { band: 'an' | 'bn', k, scale, midY }

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
    const raw = (drag.midY - y) / drag.scale;
    const value = Math.max(-COEFF_DRAG_CLAMP, Math.min(COEFF_DRAG_CLAMP, raw));
    coeffs[drag.band][drag.k] = value;
    const label = drag.band === 'bn' ? 'b' : 'a';
    canvas._dragReadout = `${label}${drag.k} = ${value.toFixed(3)}`;
    onChange();
  };

  const pointerDown = (evt) => {
    const { coeffs, nHarmonics, harmonicState } = getState();
    const { x, y } = toCanvasPoint(evt);
    const layout = computeCoeffLayout(canvas, coeffs, nHarmonics);
    const L = COEFF_LAYOUT;
    const k = harmonicAtX(x, layout.colWidth, layout.n);

    if (y >= L.mRowTop && y <= L.mRowTop + L.mRowHeight) {
      harmonicState[k].muted = !harmonicState[k].muted;
      onChange();
      return;
    }
    if (y >= L.sRowTop && y <= L.sRowTop + L.sRowHeight) {
      harmonicState[k].solo = !harmonicState[k].solo;
      onChange();
      return;
    }
    if (y >= L.sinesTop && y <= L.sinesTop + L.sinesHeight) {
      safeSetPointerCapture(canvas, evt.pointerId);
      drag = { band: 'bn', k, scale: layout.sinesScale, midY: layout.sinesMidY };
      applyDrag(y);
      return;
    }
    if (y >= L.cosinesTop && y <= L.cosinesTop + L.cosinesHeight) {
      safeSetPointerCapture(canvas, evt.pointerId);
      drag = { band: 'an', k, scale: layout.cosinesScale, midY: layout.cosinesMidY };
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

class CoefficientsPanel extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <h2>Coefficients (sine / cosine per harmonic)</h2>
      <canvas id="coefficientsCanvas" width="700" height="300"></canvas>
      <p class="hint">Drag a dot to change its amplitude. Click "m" to mute or "s" to solo a single harmonic.</p>
    `;
    this.canvas = this.querySelector('#coefficientsCanvas');

    attachCoefficientsInteraction(
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
    renderCoefficientsCanvas(this.canvas, store.coeffs, store.nHarmonics, store.harmonicState);
  }
}

customElements.define('coefficients-panel', CoefficientsPanel);
