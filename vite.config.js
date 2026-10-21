import { defineConfig } from 'vite';

// --host (in package.json) makes the dev server reachable from a phone on the same Wi-Fi.
export default defineConfig({
  server: { host: true },
});
