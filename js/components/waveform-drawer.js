import { store } from '../store.js';
import { safeSetPointerCapture, safeReleasePointerCapture } from '../pointer-utils.js';
import { DRAW_SAMPLES } from '../fourier-math.js';

// ---------------------------------------------------------------------
// Free-hand waveform drawing
// ---------------------------------------------------------------------

class DrawableWaveform {
  constructor(canvas, onChange) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onChange = onChange;
    this.samples = new Array(DRAW_SAMPLES).fill(0);
    this.hasDrawing = false;
    this.drawing = false;
    this.lastIdx = null;
    this.lastValue = null;
    this._bindEvents();
    this.render();
  }

  _bindEvents() {
    const getPos = (evt) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = ((evt.clientX - rect.left) / rect.width) * this.canvas.width;
      const y = ((evt.clientY - rect.top) / rect.height) * this.canvas.height;
      return { x, y };
    };

    const sampleAt = (x, y) => {
      const t = Math.min(Math.max(x / this.canvas.width, 0), 0.999999);
      const idx = Math.floor(t * DRAW_SAMPLES);
      const value = Math.min(Math.max(1 - (2 * y) / this.canvas.height, -1), 1);
      return { idx, value };
    };

    // Paints the current point and, if the pointer jumped several sample
    // columns since the last event (fast drags), linearly interpolates the
    // values in between so the drawn curve has no gaps.
    const paintTo = (x, y) => {
      const { idx, value } = sampleAt(x, y);
      if (this.lastIdx === null || this.lastIdx === idx) {
        this.samples[idx] = value;
      } else {
        const from = this.lastIdx;
        const to = idx;
        const fromValue = this.lastValue;
        const span = to - from;
        const steps = Math.abs(span);
        const dir = span > 0 ? 1 : -1;
        for (let i = 0; i <= steps; i++) {
          const sampleIdx = from + dir * i;
          this.samples[sampleIdx] = fromValue + (value - fromValue) * (i / steps);
        }
      }
      this.lastIdx = idx;
      this.lastValue = value;
    };

    const start = (evt) => {
      evt.preventDefault();
      safeSetPointerCapture(this.canvas, evt.pointerId);
      this.drawing = true;
      this.hasDrawing = true;
      this.lastIdx = null;
      const { x, y } = getPos(evt);
      paintTo(x, y);
      this.render();
    };

    const move = (evt) => {
      if (!this.drawing) return;
      evt.preventDefault();
      const { x, y } = getPos(evt);
      paintTo(x, y);
      this.render();
    };

    const end = (evt) => {
      if (!this.drawing) return;
      this.drawing = false;
      this.lastIdx = null;
      safeReleasePointerCapture(this.canvas, evt.pointerId);
      if (this.onChange) this.onChange(this.samples);
    };

    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', start);
    this.canvas.addEventListener('pointermove', move);
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
  }

  clear() {
    this.samples.fill(0);
    this.hasDrawing = false;
    this.lastIdx = null;
    this.render();
    if (this.onChange) this.onChange(this.samples);
  }

  render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#2c3042';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    if (!this.hasDrawing) {
      ctx.fillStyle = '#5a5f77';
      ctx.font = '12px sans-serif';
      ctx.fillText('Drag here to draw one period', 10, canvas.height / 2 - 8);
      return;
    }

    ctx.strokeStyle = '#5eb0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < DRAW_SAMPLES; i++) {
      const x = (i / DRAW_SAMPLES) * canvas.width;
      const y = ((1 - this.samples[i]) / 2) * canvas.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

class WaveformDrawer extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <h2>Draw your own waveform (one period)</h2>
      <canvas id="drawCanvas" width="700" height="220"></canvas>
      <button id="clearDrawBtn" class="action-btn small">Clear drawing</button>
    `;
    this.canvas = this.querySelector('#drawCanvas');
    this.drawable = new DrawableWaveform(this.canvas, (samples) => {
      store.setDrawSamples(samples);
    });

    this.querySelector('#clearDrawBtn').addEventListener('click', () => {
      this.drawable.clear();
    });
  }
}

customElements.define('waveform-drawer', WaveformDrawer);
