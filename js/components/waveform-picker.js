import { store } from '../store.js';

const WAVEFORMS = [
  { value: 'sine', label: 'Sine' },
  { value: 'square', label: 'Square' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'sawtooth', label: 'Sawtooth' },
  { value: 'halfRectified', label: 'Half-rectified' },
  { value: 'custom', label: 'Custom (drawn)' },
];

class WaveformPicker extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <span class="control-label">Waveform</span>
      <div class="waveform-buttons">
        ${WAVEFORMS.map(
          (w) => `<button class="wf-btn" data-waveform="${w.value}">${w.label}</button>`
        ).join('')}
      </div>
    `;
    this.buttons = Array.from(this.querySelectorAll('.wf-btn'));
    this.buttons.forEach((btn) => {
      btn.addEventListener('click', () => store.setWaveform(btn.dataset.waveform));
    });

    this._onChange = () => this._syncActive();
    store.addEventListener('change', this._onChange);
    this._syncActive();
  }

  disconnectedCallback() {
    store.removeEventListener('change', this._onChange);
  }

  _syncActive() {
    this.buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.waveform === store.waveform);
    });
  }
}

customElements.define('waveform-picker', WaveformPicker);
