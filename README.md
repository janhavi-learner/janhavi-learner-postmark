# Postmark

Paint a small watercolor stamp of where you are and save it as a postmarked souvenir.
Spec: `docs/PRD.pdf`. The watercolor engine lives in `engine/` (copied from
[janhavi-learner-postmark-watercolour](https://github.com/janhavi-learner/janhavi-learner-postmark-watercolour)); don't edit it here.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Once, after cloning. |
| `npm run dev` | Dev server for your phone over Wi-Fi (HTTPS with a home-made certificate; tap through the warning). |
| `npm run build` then `npm run preview` | The real built site, as it will be published. |
| `npm run engine:update` | Pull the latest engine. Commit your own changes first. |

Add `?tune` to the address to show the engine's tuning sliders.

## Publishing (Vercel)

Import this GitHub repo at vercel.com/new. Vercel detects Vite; keep the defaults
(build `npm run build`, output `dist`). Every push to `main` then publishes again.
Offline mode and "Add to Home Screen" only work on the published HTTPS site, not on the Wi-Fi dev server.

## Where things are

- `src/style.css`: colors, sizes and spacing as CSS variables at the top
- `src/brushes.js`: brush sizes, Detail brush offset and smoothing
- `src/palettes.js`: the five preset palettes
- `src/postmark-art.js`: the stamp and sticker design (`STAMP`, `STICKER` at the top)
- `src/place.js`: location and the place-type guess
- `public/icons/`: home screen icons (placeholders)
