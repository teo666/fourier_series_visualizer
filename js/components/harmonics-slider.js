import { store } from '../store.js';

class HarmonicsSlider extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <label class="control-label">
        Number of harmonics: <span id="harmonicsValue">${store.nHarmonics}</span>
      </label>
      <input type="range" id="harmonicsSlider" min="1" max="200" value="${store.nHarmonics}" step="1">
    `;
    this.slider = this.querySelector('#harmonicsSlider');
    this.valueLabel = this.querySelector('#harmonicsValue');

    this.slider.addEventListener('input', () => {
      const n = parseInt(this.slider.value, 10);
      this.valueLabel.textContent = n;
      store.setHarmonics(n);
    });
  }
}

customElements.define('harmonics-slider', HarmonicsSlider);
