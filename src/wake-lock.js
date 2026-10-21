// Keeps the screen on while the app is open. The browser drops the lock whenever the page
// is hidden (lock screen, app switch), so it's asked for again when the page comes back,
// and on the next touch in case the browser wanted a tap first.
// Only works on HTTPS pages; elsewhere it quietly does nothing.

export function keepScreenAwake() {
  if (!('wakeLock' in navigator)) return;
  let lock = null;
  let asking = false;

  async function request() {
    if (asking || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
    asking = true;
    try {
      lock = await navigator.wakeLock.request('screen');
    } catch {
      // Not allowed right now (e.g. battery saver); try again on the next touch.
    } finally {
      asking = false;
    }
  }

  request();
  document.addEventListener('visibilitychange', request);
  window.addEventListener('pointerdown', request);
}
