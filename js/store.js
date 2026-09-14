import { MAX_HARMONICS, DRAW_SAMPLES, waveforms, computeDFTCoefficients, createHarmonicState } from './fourier-math.js';

// Central, shared application state. Components subscribe to the 'change'
// event and re-render; they call these methods to mutate state (mirroring
// the single `state` object + `renderAll()` pattern the app used before
// being split into web components).
export class FourierStore extends EventTarget {
  constructor() {
    super();
    this.waveform = 'sine';
    this.nHarmonics = 20;
    this.freqHz = 220;
    this.volume = 0.3;
    this.coeffs = waveforms.sine(MAX_HARMONICS);
    this.harmonicState = createHarmonicState(MAX_HARMONICS);
    this.drawSamples = new Array(DRAW_SAMPLES).fill(0);
  }

  _emitChange() {
    this.dispatchEvent(new CustomEvent('change'));
  }

  setWaveform(name) {
    this.waveform = name;
    this.coeffs =
      name === 'custom'
        ? computeDFTCoefficients(this.drawSamples, MAX_HARMONICS)
        : waveforms[name](MAX_HARMONICS);
    this._emitChange();
  }

  // Called by waveform-drawer whenever the free-hand samples change.
  setDrawSamples(samples) {
    this.drawSamples = samples;
    this.waveform = 'custom';
    this.coeffs = computeDFTCoefficients(samples, MAX_HARMONICS);
    this._emitChange();
  }

  setHarmonics(n) {
    this.nHarmonics = n;
    this._emitChange();
  }

  setFrequency(hz) {
    this.freqHz = hz;
    this._emitChange();
  }

  setVolume(v) {
    this.volume = v;
    this._emitChange();
  }

  resetMuteSolo() {
    this.harmonicState = createHarmonicState(MAX_HARMONICS);
    this._emitChange();
  }

  // Any hand edit (dragging a coefficient/magnitude/phase dot, muting or
  // soloing a harmonic) makes the sound diverge from the selected preset,
  // so the waveform picker should reflect that it's now "Custom".
  markCustomEdit() {
    if (this.waveform !== 'custom') this.waveform = 'custom';
  }

  // Convenience for drag interactions: mark custom (if needed) + notify.
  notifyManualEdit() {
    this.markCustomEdit();
    this._emitChange();
  }
}

export const store = new FourierStore();
