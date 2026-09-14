import { store } from '../store.js';
import { partialSum, isHarmonicActive } from '../fourier-math.js';

// ---------------------------------------------------------------------
// Rendering: waveform reconstruction canvas
// ---------------------------------------------------------------------

function renderWaveformCanvas(canvas, coeffs, nHarmonics, harmonicState) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const midY = height / 2;
  const amp = height * 0.42;
  const steps = 400;

  ctx.strokeStyle = '#2c3042';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();

  // Original / target waveform (dashed), reconstructed with a high harmonic count.
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#5a5f77';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const y = midY - amp * partialSum(coeffs, coeffs.an.length - 1, theta);
    const x = (i / steps) * width;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Partial sum reconstruction with the selected number of harmonics,
  // respecting per-harmonic mute/solo state.
  const isActive = harmonicState
    ? (k) => isHarmonicActive(harmonicState, nHarmonics, k)
    : undefined;
  ctx.strokeStyle = '#5eb0ff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const y = midY - amp * partialSum(coeffs, nHarmonics, theta, isActive);
    const x = (i / steps) * width;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

class WaveformReconstruction extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <h2>Waveform reconstruction</h2>
      <canvas id="waveformCanvas" width="700" height="240"></canvas>
    `;
    this.canvas = this.querySelector('#waveformCanvas');

    this._onChange = () => this.render();
    store.addEventListener('change', this._onChange);
    this.render();
  }

  disconnectedCallback() {
    store.removeEventListener('change', this._onChange);
  }

  render() {
    renderWaveformCanvas(this.canvas, store.coeffs, store.nHarmonics, store.harmonicState);
  }
}

customElements.define('waveform-reconstruction', WaveformReconstruction);
