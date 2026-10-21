import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// --host (in package.json) makes the dev server reachable from a phone on the same Wi-Fi.
// HTTPS with a self-made certificate, because Wake Lock and location only work on secure pages.
// The phone shows a "not private" warning once; tap through it.
export default defineConfig({
  plugins: [basicSsl()],
  server: { host: true },
});
