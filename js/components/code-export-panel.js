import { store } from '../store.js';
import { buildActiveCoefficientArrays } from '../audio-coefficients.js';

// ---------------------------------------------------------------------
// Exportable JS snippet: reproduces the current sound with a plain
// OscillatorNode + PeriodicWave, using the same coefficients shown above.
// ---------------------------------------------------------------------

function roundCoeff(value) {
  // Keep the snippet readable without rounding away audible detail.
  return Math.round(value * 1e6) / 1e6;
}

function generateOscillatorCode(coeffs, nHarmonics, harmonicState, freqHz) {
  const { real: realTyped, imag: imagTyped } = buildActiveCoefficientArrays(coeffs, nHarmonics, harmonicState);
  const real = Array.from(realTyped, roundCoeff);
  const imag = Array.from(imagTyped, roundCoeff);

  return `// Fourier series decomposition: real[k] = cosine coefficient (a_k),
// imag[k] = sine coefficient (b_k). Index 0 is the DC component, which
// PeriodicWave ignores. Muted harmonics are zeroed out.
const real = new Float32Array([${real.join(', ')}]);
const imag = new Float32Array([${imag.join(', ')}]);

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const wave = audioCtx.createPeriodicWave(real, imag, { disableNormalization: false });

const oscillator = audioCtx.createOscillator();
oscillator.setPeriodicWave(wave);
oscillator.frequency.value = ${freqHz}; // Hz
oscillator.connect(audioCtx.destination);
oscillator.start();

// To stop the sound:
// oscillator.stop();
`;
}

class CodeExportPanel extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <h2>JS code to play this sound</h2>
      <pre id="codeOutput" class="code-output"></pre>
      <button id="copyCodeBtn" class="action-btn small">Copy code</button>
      <p class="hint">Uses an <code>OscillatorNode</code> with a <code>PeriodicWave</code> built from the same sine/cosine coefficients shown above (respects the harmonic count and the mute/solo state). Paste it into the browser console to hear it.</p>
    `;
    this.codeOutput = this.querySelector('#codeOutput');
    this.copyCodeBtn = this.querySelector('#copyCodeBtn');

    this.copyCodeBtn.addEventListener('click', async () => {
      const originalLabel = this.copyCodeBtn.textContent;
      try {
        await navigator.clipboard.writeText(this.codeOutput.textContent);
        this.copyCodeBtn.textContent = 'Copied!';
      } catch (e) {
        // Clipboard API unavailable (e.g. insecure context) — fall back to
        // a manual copy via a temporary selectable textarea.
        const textarea = document.createElement('textarea');
        textarea.value = this.codeOutput.textContent;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        this.copyCodeBtn.textContent = 'Copied!';
      }
      setTimeout(() => {
        this.copyCodeBtn.textContent = originalLabel;
      }, 1500);
    });

    this._onChange = () => this.render();
    store.addEventListener('change', this._onChange);
    this.render();
  }

  disconnectedCallback() {
    store.removeEventListener('change', this._onChange);
  }

  render() {
    this.codeOutput.textContent = generateOscillatorCode(
      store.coeffs,
      store.nHarmonics,
      store.harmonicState,
      store.freqHz
    );
  }
}

customElements.define('code-export-panel', CodeExportPanel);
