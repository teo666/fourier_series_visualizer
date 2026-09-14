import { store } from '../store.js';
import { buildActiveCoefficientArrays } from '../audio-coefficients.js';

// ---------------------------------------------------------------------
// Audio synthesis via Web Audio API PeriodicWave
// ---------------------------------------------------------------------

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.oscillator = null;
    this.gain = null;
    this.playing = false;
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _buildPeriodicWave(coeffs, nHarmonics, harmonicState) {
    const { real, imag } = buildActiveCoefficientArrays(coeffs, nHarmonics, harmonicState);
    return this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  play(coeffs, nHarmonics, freqHz, volume, harmonicState) {
    this._ensureContext();
    this.stop();

    this.oscillator = this.ctx.createOscillator();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = volume;
    this.oscillator.setPeriodicWave(this._buildPeriodicWave(coeffs, nHarmonics, harmonicState));
    this.oscillator.frequency.value = freqHz;
    this.oscillator.connect(this.gain).connect(this.ctx.destination);
    this.oscillator.start();
    this.playing = true;
  }

  update(coeffs, nHarmonics, freqHz, harmonicState) {
    if (!this.playing || !this.oscillator) return;
    this.oscillator.setPeriodicWave(this._buildPeriodicWave(coeffs, nHarmonics, harmonicState));
    this.oscillator.frequency.setValueAtTime(freqHz, this.ctx.currentTime);
  }

  setVolume(volume) {
    if (this.gain) this.gain.gain.setValueAtTime(volume, this.ctx.currentTime);
  }

  stop() {
    if (this.oscillator) {
      try {
        this.oscillator.stop();
      } catch (e) {
        /* already stopped */
      }
      this.oscillator.disconnect();
      this.oscillator = null;
    }
    if (this.gain) {
      this.gain.disconnect();
      this.gain = null;
    }
    this.playing = false;
  }
}

class AudioControls extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <button id="audioToggle" class="action-btn">🔊 Play</button>
      <label class="volume-label">
        Volume
        <input type="range" id="volumeSlider" min="0" max="1" value="${store.volume}" step="0.01">
      </label>
    `;
    this.audio = new AudioEngine();
    this.audioToggle = this.querySelector('#audioToggle');
    this.volumeSlider = this.querySelector('#volumeSlider');

    this.audioToggle.addEventListener('click', () => {
      if (this.audio.playing) {
        this.audio.stop();
        this.audioToggle.textContent = '🔊 Play';
        this.audioToggle.classList.remove('active');
      } else {
        this.audio.play(
          store.coeffs,
          store.nHarmonics,
          store.freqHz,
          parseFloat(this.volumeSlider.value),
          store.harmonicState
        );
        this.audioToggle.textContent = '🔇 Stop';
        this.audioToggle.classList.add('active');
      }
    });

    this.volumeSlider.addEventListener('input', () => {
      const v = parseFloat(this.volumeSlider.value);
      this.audio.setVolume(v);
      store.setVolume(v);
    });

    this._onChange = () => {
      if (this.audio.playing) {
        this.audio.update(store.coeffs, store.nHarmonics, store.freqHz, store.harmonicState);
      }
    };
    store.addEventListener('change', this._onChange);
  }

  disconnectedCallback() {
    store.removeEventListener('change', this._onChange);
  }
}

customElements.define('audio-controls', AudioControls);
