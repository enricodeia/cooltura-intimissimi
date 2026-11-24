# Cooltura × Intimissimi · Recap studio

A 30 s social film (campaign recap) built as a tool: one WebGL canvas (three.js),
GSAP easing, a deterministic clock, and an editor around it with a
Premiere / CapCut-style timeline and an effects panel.

```bash
npm install
npm run dev        # http://localhost:5410
npm run ship       # build + deploy to Vercel (production)
```

Live (open link, noindex: not listed by search engines): https://cooltura-intimissimi.vercel.app

Storyboard: http://localhost:5410/storyboard.html, or Progetto → Storyboard in the studio.
One hand-drawn wireframe per animation, Wide 16:9 or Post 9:16 (switch at the top), with the
written animation detail beside each one (timings, eases, staggers and values read from the
current cut). Every drawing and every sheet is its own SVG with named layers and live text
(Caveat): "Copia SVG" → paste in Figma, "Scarica .svg", or "Scarica tutto" (a zip of 32
separate files). Code in src/storyboard/ (rough.js, @fontsource/caveat, fflate).

Chrome on a Mac is the target (WebCodecs export, system emoji in the comments).

## The film (V2, default cut, 30.00 s)

| Scene | Shots | What happens |
|---|---|---|
| Apertura · video | Nicole Pieretto · 2 · 3 · 175 · 394 | the first video scales up on white; the camera pulls back as "2" zooms out (Instagram + TikTok in 3D); the videos join one beat per number: 1 → 3 (slide out from behind) → the whole row turning → every row of the sphere. Flat violet numbers, digits turn like a wheel |
| iPhone + views | Pila · made for · 70M · 9M · 985.6K | the other rows sink back, the row's cards slide one onto the other into a neat deck that grows into the phone's screen (Marta Carruozzo on top, not the opening video); the iPhone closes around it; "made for / externability" letter by letter; the phone steps right with the feed swiping; numbers on the left under two beams of window light with dust |
| Commenti | Notifiche · Tuffo | lock screen, comments land as iOS notifications (frosted glass made from the wallpaper under them) while the camera closes in; the dive with speed blur |
| I numeri | Titolo · Campagne | "LA FORZA DELLE NOSTRE CAMPAGNE IN NUMERI" (semibold 600 interpolated from the font's cuts), then 47M / 17.9M / 5.16M counting up (tabular digits) |
| Roadmap | ARIA · GIOIA · NUDE LOOK · UWC · NATALE | white → lavender from the right, the line comes in from the left edge; at each stop: node, stem out of the line, the circle draws, then its video (or the 3D "c?") opens; name, contents, date |
| Chiusura | Logotipo | line and circles draw back, back to white, cooltura rises letter by letter out of its baseline and the "?" docks as the "*" (as at the end of the Cooltura reel) |

V1 (lockup, dark backgrounds, 3D numbers, bounce) is kept as source in `archive/v1/`.

## The editor

- **Timeline** (bottom): scenes above, shots below, thumbnails, playhead.
  - click a block → its effects open on the right
  - drag its **right edge** → duration (everything after ripples)
  - drag its **left edge** → move the cut with the previous shot (film length unchanged)
  - drag a **scene's edge** → stretch the whole scene, shots keep their proportions
  - ruler / empty lane → scrub · ⌘-wheel → zoom · "Adatta a 30 s" rescales the cut to exactly 30 s
- **Effects panel** (right): each shot lists its effects as sections (values, colours from the
  Cooltura palette, easing with a curve preview, cubic-bezier), then the effects of its scene
  (e.g. the wall's sphere, the god rays switch). Every section has a reset.
- **Format** (top): 9:16 · 3:4 · 1:1 · 16:9. Layouts are computed from the visible frame, so
  nothing is cropped when the format changes.
- **Export MP4**: frame-exact (WebCodecs H.264 + Mediabunny), 30 / 60 fps, optional 2× supersampling.
  The file downloads and, with the dev server running, a copy lands in `exports/`.
- **Project menu**: copy / paste the whole cut as JSON, restore the original.

Keys: `space` play · `← →` frame (`⇧` 1 s) · `↑ ↓` previous / next shot · `1-4` format ·
`S` snap · `F` fit timeline · `+ −` zoom · `L` loop · `⌘Z` / `⇧⌘Z`.

## How it is built

```
src/
  model/project.js   the cut: scenes → shots → effect parameters (+ their UI specs), defaults
  model/store.js     edits, undo, autosave (localStorage), ripple / roll / stretch
  engine/engine.js   renderer, clock, renderAt(t): scene → MSAA float target → post → canvas
  engine/background.js  backdrop colours, wipes, the god rays
  engine/post.js     speed blur, vignette, grain, dither
  engine/videos.js   video textures: free-running in preview, seeked per frame in export
  engine/exporter.js MP4 export
  actors/            one file per part of the film; each poses itself for a time t
  lib/               type as geometry (opentype.js), brand artwork, fat lines, shaders, canvas artwork
  ui/                top bar, stage, timeline, effects panel
tools/
  media.sh           builds the video proxies from ~/Desktop/Video Transf
  shot.mjs           frames / contact sheets (headless Chrome)   node tools/shot.mjs --from 9.4 --to 11.6 --n 30 --sheet
  ui.mjs             screenshot of the studio
  interact.mjs       drives the editor like a user (resize, edit, undo, playback fps)
  export.mjs         full export from the command line
```

Everything on screen is a pure function of time (`value = lerp(a, b, ease(progress))`), so
scrubbing, the thumbnails and the export always agree. A shot only has a duration; its start
is the sum of what comes before, and each actor reads the resolved times, so resizing a block
retimes the animation inside it.

To add a parameter: add its spec to the shot / scene type in `model/project.js` and read
`shot.p.<key>` in the actor. It appears in the panel on its own.

## Media

`npm run media` re-creates `public/media` (≈ 70 MB, not the 2.9 GB of sources):

- `grid/` 288 × 512 proxies of the 24 clean videos + 5 tiles cropped out of the presentation
  wall recording (the only source of GIOIA / NUDE LOOK footage)
- `feed/` 576 × 1024 for the phone and the timeline circles
- `hero.mp4` 1080 × 1920, Nicole Pieretto

## Notes

- **Type**: PP Neue Machina "Free for Personal Use" (same files as the Cooltura reel). A
  commercial licence from Pangram Pangram is needed before publishing. Weights are continuous:
  Light / Regular / Ultrabold share their point structure, so 500, 600… are real instances
  interpolated point by point (`src/lib/type.js`).
- **Video colour**: the videos are drawn with exactly their pixels (no dim, blur, grain). Video
  textures reach custom shaders sRGB-encoded, so `tileMaterial` decodes them (without it every
  video came out lighter and greyer). The three HDR (HLG) sources are tone-mapped by macOS
  (`avconvert`) before the proxies are made; every proxy is BT.709, limited range, tagged.
- **Intimissimi logo**: the official SVG from intimissimi.com (`public/logos/`).
- **Data** comes from the recap slides. Two things to confirm with the client:
  the timeline slide says GIADA where every other slide says GIOIA (the film says GIOIA), and
  UWC shows "211 contenuti", identical to NUDE LOOK (left blank here; it is one field in the panel).
- Comments are verbatim from the "comments grid", typos included.
