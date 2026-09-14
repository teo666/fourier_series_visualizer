import { store } from '../store.js';
import { buildActiveCoefficientArrays } from '../audio-coefficients.js';

// ---------------------------------------------------------------------
// WAV export: render the current sound offline and encode it as a
// downloadable 16-bit PCM WAV file.
// ---------------------------------------------------------------------

function encodeWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const numFrames = audioBuffer.length;
  const dataSize = numFrames * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData = [];
  for (let ch = 0; ch < numChannels; ch++) channelData.push(audioBuffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function renderSoundToWavBlob(coeffs, nHarmonics, harmonicState, freqHz, durationSeconds, volume) {
  const sampleRate = 44100;
  const length = Math.max(1, Math.ceil(sampleRate * durationSeconds));
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const offlineCtx = new OfflineCtx(1, length, sampleRate);

  const { real, imag } = buildActiveCoefficientArrays(coeffs, nHarmonics, harmonicState);
  const wave = offlineCtx.createPeriodicWave(real, imag, { disableNormalization: false });

  const oscillator = offlineCtx.createOscillator();
  oscillator.setPeriodicWave(wave);
  oscillator.frequency.value = freqHz;

  // Short fades avoid a click at the very start/end of the file.
  const fadeTime = Math.min(0.01, durationSeconds / 4);
  const gain = offlineCtx.createGain();
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(volume, fadeTime);
  gain.gain.setValueAtTime(volume, Math.max(fadeTime, durationSeconds - fadeTime));
  gain.gain.linearRampToValueAtTime(0, durationSeconds);

  oscillator.connect(gain).connect(offlineCtx.destination);
  oscillator.start(0);
  oscillator.stop(durationSeconds);

  const renderedBuffer = await offlineCtx.startRendering();
  return encodeWav(renderedBuffer);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

class WavExportPanel extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <button id="exportWavBtn" class="action-btn">💾 Export WAV</button>
      <label class="volume-label">
        Duration (s)
        <input type="number" id="wavDurationInput" min="0.1" max="10" step="0.1" value="2">
      </label>
    `;
    this.exportWavBtn = this.querySelector('#exportWavBtn');
    this.wavDurationInput = this.querySelector('#wavDurationInput');

    this.exportWavBtn.addEventListener('click', async () => {
      const originalLabel = this.exportWavBtn.textContent;
      const duration = Math.max(0.1, Math.min(10, parseFloat(this.wavDurationInput.value) || 2));
      this.exportWavBtn.disabled = true;
      this.exportWavBtn.textContent = 'Exporting…';
      try {
        const blob = await renderSoundToWavBlob(
          store.coeffs,
          store.nHarmonics,
          store.harmonicState,
          store.freqHz,
          duration,
          store.volume
        );
        downloadBlob(blob, `fourier-${store.waveform}-${store.freqHz}hz.wav`);
      } catch (e) {
        alert('WAV export failed: ' + e.message);
      } finally {
        this.exportWavBtn.disabled = false;
        this.exportWavBtn.textContent = originalLabel;
      }
    });
  }
}

customElements.define('wav-export-panel', WavExportPanel);
