// Utility to robustly open external URLs from within the preview iframe or the app
// Tries a new tab first (best for sandboxed iframes), then top-level navigation, then same-window fallback
export function openExternalUrl(url: string) {
  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win) return; // Popup allowed
  } catch (_) {
    // ignore
  }
  try {
    if (window.top) {
      // May throw in some sandboxed contexts; wrap in try/catch
      (window.top as Window).location.href = url;
      return;
    }
  } catch (_) {
    // ignore
  }
  // Final fallback
  window.location.assign(url);
}
