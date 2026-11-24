# Cooltura × Intimissimi · Recap studio

A 30 s social film (campaign recap) built as a tool: one WebGL canvas (three.js),
GSAP easing (CustomEase), a deterministic clock, and an editor around it with a
Premiere / CapCut-style timeline and an effects panel.

```bash
npm install
npm run dev        # http://localhost:5410
npm run media      # rebuild the video proxies from ~/Desktop/INTIMISSIMI VIDEO
npm run ship       # build + deploy to Vercel (production)
```

Live (open link, noindex): https://cooltura-intimissimi.vercel.app (still V2 until the next `npm run ship`).

Chrome on a Mac is the target (WebCodecs export, system emoji in the comments).

## The film (V3, default cut, 30.00 s with either intro)

| Scene | Shots | What happens |
|---|---|---|
| Intro A · logo (key `1`) | cooltura × intimissimi | the two logotypes side by side with a small thin × sized on cooltura's x-height: the × draws, cooltura reveals letter by letter right → left, intimissimi left → right while its frame sweeps open; out in opacity |
| Intro B · statement (key `2`) | Creators. · Culture. · Impact. · logo | each word in chars from y 50 % in a mask, the next one pushes the last one up; then the same logo reveal |
| Campaigns | 311 Creators · 5 campaigns · One shared vision · Uscita video | the first video grows on white, "311" turns in like a cube letter by letter over "Creators"; the row of videos slides out for "5 campaigns"; every row grows onto a flat grid (rows drifting in alternate directions), the central line opens like a curtain and "One shared vision" comes up in chars from violet at 0 to ink; the videos leave from the centre outwards |
| The numbers | I numeri · From content to communities · Commenti | four totals in one aligned column, each a counter that reveals itself (reels rolling up through a mask with motion blur, settling sharp), out upwards; "From content to communities" word by word, the two halves part and the number of comments counts up in the gap; the comments arrive under it as notifications, faster and faster, the camera follows them down and runs into a speed blur |
| Beyond numbers | Beyond numbers. · We paired creators… · ARIA · We went beyond the brief… · Esternabilità | the title arrives out of the blur; each statement (left aligned) is swept away word by word, right to left, by the first card of a circular carousel (ARIA, then Esternabilità) that comes in from the right and turns on a semicircle; "#1 result on TikTok search for the product category" under ARIA |
| Closing | The best part? · We're just getting started. · logo | chars from x 50 % in a mask, slightly right of centre, out to the left; the second line the same; the logos again |

