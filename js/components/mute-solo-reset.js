import { store } from '../store.js';

class MuteSoloReset extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<button id="resetMuteSoloBtn" class="action-btn small">Reset mute/solo</button>`;
    this.querySelector('#resetMuteSoloBtn').addEventListener('click', () => {
      store.resetMuteSolo();
    });
  }
}

customElements.define('mute-solo-reset', MuteSoloReset);
