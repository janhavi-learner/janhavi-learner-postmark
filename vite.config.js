import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// --host (in package.json) makes the dev server reachable from a phone on the same Wi-Fi.
// HTTPS with a self-made certificate, because Wake Lock and location only work on secure pages.
// The phone shows a "not private" warning once; tap through it.
export default defineConfig({
  plugins: [
    basicSsl(),
    // Works offline after the first visit and can be added to the home screen.
    // The service worker only exists in the built site (npm run build, then npm run preview).
    VitePWA({
      // A new version is used from the next open; the page never reloads mid-painting.
      // Registered in src/main.js, so failing (e.g. on the self-signed dev certificate) stays quiet.
      registerType: 'autoUpdate',
      injectRegister: null,
      workbox: {
        // Everything the app needs, including the paper scan and the tuning panel (for ?tune).
        globPatterns: ['**/*.{js,css,html,jpg,png,svg,webmanifest}'],
      },
      manifest: {
        name: 'Postmark',
        short_name: 'Postmark',
        description: 'Paint a small watercolor stamp of where you are.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ece8e1',
        theme_color: '#ece8e1',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { host: true },
});
