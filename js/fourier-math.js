// ---------------------------------------------------------------------
// Fourier coefficients for predefined waveforms.
// Convention: f(theta) = a0/2 + sum_{k=1..N} [ an[k]*cos(k*theta) + bn[k]*sin(k*theta) ]
// theta ranges over [0, 2*PI) for one period. an/bn are 1-indexed (index 0 unused).
// ---------------------------------------------------------------------

export const MAX_HARMONICS = 200;
export const DRAW_SAMPLES = 512;

function zeros(n) {
  return new Array(n + 1).fill(0);
}

export const waveforms = {
  sine(maxN) {
    const an = zeros(maxN);
    const bn = zeros(maxN);
    bn[1] = 1;
    return { a0: 0, an, bn };
  },

  square(maxN) {
    const an = zeros(maxN);
    const bn = zeros(maxN);
    for (let n = 1; n <= maxN; n++) {
      if (n % 2 === 1) bn[n] = 4 / (Math.PI * n);
    }
    return { a0: 0, an, bn };
  },

  triangle(maxN) {
    const an = zeros(maxN);
    const bn = zeros(maxN);
    for (let n = 1; n <= maxN; n++) {
      if (n % 2 === 1) {
        const k = (n - 1) / 2;
        bn[n] = (8 / (Math.PI * Math.PI * n * n)) * (k % 2 === 0 ? 1 : -1);
      }
    }
    return { a0: 0, an, bn };
  },

  sawtooth(maxN) {
    const an = zeros(maxN);
    const bn = zeros(maxN);
    for (let n = 1; n <= maxN; n++) {
      bn[n] = (2 / (Math.PI * n)) * (n % 2 === 0 ? -1 : 1);
    }
    return { a0: 0, an, bn };
  },

  halfRectified(maxN) {
    const an = zeros(maxN);
    const bn = zeros(maxN);
    const a0 = 2 / Math.PI;
    if (maxN >= 1) bn[1] = 0.5;
    for (let n = 2; n <= maxN; n++) {
      if (n % 2 === 0) {
        an[n] = -2 / (Math.PI * (n * n - 1));
      }
    }
    return { a0, an, bn };
  },
};

// Discrete Fourier Transform for a hand-drawn waveform sampled uniformly
// over one period. `samples` is an array of values in roughly [-1, 1].
export function computeDFTCoefficients(samples, maxN) {
  const M = samples.length;
  const an = zeros(maxN);
  const bn = zeros(maxN);
  let sum = 0;
  for (let m = 0; m < M; m++) sum += samples[m];
  const a0 = (2 / M) * sum;

  for (let k = 1; k <= maxN; k++) {
    let sa = 0;
    let sb = 0;
    const w = (2 * Math.PI * k) / M;
    for (let m = 0; m < M; m++) {
      sa += samples[m] * Math.cos(w * m);
      sb += samples[m] * Math.sin(w * m);
    }
    an[k] = (2 / M) * sa;
    bn[k] = (2 / M) * sb;
  }
  return { a0, an, bn };
}

export function partialSum(coeffs, nHarmonics, theta, isActive) {
  let value = coeffs.a0 / 2;
  const n = Math.min(nHarmonics, coeffs.an.length - 1);
  for (let k = 1; k <= n; k++) {
    if (isActive && !isActive(k)) continue;
    value += coeffs.an[k] * Math.cos(k * theta) + coeffs.bn[k] * Math.sin(k * theta);
  }
  return value;
}

// Mute/solo state: harmonicState[k] = { muted, solo }, 1-indexed.
export function createHarmonicState(maxN) {
  const state = new Array(maxN + 1);
  for (let k = 0; k <= maxN; k++) state[k] = { muted: false, solo: false };
  return state;
}

export function isHarmonicActive(harmonicState, nHarmonics, k) {
  if (k > nHarmonics) return false;
  let anySolo = false;
  for (let i = 1; i <= nHarmonics; i++) {
    if (harmonicState[i] && harmonicState[i].solo) {
      anySolo = true;
      break;
    }
  }
  const entry = harmonicState[k];
  if (!entry) return true;
  if (anySolo) return entry.solo && !entry.muted;
  return !entry.muted;
}
