// Pointer capture can throw (e.g. for a pointer id the browser doesn't
// consider "active"); dragging should degrade gracefully rather than
// abort the whole gesture.
export function safeSetPointerCapture(el, pointerId) {
  try {
    el.setPointerCapture(pointerId);
  } catch (e) {
    /* ignore: capture is a nice-to-have, not required for dragging to work */
  }
}

export function safeReleasePointerCapture(el, pointerId) {
  try {
    if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
  } catch (e) {
    /* ignore */
  }
}
