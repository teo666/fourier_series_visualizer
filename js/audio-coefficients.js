import { isHarmonicActive } from './fourier-math.js';

// Shared by live playback, the exported JS snippet, and the WAV export:
// the real/imag coefficient tables actually used to reconstruct the sound
// (muted harmonics zeroed out, so array indices stay aligned with k).
export function buildActiveCoefficientArrays(coeffs, nHarmonics, harmonicState) {
  const n = Math.min(nHarmonics, coeffs.an.length - 1);
  const real = new Float32Array(n + 1);
  const imag = new Float32Array(n + 1);
  for (let k = 1; k <= n; k++) {
    if (harmonicState && !isHarmonicActive(harmonicState, n, k)) continue;
    real[k] = coeffs.an[k];
    imag[k] = coeffs.bn[k];
  }
  return { real, imag, n };
}
