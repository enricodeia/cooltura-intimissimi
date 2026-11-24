> Archive: V4 "Instrument" (45 s) and V5 "La nota" (45 s) as they were on 2026-11-22, before the 30 s recut of both. V6 "Il velo" was deleted on request.

# Cooltura × Intimissimi · Recap studio

A 45 s campaign-recap film built as a tool: one WebGL canvas (three.js), GSAP
easing (CustomEase), a deterministic clock, and an editor around it with a
Premiere / CapCut-style timeline and an effects panel. 16:9 is the master format
(9:16, 3:4, 1:1 follow from the same cut).

```bash
npm install
npm run dev        # http://localhost:5410
npm run media      # rebuild the video proxies from ~/Desktop/INTIMISSIMI VIDEO
npm run ship       # build + deploy to Vercel (production)
```

Live (open link, noindex): https://cooltura-intimissimi.vercel.app (still V2 until the next `npm run ship`).
V4 and V5 are local only.

**Two editions share the studio** (engine, timeline, panel, export) and differ in their model and actors.
The top bar switches between them:

| Page | Edition | Type | Idea |
|---|---|---|---|
| `index.html` · http://localhost:5410/ | **V4 · Instrument** | Instrument Serif + Sans | V3 recut for reading: one idea at a time, centred beats on white |
| `machina.html` · http://localhost:5410/machina.html | **V5 · La nota** | PP Neue Machina | one line, one take: the asterisk of cooltura* draws the whole film |

Chrome on a Mac is the target (WebCodecs export, system emoji in the comments).

## The film (V4, default cut, 45.00 s with either intro)

V4 is V3 recut for reading: one idea on screen at a time, every line held long enough to be read,
type always on white (never over a video), one type system.

