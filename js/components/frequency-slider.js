import { store } from '../store.js';

class FrequencySlider extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <label class="control-label">
        Base frequency: <span id="frequencyValue">${store.freqHz}</span> Hz
      </label>
      <input type="range" id="frequencySlider" min="55" max="880" value="${store.freqHz}" step="1">
    `;
    this.slider = this.querySelector('#frequencySlider');
    this.valueLabel = this.querySelector('#frequencyValue');

    this.slider.addEventListener('input', () => {
      const hz = parseInt(this.slider.value, 10);
      this.valueLabel.textContent = hz;
      store.setFrequency(hz);
    });
  }
}

customElements.define('frequency-slider', FrequencySlider);