V1 and V2 are kept as source in `archive/v1/` and `archive/v2/` (V2's proxies in `media-src/v2-media/`).

### Numbers on screen (sums of what the recap slides give, to be verified)

| On screen | From |
|---|---|
| 9.8M+ views organiche | ARIA 9M + NUDE LOOK 840K (GIOIA's organic views are not in the material: hence the +) |
| 60M views paid | 70M total (ARIA 47M + GIOIA 17.9M + NUDE LOOK 5.16M) − 9.8M organic. If GIOIA had organic views, paid is lower |
| +XX% vs benchmark | placeholder: no benchmark in the material |
| 497K+ interactions | from the brief (the slides say 985.6K interactions in total, 419K organic on ARIA: check the perimeter) |
| XXK commenti | placeholder: no comment count in the material |

Every value is a text field in the panel; a figure typed there counts up by itself.

## The editor

- **Intro A / B** (top bar, or keys `1` / `2`): the rest of the film is the same.
- **Timeline** (bottom): scenes above, shots below, thumbnails, playhead.
  - click a block → its effects open on the right
  - drag its **right edge** → duration (everything after ripples)
  - drag its **left edge** → move the cut with the previous shot (film length unchanged)
  - drag a **scene's edge** → stretch the whole scene, shots keep their proportions
  - ruler / empty lane → scrub · ⌘-wheel → zoom · "Adatta a 30 s" rescales the cut to exactly 30 s
- **Effects panel** (right): every block's effects as sections. Type blocks have
  *Testo* (copy, weight, size, line, position, colours violet → ink, motion blur),
  *Reveal* and *Unreveal*, each with its own split (chars / words / lines), stagger order
  (start, end, centre, edges, random), start, stagger, duration, ease, X / Y offset (% of the
  letter, GSAP signs), X turn + depth (0.5 = a cube), scale, blur, opacity, mask.
  Carousels: the videos (tick any video of the campaign's folder; they arrive in that order),
  shape (semicircle / 3D ring), sizes, motion.
- **Eases**: GSAP CustomEase. The film's own curves (`ci.reveal`, `ci.soft`, `ci.emph`,
  `ci.glide`, `ci.swift`, `ci.exit`, `ci.accel`), every GSAP ease, or click the curve to drag
  the two handles of a cubic-bezier.
- **Format** (top): 9:16 · 3:4 · 1:1 · 16:9. Layouts are computed from the frame (type on its
  short side), so nothing is cropped when the format changes.
- **Export MP4**: frame-exact (WebCodecs H.264 + Mediabunny), 30 / 60 fps, optional 2×
  supersampling. File name carries the format and the intro. With the dev server running, a copy
  lands in `exports/`.
- **Project menu**: copy / paste the whole cut as JSON, restore the original, the V2 storyboard.

Keys: `space` play · `← →` frame (`⇧` 1 s) · `↑ ↓` previous / next shot · `1` `2` intro ·
`⇧1-4` format · `S` snap · `F` fit timeline · `+ −` zoom · `L` loop · `⌘Z` / `⇧⌘Z`.

## How it is built

```
src/
  model/project.js   the cut: scenes → shots → effect parameters (+ their UI specs), defaults
  model/store.js     edits, undo, autosave (localStorage), ripple / roll / stretch, intro A / B
  engine/engine.js   renderer, clock, renderAt(t): scene → MSAA float target → FX layer → post → canvas
  engine/fxlayer.js  type, logos, cards: real gaussian blur + motion blur (instanced taps), masks
  engine/post.js     speed blur, vignette, grain, dither
  engine/videos.js   video textures: free-running in preview, seeked per frame in export
  engine/exporter.js MP4 export
  lib/kinetic.js     kinetic type (SplitText-like: chars / words / lines, masks, cube turns)
  lib/counter.js     the counters (reels through a mask, tabular digits)
  actors/            lockup · texts · grid (campaigns) · numbers · carousel
  lib/               type as geometry (opentype.js), brand artwork, shaders, canvas artwork
  ui/                top bar, stage, timeline, effects panel (+ bezier editor, video picker)
tools/
  media.sh           video proxies from ~/Desktop/INTIMISSIMI VIDEO
  shot.mjs           frames / contact sheets (headless Chrome)  node tools/shot.mjs --intro B --n 24 --sheet
  snaps.mjs          renders every frame and flags frame-to-frame jumps
  interact.mjs       drives the editor like a user (resize, edit, intro keys, undo, playback fps)
  export.mjs         export from the command line   node tools/export.mjs --aspect 16:9 --intro A --ssaa 2
```

Everything on screen is a pure function of time (`value = lerp(a, b, ease(progress))`), so
scrubbing, the thumbnails and the export always agree. A shot only has a duration; its start
is the sum of what comes before, and each actor reads the resolved times, so resizing a block
retimes the animation inside it.

To add a parameter: add its spec to the shot / scene type in `model/project.js` and read
`shot.p.<key>` in the actor. It appears in the panel on its own.

## Media

`npm run media` re-creates `public/media/v3` (≈ 250 MB, from ≈ 5 GB of sources):

- `grid/` 432 × 768 proxies of the 52 videos (duplicates in the folder made once)
- `feed/` 576 × 1024 for the carousels (all of ARIA and Esternabilità)
- `hero.mp4` 1080 × 1920, Alice Muzza (ARIA), the first video

## Notes

- **Type**: PP Neue Machina "Free for Personal Use" (same files as the Cooltura reel). A
  commercial licence from Pangram Pangram is needed before publishing.
- **Video colour**: the videos are drawn with exactly their pixels (no dim, blur, grain). Video
  textures reach custom shaders sRGB-encoded, so `tileMaterial` decodes them. HDR (HLG) and
  Display P3 sources go through macOS (`avconvert`) before the proxies; every proxy is BT.709,
  limited range, tagged.
- **Intimissimi logo**: the official SVG from intimissimi.com (`public/logos/`).
- Comments are verbatim from the "comments grid", typos included.
- The storyboard (Progetto → Storyboard V2) still draws the V2 film.
