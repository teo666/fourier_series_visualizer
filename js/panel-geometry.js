// Small geometry helpers shared by coefficients-panel and
// magnitude-phase-panel (both lay out one column per harmonic across the
// canvas width).

export function coeffColumnWidth(canvas, nHarmonics) {
  return canvas.width / Math.max(1, nHarmonics);
}

export function harmonicAtX(x, colWidth, n) {
  return Math.min(n, Math.max(1, Math.floor(x / colWidth) + 1));
}