| Scene | Shots | What happens |
|---|---|---|
| Intro A · logo (key `1`) | cooltura × intimissimi | the two logotypes side by side (intimissimi plain, no frame, its x-height on cooltura's) with a small thin × between them: the × draws, cooltura reveals letter by letter right → left, intimissimi left → right; out in opacity only |
| Intro B · statement (key `2`) | Creators. · Culture. · Impact. · logo | each word in chars from y 50 % in a mask, the next one pushes the last one up; then the same logotypes |
| Campaigns | 311 Creators · 5 campaigns · One shared vision · Uscita video | the first video grows on white and fills the frame for a breath; the camera pulls back and "311" turns in like a cube beside it (under it in narrow frames), "Creators" under the number; 311 turns away, the row slides out from behind the video (exactly five videos) and "5 campaigns" turns in under it; 5 turns away, every row grows onto a flat grid, the central line opens like a curtain and "One shared vision" comes up in chars, violet at 0 → ink; the videos leave from the centre outwards |
| The numbers | I numeri · From content to communities · Commenti | four totals set as a table (figures right-aligned in Instrument Serif, what they count in Instrument Sans on their baseline), each a counter that reveals itself (reels through a mask, violet → ink), out upwards; "From content to communities" word by word, the two halves part (two lines opening up and down in narrow frames) and the number of comments counts up in the gap; the number rises and 40 notifications pour out from under it, each new one pushing the others down, faster and faster, until they stream (motion blur from their real speed) and everything falls away in a speed blur |
| Beyond numbers | Beyond numbers. · We paired creators… · Aria · We went beyond the brief… · Externability | the title arrives out of the blur; each statement (left on the margin) is swept away word by word, right to left, by the first card of a wheel of the campaign's videos: the wheel turns in from the right and settles, pauses on a video, turns one card, then accelerates out to the left; the campaign's name above it, "#1 result on TikTok search for the product category" under Aria |
| Closing | The best part? · We're just getting started. · logo | chars from x 50 % in a mask, slightly right of centre, out to the left; the second line the same; the logotypes again, held to the end |

At 30 s this copy cannot be read (17 beats, two 12-14 word statements): 45 s is what reading it takes.
The ruler's green mark is the target length (field next to "Adatta a", 45 s by default).

V1-V4 are kept as source in `archive/v1/` … `archive/v4/` (V2's proxies in `media-src/v2-media/`; `archive/v4` is V4 as it was before V5 was added).

## The film (V5 · La nota, machina.html, 45.00 s with intro A)

Cooltura signs with an asterisk, and in typography an asterisk sends you to a footnote. In V5 the
asterisk of cooltura* leaves the logo, drops to the footnote rule and draws it, rolling (it turns
only when it moves): **one line, one take**, from the first frame to the last. Everything is born
from that line (the creators rise from it, the figures roll up out of it, the words stand on it,
the comments hang off it) and the camera only follows it: nothing leaves, the camera moves on.
At the end the asterisk climbs back into the logo and reels its line in.

The story follows the original brief's structure, including its three "From … to …" headlines
(the long statements of V3/V4 are not used: the headlines say the same thing and the line is the "to").

| Station (shot) | What happens |
|---|---|
| `logo` (intro A) / `w-*` + `logo-b` (intro B) | the V4 lockup reveal (the asterisk is part of it); then the asterisk hooks out of the logo, down into the gap and onto the line |
| `creators` · 1 → 311 | the pen draws a frame and the first creator's video rises inside it; the camera pulls back ~10× while the pen runs along the line and 310 more videos build up from it column by column (31 × 10 in 16:9), "311 CREATORS" rolls up beside them, counting with the columns |
| `campaigns` · 5 campaigns | the camera slides at that zoom until the wall is out of frame, then zooms onto the line; the five campaigns rise from the line one after another, each pushing the previous up, while the "5" counts them (Aria · Nude Look · Ultralight with Cashmere (Italia) · (USA) · Natale & Party Looks, from the brief) |
| `vision` · One shared vision. | the five sink back into the line; one sentence rises out of it |
| `stat-a`, `stat-b` · the numbers | figures roll up out of the line, captions hang under it, a tick where each one stands |
| `beyond` · Beyond numbers. | the line goes on past the last figure |
| `ch1-from` · `aria` · `claim` · `ch1-to` | "From insights" → three Aria videos in frames the pen draws → "#1" counting DOWN to 1 (a ranking climbing) + "result on TikTok search for the product category" → "to sales." |
| `ch2-from` · `ext` · `ch2-to` | "From viral" → three Externability videos → "to iconic." |
| `ch3-from` · `thread` · `ch3-to` | "From content" → "XXK COMMENTS", the line turns down and becomes a thread: the comments hang off it; the first ones are read, then the camera dives (a blur of comments), slows on the last ones and the line turns onto "to communities." |
| `best`, `started`, `outro` | "The best part?" · "We're just getting started." · the logo writes itself, the asterisk climbs back into cooltura* and the line is reeled in |

- Words stand on the line and rise out of it (masked at the line) when the pen passes under each letter
  ("From" / "to" in grey, the key word in ink, violet while it is born). The resting asterisk after
  each station reads as a footnote mark.
- Type scale (cap height, % of the short side): titles 7.2, figures 8.8 (311: 9.6, #1: 15),
  captions 2.05 uppercase tracked, campaign names 3.3 (fitted to the frame in narrow formats).
- Neue Machina's default zero is slashed (Ø): V5 uses the font's plain zero (stylistic set ss12),
  switchable in the global look ("Zero senza barra").
- Captions are in English (ORGANIC VIEWS, PAID VIEWS, VS BENCHMARK, INTERACTIONS, COMMENTS) like the rest of the copy.
- 30 comment slots from the 23 real comments: repeats only in the fast middle of the thread; it
  opens on short warm ones and closes on "Finalmente un reggiseno comodo", "ragazze prendetelii…",
  "L'ho comprato lunedì e tornerò…", "Vero, comodo quasi come non averlo".
- Global look (panel with nothing selected): line colour and weight, the travelling asterisk's
  colour and size, plain zero, camera motion blur (it fades out during zooms), grain, vignette.
- Every station has "Camera e penna": camera travel time and ease, the pen's time and ease.
- Edits autosave under their own key (`cooltura-intimissimi.machina.v1`): V4 and V5 never mix.

### Type

- **Instrument Serif** (display, statements, numbers) and **Instrument Sans** (labels, the claim's line):
  SIL Open Font Licence, free for commercial use (`public/fonts/*.woff`, from `@fontsource`).
- One scale, as cap height in % of the frame's short side (the same pixels in 16:9 and 9:16):
  display lines 7.6, statements 5.6 (measure 1.34 × short side, leading 1.14), table figures 6.6,
  labels 2.1-2.6 (×1.35 in narrow frames), 311 / 5 ≈ 16-20 % of the frame height.
- Instrument Serif's hyphen is long with wide side bearings: it is kerned tighter in `lib/type.js`.
- Neue Machina (V3) is still selectable in every "Carattere" menu (it needs a commercial licence to publish).

### Numbers on screen (sums of what the recap slides give, to be verified)

| On screen | From |
|---|---|
| 9.8M+ views organiche | ARIA 9M + NUDE LOOK 840K (GIOIA's organic views are not in the material: hence the +) |
| 60M views paid | 70M total (ARIA 47M + GIOIA 17.9M + NUDE LOOK 5.16M) − 9.8M organic. If GIOIA had organic views, paid is lower |
| +XX% vs benchmark | placeholder: no benchmark in the material |
| 497K+ interactions | from the brief (the slides say 985.6K interactions in total, 419K organic on ARIA: check the perimeter) |
| XXK commenti | placeholder: no comment count in the material |

Every value is a text field in the panel; a figure typed there counts up by itself.
(Interactions: the brief says 497K+, the slides 985.6K in total.)

## The editor

- **Intro A / B** (top bar, or keys `1` / `2`): the rest of the film is the same.
- **Format**: 16:9 by default (the master); `⇧1-4` or the top bar for 9:16 · 3:4 · 1:1 · 16:9.
- **Timeline** (bottom): scenes above, shots below, thumbnails, playhead.
  - click a block → its effects open on the right
  - drag its **right edge** → duration (everything after ripples)
  - drag its **left edge** → move the cut with the previous shot (film length unchanged)
  - drag a **scene's edge** → stretch the whole scene, shots keep their proportions
  - ruler / empty lane → scrub · ⌘-wheel → zoom · "Adatta a [45] s" rescales the cut to exactly the target (editable)
- **Effects panel** (right): every block's effects as sections. Type blocks have
  *Testo* (copy, face, size, letter spacing, leading, alignment, width of the text field, position,
  colours violet → ink, motion blur),
  *Reveal* and *Unreveal*, each with its own split (chars / words / lines), stagger order
  (start, end, centre, edges, random), start, stagger, duration, ease, X / Y offset (% of the
  letter, GSAP signs), X turn + depth (0.5 = a cube), scale, blur, opacity, mask.
  Carousels: the videos (tick any video of the campaign's folder; they arrive in that order),
  the campaign's name, shape (wheel / 3D ring, radius, lean, spacing), motion (arrival, which card
  it settles on, steps with a pause on each video, exit).
  Notifications: how many, first interval, acceleration, minimum interval, push, the number rising,
  the fall into blur.
- **Eases**: GSAP CustomEase. The film's own curves (`ci.reveal`, `ci.soft`, `ci.emph`,
  `ci.glide`, `ci.swift`, `ci.exit`, `ci.accel`), every GSAP ease, or click the curve to drag
  the two handles of a cubic-bezier.
- **Format** (top): 9:16 · 3:4 · 1:1 · 16:9. Layouts are computed from the frame (type on its
  short side), so nothing is cropped when the format changes.
- **Export MP4**: frame-exact (WebCodecs H.264 + Mediabunny), 30 / 60 fps, optional 2×
  supersampling. File name carries the format and the intro. With the dev server running, a copy
  lands in `exports/`.
- **Project menu**: copy / paste the whole cut as JSON, restore the original, the V2 storyboard.
  (Edits autosave in this browser under a V4 key: V3 edits are not carried over.)

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
  lib/kinetic.js     kinetic type (SplitText-like: chars / words / lines, masks, cube turns, balanced lines)
  lib/counter.js     the counters (reels through a mask, tabular digits)
  actors/            V4: lockup · texts · grid (campaigns) · numbers · carousel
  machina/           V5: model.js (the cut) · plan.js (the line, stations, pen + camera tracks) ·
                     actor.js (draws the take) · lockup.js (the logo on the paper) · art.js (comments)
                     timing under the veil) · cloth.js (XPBD cloth) · perform.js (one act: hands, tethers,
                     checkpoints) · sim.worker.js (acts simulated ahead) · silk.js (the veil drawn: sheer
                     layers, shadows) · actor.js (the table and the veil)
  lib/               type as geometry (opentype.js), brand artwork, shaders, canvas artwork
  ui/                top bar, stage, timeline, effects panel (+ bezier editor, video picker)
tools/               (they default to 16:9)
  media.sh           video proxies from ~/Desktop/INTIMISSIMI VIDEO
  shot.mjs           frames / contact sheets (headless Chrome)  node tools/shot.mjs --intro B --n 24 --sheet
  snaps.mjs          renders every frame and flags frame-to-frame jumps (6.03 s and 37.73 s are cuts inside two creator videos)
  interact.mjs       drives the editor like a user (resize, edit, intro keys, undo, playback fps, target length)
  export.mjs         export from the command line   node tools/export.mjs --aspect 16:9 --intro A --ssaa 2
  interact-machina.mjs  the same user test on V5
```

Every tool takes the V5 page with `CI_PAGE=machina.html`, e.g.
`CI_PAGE=machina.html node tools/shot.mjs --n 36 --sheet` · `CI_PAGE=machina.html node tools/export.mjs --aspect 9:16 --intro B --ssaa 2`.


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

- **Type**: V4 is Instrument Serif + Instrument Sans (OFL, free to publish). V5 is PP Neue Machina:
  the files in `public/fonts/` are the "Free for Personal Use" cut, so publishing V5 needs the
  Pangram Pangram commercial licence (Cooltura's own, if they hold one for their brand).
- **Video colour**: the videos are drawn with exactly their pixels (no dim, blur, grain). Video
  textures reach custom shaders sRGB-encoded, so `tileMaterial` decodes them. HDR (HLG) and
  Display P3 sources go through macOS (`avconvert`) before the proxies; every proxy is BT.709,
  limited range, tagged.
- **Intimissimi logo**: the official SVG from intimissimi.com (`public/logos/`), drawn without its frame
  (the frame is the SVG's largest path; only the letters are used).
- Comments are verbatim from the "comments grid", typos included.
- The storyboard (Progetto → Storyboard V2) still draws the V2 film.
