# Cooltura × Intimissimi · Recap studio

A campaign-recap film of about 30 s built as a tool: one WebGL canvas (three.js), GSAP
easing (CustomEase), a deterministic clock, and an editor around it with a
Premiere / CapCut-style timeline and an effects panel. 16:9 is the master format
(9:16, 3:4, 1:1 follow from the same cut).

```bash
npm install
npm run dev        # http://localhost:5410
npm run media      # rebuild the video proxies from ~/Desktop/INTIMISSIMI VIDEO
npm run ship       # build + deploy to Vercel (production)
```

Live (open link, noindex): https://cooltura-intimissimi.vercel.app (V4 at /v4.html, options 1 and 2 at / and /machina.html).

`npm install` needs a Font Awesome Pro package token in your own `~/.npmrc` (the Sharp icon sets are Pro);
never commit it. The media (videos, voices, music) are in the repo under `public/media`; their raw sources
(`media-src`) and the exported films (`exports`) are not.

**Three editions share the studio** (engine, timeline, panel, export): options 1 and 2 below, and **V4 · Brief V2**
(the revision brief, its own section). Options 1 and 2 They open differently and then
run the same second half, block for block ("due idee di intro diverse ma il continuum uguale").
The top bar switches between them:

| Page | Option | Opening | Then |
|---|---|---|---|
| `index.html` · http://localhost:5410/ | **Opzione 1 · logo** (intro A by default) | the two logotypes, the campaigns (one video, the row, the grid), the four numbers as a table | the continuum |
| `machina.html` · http://localhost:5410/machina.html | **Opzione 2 · La nota** (intro B by default) | "Creators. Culture. Impact.", the logotypes, then the asterisk of cooltura* draws one line up to "+XX% · 497K+" and takes it away | the continuum |

Both are set in PP Neue Machina, titles in capitals. The defaults are his tuning of 2026-11-23 (the JSON of
option 1, applied as is, its continuum given to option 2 too; the second JSON of that day added a fifth Aria video
and retimed Aria 4.1 s / Externability 2.9 s), with the phone's pop-ups redone the same day: option 1 lasts
**27.15 s** with intro A (27.70 with B), option 2 **29.45 s** with intro B (28.85 with A). The target stays 30 s ("Adatta a" rescales either cut to it).
Chrome on a Mac is the target (WebCodecs export, system emoji in the comments).

## V4 · La nota (v4.html, 50.52 s, cut on Dreambound)

http://localhost:5410/v4.html (third switch in the top bar). The client's revision brief of 2026-11-23 ("Video case ·
revision brief V2") on the version the client chose: the logos open the film, then V4's ONE… and the words (the
brief's order), then the asterisk and the line of option 2 up to the numbers (it rolls in from the left: no second
logo), then the new numbers and everything after. Its own model and actors (`src/v4/`), the line's actor and plan
reused from `src/machina/` (`plan.js` builds only the line's stations and skips every other block).

- **Music**: "Dreambound" (Ziv Moran, Roie Shpigler; `public/media/v4/music/dreambound.mp3`, his file), 115 BPM. Every
  block is a whole number of its beats (`BEAT = 60/115` in `v4/model.js`). The film starts on the song's bar at 2.174 s,
  so its first drop lands on AT SCALE, as the line shoots in under it (6.26); the third bar of the drop (12.609 →
  14.696) is played twice (its start is the start of the next bar: a seamless splice, under the voice of the creator
  on the 5 campaigns, where the music is ducked), so the line and the numbers have one more bar; its breakdown
  (20.96 → 25.13) is played twice (a false drop: "Let's go beyond numbers", "We paired creators" and the wheel's
  voice sit in the calm; the second drop comes as the wheel leaves); one bar of the second drop (35.565 → 37.652) is
  played twice under the Venice voices (ducked); its last beat lands on the final logos (48.52). Loaded by default
  (`defaultTrack` in `v4/index.js`, with `offset` and `repeat`, a list of bars played twice); "Musica e voci" loads another song (its tempo and beats found by
  `engine/beats.js`, kept in the browser; "Metti il montaggio a tempo col brano" snaps the cut to it), returns to it
  ("Usa Dreambound") or to the original score composed in code (`v4/score.js`, 120 BPM).
- **Voices over the music**: the song is levelled on its full sections (80th percentile of its half-second windows) to
  about −19 dB RMS, so the creators' voices sit at its level; under every voice it goes down 16 dB more (each block's
  own "ducking", `voiceDuck`; the Look's `duck` where a block says nothing), with short ramps (0.22 s down, 0.35 s
  back up after the last word), voices +2 dB. Export: about −14.6 LUFS, peaks −0.5 dBFS.
- **The line never stops** (`look.flow`, V4 only; `machina/plan.js`): the asterisk slows down into each station and
  drifts on (`creep`, the same speed on screen at any zoom), then picks up again: no dead stop, no jolt (each move
  starts and ends at the drift speed). The camera never loses it: while it travels it rides with the asterisk, holding
  it where it will sit on the next station (so it arrives on the station's framing without turning back), on a
  station it frames the station (the asterisk anywhere inside the frame), never outside the frame from when it comes
  in to when it runs off at the end of the line (`camLeft`, `camRight`, `camLead`, `camRide`, `camSmooth` in Look).
  The type on the line is quicker and sharper (it slides out of the line through its mask, no fade: `textTime`,
  `textBlur`, `textFade`); the counters smear and blur less (`cBlur`, `cMotion`).
- **Type**: Montserrat (SIL OFL, `public/fonts/montserrat/`, static cuts 200-700: a weight snaps to the nearest cut),
  titles in capitals; statements in Light with one line "in evidenza" (SemiBold, wine: `accent` on any text block).
- **Dynamic type** (V4's text blocks; `lib/kinetic.js` + `actors/texts.js`, off in the other editions):
  - *Costruzione*: the paragraph builds itself in the centre: each line that arrives pushes the ones before it up, each
    word its line sideways, so what is on screen is always centred (LET'S GO BEYOND NUMBERS. word by word on the
    sixteenths);
  - *Stagger in two levels* (`inLineStep`): a line on each eighth, its words rippling up through their masks;
  - *Righe in evidenza · la loro entrata*: the line in evidence closes its letters in from the centre (tracking-in,
    `accSpread`, never wider than the frame), wine SemiBold;
  - *Respiro* (`drift`): a slow push in while it holds;
  - THE BEST PART? and AMAZING. close their letters in too.
- **The statement** (`scale`, the first station of the line): TO ACTIVATE CREATORS / **FOR CULTURAL IMPACT** on two
  lines, word after word (each word comes into focus: from soft, a little bigger and transparent to sharp); on the drop
  the line shoots in from the left under them and AT SCALE rises out of it beside them, exactly as tall as the two lines
  (`bigK`); the camera opens on the whole sentence, pushes in on AT SCALE, then follows the asterisk to 2 PLATFORMS. In
  9:16 the same match turned: AT SCALE under the two lines, as wide as they are.
- **5 campaigns + the creator who speaks** (`campaigns`, "La creator che parla"): the figure and the names on the left,
  on the right her video in a frame the line draws while she talks (the asterisk goes round her, slowly, for as long
  as her sentence lasts), the first voice of the film; she is the first of the 311: the other 310 rise beside her as
  the camera pulls back, the names of the campaigns go back into the line. In 9:16 the camera shows the figure and the
  names, then goes to her (her voice comes in just before: a J-cut). 311 in tight digits (`figKern`, each digit its
  own width; `figTracking` from −0.3 em), bigger; at the end the whole wall goes down into the line at once
  (`exitMode: drop`, no stagger), the asterisk runs off, the line is reeled out.
- **KPI wave** ("Ola", switch "Ola dei numeri (KPI wave)"): once every counter has landed, each column (figure and
  label) swells 1 → 1.08 → 1 in turn, left to right, the whole run 1.5 s, ease in-out cubic.
- **ONE AMBITION. → ONE PARTNERSHIP.**: ONE AMBITION. stands in the centre; the longer word that turns in pushes ONE to
  the left, so ONE PARTNERSHIP. is centred too ("La spinta": delay, length, ease).
- **Look**: warm ivory paper with a soft window light, plum ink, rose (the line, the type as it arrives), wine for the
  results. Videos are never treated; they are bigger than in the first V4 (the cards 80 % of the frame's height).
- **Sound engine** (`engine/audio.js`): one offline mix (music + voices, never two voices at once), the same in the
  preview (the film follows the audio clock; audio unlocks on the first click or key and a play pressed before the mix
  is ready starts the sound as soon as it is), in the timeline (Audio lane) and in the MP4 (AAC). `M` mutes.
- **Voices**: transcribed locally (Whisper large-v3-turbo on the Mac, nothing sent out; transcripts with word times in
  `media-src/tx`). Every clip of the library carries its own sound: the V4 clips (`tools/media-v4.sh` →
  `public/media/v4/<slug>.mp4` + `.m4a`) and, since 2026-11-24, the creators' videos too (`tools/media-v3-audio.sh` →
  `public/media/v3/{feed,grid}/<slug>.m4a`, same start as the picture). Every voiced block has one folder "Voce ·
  l'audio originale del video" with everything: the switch (Audio originale), the sentence picked from her own words
  (▶ to hear it), In / Out (clip seconds), a second window to cut a pause, "Parte da sola" (the campaigns: as her video
  rises; the wheel: in the middle of her moment in front, kept inside her clip), Volume della voce, the music's ducking
  under it. A warning shows when the sentence ends past its clip or lasts longer than its block gives it (never cut:
  "Allunga il blocco di N battute"). The sentences end where her voice really stops (an energy check after Whisper's
  word end, `tools/clips-v4.py`). A clip with no sentence of its own put where a voice speaks is silent (never the
  window of another creator's sentence on her). The picture of a voiced clip runs on the same line as its sound, and
  glides into its last frame (never loops back, never freezes dead).
- **The video library** (`tools/clips-v4.py` → `public/media/v4/clips.json` + `public/media/thumbs/`): every clip (100:
  the 20 V4 clips and the creators' videos of the four folders, all with their sound, 56 with whole sentences of
  their own) with its creator, campaign, poster, its words (clip seconds) and the sentences it contains (clip seconds,
  ends where the voice really stops; English trend-audio lines and song lyrics left out). The panel picks every video from it (the wheel's
  protagonist with the microphone; the deck's two voices; the community; the framed creator and the 311 mosaic), and a
  voice follows the video that speaks: change the protagonist and her sentence comes with her.

| Scene | Block (beats) | What happens | Voice |
|---|---|---|---|
| 01 Intro | `logo` · 4 | cooltura × intimissimi (the song's build) | |
| | `one` · 4 | ONE AMBITION. → ONE PARTNERSHIP.: ONE stays, the word (wine, SemiBold) turns like a cube on the beat | |
| 02 La nota | `scale` · 7 | TO ACTIVATE CREATORS / **FOR CULTURAL IMPACT** word after word (each comes into focus); on the drop the line shoots in under them and **AT SCALE** rises out of it beside them, as tall as the two lines; the camera opens on the sentence, pushes in on AT SCALE | |
| | `platforms` · 3 | the asterisk (never still from here to the 311) runs on: **2 PLATFORMS**, TikTok, Instagram | |
| | `campaigns` · 6 | **5 CAMPAIGNS** (Aria, Nude Look, Ultralight with Cashmere Italia and USA, Natale & Party Looks), one per eighth, on the left; on the right the creator who speaks, the asterisk drawing her frame while she talks | Alice Muzza: "Per me la parola d'ordine è comodità." |
| | `creators` · 5 | she is the first of the 311: the other 310 rise beside her from the line as the camera pulls back, the names go back into the line: **311 CREATORS** (tight digits); then the whole wall goes down into the line at once, the asterisk runs off, the line is reeled out | none |
| 03 Results | `results` · 3 | THE RESULTS? · on the beat AMAZING. rises from the bottom with the wine (AMAZING is a text field) | |
| | `kpis` · 8 | the KPIs rise from below the frame one per eighth (sharp reels), settle in four columns with fine rules (2×2 in 9:16); once they have landed, the wave (1 → 1.08 → 1, left to right, 1.5 s); they leave upwards, the paper comes back from the bottom. A fifth (comments) is a switch, off: no figure in the material | |
| 04 Beyond numbers | `beyond` · 3 | LET'S GO BEYOND NUMBERS. (the breakdown) | |
| | `v1` · 4 | WE PAIRED CREATORS / **WITH POWERFUL INSIGHT-LED STRATEGIES** / TO DRIVE RECORD SALES., one line after the other (0.35 s apart) with the reveal of the closing | |
| | `wheel` · 10 | the Aria wheel (his ten videos), the protagonist (the microphone in the panel: Aurora) comes forward (bigger) and talks, her sentence in the middle of her moment, the others step back | Aurora Pederzoli: "Il reggiseno giusto può farti tutto l'outfit." |
| | `v2` · 4 | WE CREATED CONTENT / **WITH AND FOR THE COMMUNITY** / IN REAL TIME. (the second drop) | |
| | `community` · 8 | one creator talks; six real comments float in on the beat as frosted-glass bubbles | Corinne Pino: "Io, non scherzo, ci dormo anche con questo reggiseno per quanto è comodo." |
| | `v3` · 4 | WE WENT BEYOND / BRIEF AND PRODUCT / **TO TRANSFORM SOCIAL PERCEPTION.** | |
| | `venice` · 15 | Venice, Nude Look: one card at a time (the next waits outside the frame: never one over another); his two cards: Sara Tibo (silent: her clip has no whole sentence of her own, so the music carries), then Chiara speaks as her card lands; the curtain closes after her sentence, the paper clean | Chiara Chelo: "È stata una serata stupenda per celebrare le donne." (a 1.2 s hesitation cut out) |
| 05 Closing | `best` · 2, `started` · 3 | THE BEST PART? · WE'RE JUST / **GETTING STARTED.** | |
| | `logo-end` · 2 s | cooltura × intimissimi on the song's last beat (48.52 s) | |

The brief's sample lines ("Questo reggiseno mi ha salvato", "Un reggiseno veramente comodo") are not in the material
verbatim: the lines above are the closest real ones. The KPI figures are the ones already on screen in the other
options (sums of the recap slides, to be verified); +XX% is a placeholder, and there is no figure for the comments.

## The logo (both options)

cooltura* and intimissimi **as wide as each other**, intimissimi **with the frame of its official logotype**
(the stroke, kept for coherence with the brand), the **× exactly in the centre of the frame**, drawn with the
same stroke as the frame. The × draws itself, cooltura reveals letter by letter right → left, intimissimi
left → right inside its frame (the frame comes up in opacity); out in opacity only. The frame can be switched
off and intimissimi's width changed in "Composizione" (`lib/brand.js` `lockupMetrics`).

## Option 1 (index.html, 27.15 s with intro A)

| Block | What happens |
|---|---|
| `logo` (intro A) · 2.15 s | the logo above |
| `w-*` + `logo-b` (intro B) | CREATORS. · CULTURE. · IMPACT. in chars from y 50 % in a mask, each pushing the last one up; then the logo |
| `creators` · 2.1 s | the first video grows on white and fills the frame, the camera pulls back and "311" turns in like a cube **centred under the video**, CREATORS under it |
| `campaigns` · 1.4 s | 311 turns away; **the other four videos come in from the right of the frame** as a train that closes up as it brakes, while the first one slides to the left end (nothing overlaps); "5" CAMPAIGNS under the row |
| `vision` + `vision-out` · 1.8 s + 0.85 s | every row grows onto a flat grid, the central line opens like a curtain on ONE SHARED VISION (3.5); the videos leave from the centre out |
| `stats` · 2.05 s | the four numbers as a table (figures right-aligned, captions in capitals on their baseline), counters rolling up, out upwards |
| the continuum · 16.80 s | below |

## Option 2 (machina.html, 29.45 s with intro B)

Cooltura signs with an asterisk, and in typography an asterisk sends you to a footnote: the asterisk of
cooltura* leaves the logo, drops to the footnote rule and draws it, rolling; everything stands on that line and
the camera only follows it. **Only up to the four numbers**: after "+XX% · 497K+" the figures sink back into the
line, the asterisk runs off to the right and the line is reeled out of the frame behind it, while
FROM CONTENT TO COMMUNITIES comes up. From there it is the continuum.

| Station | |
|---|---|
| `w-*` + `logo-b` (intro B) · 2.5 s | CREATORS. · CULTURE. · IMPACT. · the logo; the asterisk hooks out of it onto the line |
| `creators` · 2.85 s | the pen frames the first video, the camera pulls back while 310 more rise from the line; 311 CREATORS |
| `campaigns` · 2.0 s | the five campaigns rise one after another, the "5" counting them |
| `vision` · 1.3 s | they sink back into the line, ONE SHARED VISION. rises out of it |
| `stat-a`, `stat-b` · 1.7 s, 2.3 s | 9.8M+ ORGANIC VIEWS · 60M PAID VIEWS / +XX% VS BENCHMARK · 497K+ INTERACTIONS, then the exit ("Uscita" in stat-b's panel) |
| the continuum · 16.80 s | below |

Every station has "Camera e penna" (camera travel and ease, the pen's time and ease). The V5 stations of the
45 s cut that are not in this cut (chapters, thread, closing logo) are still in the code (`machina/plan.js`).

## The continuum (both options, `model/continuum.js`)

| Block | What happens |
|---|---|
| `communities` · 3.35 s | FROM CONTENT TO COMMUNITIES (2.9) in the upper part of the frame; an **iPhone 17 Pro** rises from the bottom and stops low, only its top in the frame (Dynamic Island; "Il bordo alto si ferma a" −0.8). Then **one camera move that never stops** (redone 2026-11-23, "più fluida"): it starts while the phone is still rising, so the frame keeps flowing up; it goes down into the phone (the title leaves through the top), the zoom coming in as it goes, and arrives on the lock screen as the **first pop-up** lands under the clock; the **second and third** land one under the other while it drifts and pushes in slowly, always on the newest. Each pop-up rises into place from just below (with the flow), the frosted glass forms first, the text comes into focus in it. Then the run: the next comments come sooner and sooner (each interval × 0.7, down to 0.1 s) and the camera **accelerates down** with them; the device dissolves around its screen (the screen to white, the body a little ahead), the stream runs on below and clears to white. The camera's path is a polyline through "the newest pop-up, 10 % under the centre" with every corner rounded along a smoothstep of the speed: no stop, no going back, no rocking (speed blur in the panel, at 0) |
| `insight` · 1.7 s | WE PAIRED CREATORS WITH A POWERFUL INSIGHT-LED STRATEGY (in capitals) **drops in from the top**, line by line, centred, no mask; out word by word from the end, shrinking. The push of its last line ("insight-led strategy" pushed out to the left by "to drive record sales" through a masked window as wide as the paragraph) is still in the panel, switched off |
| `aria` · 4.1 s | the Aria wheel (Corinne Pino, Chiara Chelo, Asia Busciantella, Federica Bimbi, Chiara Chelo Spark) turns in from the right; **three steps** with a pause on each video; "#1 RESULT ON TIKTOK SEARCH FOR THE PRODUCT CATEGORY" under it; out to the left (no campaign name at the top) |
| `brief` · 2.05 s | "We went beyond the brief and the product to transform the collections' social perception" **comes in while the wheel is leaving**, word by word from the right, only in the wheel's wake (never over a video) |
| `externability` · 2.9 s | the Externability videos as a **deck of cards** in the centre: they pop up from the centre, then the top card is swiped right, left, right with a 45° turn (only the gesture, no like / nope), the one under it coming forward at once (0.05 s); the last card **turns away on its vertical axis**, its face to the left, until it is edge-on and gone. EXTERNABILITY at the bottom, centred (Medium) |
| `best`, `started` · 1.05 s, 1.65 s | THE BEST PART? (Medium) in chars from far right with a turn, out to the left · WE'RE JUST GETTING STARTED. word by word from below; **no logos at the end** |

- Titles are in capitals (a "Maiuscolo" switch on every block of type); in his tuning "We paired creators…" is in capitals too,
  "We went beyond the brief…" stays a sentence.
- Type (cap height, % of the frame's short side), PP Neue Machina: titles 5.6 (THE BEST PART? 3.6 Medium, FROM CONTENT TO COMMUNITIES 2.9, ONE SHARED VISION 3.5), sentences 4.1 Regular,
  311 / 5 ≈ 10 % of the frame height (Light+), the table's figures 6.2, captions 1.75-2.3 in capitals tracked 0.14.
  Neue Machina's default zero is slashed (Ø): both options use its plain zero (ss12, "Zero senza barra" in the global look).
- The wallpaper of the phone is Beatrice Scintu's Aria video (calm, no text burnt in), exactly its pixels (only the first video
  of the "Sfondo" list plays; his list has twelve); the three pop-ups
  are "Confermo, lo adoro è comodissimo 😍" (shirandra214, Instagram), "i reggiseni di Intimissimi >>>>>>>" (Matilde Sarti, TikTok)
  and "cel'ho anchioooo😍😍" (Giorgia Radaelli, TikTok), verbatim from the comments grid; the run is the rest of them.
- Panels: the phone (title, the device: size, where it stops, colour silver / cosmic orange / deep blue, wallpaper, clock, date;
  the pop-ups; the camera; the run), the push ("L'ultima riga spinta via": how many words, the rest of the sentence, when, how fast,
  the window), "Entra nella scia del carosello" on any sentence after a wheel, the cards (size, the one under, pop, swipes: how many,
  which side first, rotation, timing; the 3D turn: angle, slide, timing).

### Numbers on screen (sums of what the recap slides give, to be verified)

| On screen | From |
|---|---|
| 9.8M+ organic views | ARIA 9M + NUDE LOOK 840K (GIOIA's organic views are not in the material: hence the +) |
| 60M paid views | 70M total (ARIA 47M + GIOIA 17.9M + NUDE LOOK 5.16M) − 9.8M organic. If GIOIA had organic views, paid is lower |
| +XX% vs benchmark | placeholder: no benchmark in the material |
| 497K+ interactions | from the brief (the slides say 985.6K interactions in total, 419K organic on ARIA: check the perimeter) |

Every value is a text field in the panel; a figure typed there counts up by itself.

## The editor

The UI speaks the Cooltura site's panel language in a dark chrome (2026-11-23 evening: "il canvas bianco ma la UI
scura"): warm near-black panels, recessed trays, raised pills, 0.5 px hairlines; the film stays white on the dark
stage; a single rose accent for focus, the playhead and changed values. `style.css` says it all in one place.
The panel: three headings (Contenuti · Motion · Aspetto e posizione) and every group a folder, closed by default (icon,
name, a one-line summary of its values, a rose dot when changed, its switch), remembered per block type; a search field
("Cerca: corpo, spaziatura, ease…") and "Apri tutto / Chiudi tutto". Parameter specs may carry `cat` to choose their
heading. V4 adds "Musica e voci" (nothing selected, or a click on the timeline's Audio lane: the waveform of the mix,
bars and beats, the voice windows) and an audio pill in the top bar.

- **Opzione 1 / Opzione 2** (top bar): the two pages. **Intro A / B** (top bar, or keys `1` / `2`): the rest of the film is the same.
- **Format**: 16:9 by default (the master); `⇧1-4` or the top bar for 9:16 · 3:4 · 1:1 · 16:9.
- **Timeline** (bottom): scenes above, shots below, thumbnails, playhead.
  - click a block → its contents, animation and look open on the right · double-click → the playhead jumps to it
  - **drag a block** → move it: a shot before another shot, a scene (with its shots) before another scene; a dark
    line shows where it lands. The blocks of the campaigns' choreography (option 1: the four of Campaigns; option 2:
    every station of the line) move and go only with their scene (a lock in the panel, a note if you try)
  - **⌫ / Delete** (or the bin in the panel) → delete the selected block or scene; `⌘Z` brings it back
  - drag its **right edge** → duration (everything after ripples)
  - drag its **left edge** → move the cut with the previous shot (film length unchanged)
  - drag a **scene's edge** → stretch the whole scene, shots keep their proportions
  - ruler / empty lane → scrub · ⌘-wheel → zoom · "Adatta a [30] s" rescales the cut to exactly the target (editable)
- **Panel** (right): the selected block in the order you read it: **Contenuti** (texts, videos, how many), then
  **Motion** (entrances, exits, timing, eases, camera), then **Aspetto e posizione** (type, colours, sizes,
  layout), every group a closed folder; inside each, the parameters stay grouped by their effect, and the scene's own ones close the list.
  Controls as on the Cooltura site: **ruler sliders** (a dot marks the starting value; **double-click** goes back to
  it; the value can be typed), sliding segments, switches, swatches; a small ↺ and a dot on the name show what
  differs from the start. Type blocks have
  *Testo* (copy, capitals, face, size, letter spacing, leading, alignment, width of the text field, position,
  colours violet → ink, motion blur), *Reveal* and *Unreveal*, each with its own split (chars / words / lines),
  stagger order, start, stagger, duration, ease, X / Y offset (% of the letter, GSAP signs), X turn + depth
  (0.5 = a cube), scale, blur, opacity, mask.
- **Eases**: GSAP CustomEase. The film's own curves (`ci.reveal`, `ci.soft`, `ci.emph`, `ci.glide`, `ci.swift`,
  `ci.exit`, `ci.accel`), every GSAP ease, or click the curve to drag the two handles of a cubic-bezier.
- **Export MP4**: frame-exact (WebCodecs H.264 + Mediabunny), 30 / 60 fps, optional 2× supersampling. File names
  start with `cooltura-intimissimi-op1-` / `-op2-` and carry the format and the intro. With the dev server running,
  a copy lands in `exports/`.
- **Project menu**: copy / paste the whole cut as JSON (order and deleted blocks included), put back the deleted
  blocks and the original order keeping every value, restore the original, the V2 storyboard. A saved cut keeps
  its order; `removed` lists what was deleted, so blocks added to the code later still appear.
  Edits autosave in this browser, one key per option (`cooltura-intimissimi.project.v9`, `cooltura-intimissimi.machina.v2`;
  the names are historical, the project inside is version 10 and 4; the 45 s cuts' saves are not carried over). Older
  saves are migrated (`migrate` in `model/project-v4.js` and `machina/model.js`): option 2's version 2 gets the shared
  continuum (its first part keeps its edits); both forget the old pop-up timing of the phone when the pop-ups were redone
  (2026-11-23: `count`, `popAt`, `every`, `popDur`, `popEase`, `camLag`, `camDur`, `diveDur`, `diveEase`), everything else kept.

Keys: `space` play · `← →` frame (`⇧` 1 s) · `↑ ↓` previous / next shot · `1` `2` intro ·
`⇧1-4` format · `S` snap · `F` fit timeline · `+ −` zoom · `L` loop · `⌫` delete · `⌘Z` / `⇧⌘Z` (or `⌘Y`).

## How it is built

```
src/
  model/project.js     picks the option's model (window.__CI_EDITION, set by machina.html)
  model/project-v4.js  option 1: its opening (intro, campaigns, numbers) + the continuum
  model/continuum.js   the continuum, shared: shot types (text, statement, carousel, phone, swipe), scenes, default shots
  model/store.js       edits, undo, autosave (localStorage), ripple / roll / stretch, intro A / B
  engine/engine.js     renderer, clock, renderAt(t): scene → MSAA float target → FX layer → post → canvas
  engine/fxlayer.js    type, logos, cards: real gaussian blur + motion blur (instanced taps), masks
  engine/post.js       speed blur, vignette, grain, dither
  engine/videos.js     video textures: free-running in preview, seeked per frame in export
  engine/exporter.js   MP4 export
  lib/kinetic.js       kinetic type (SplitText-like: chars / words / lines, masks, cube turns, a masked window for the push)
  lib/counter.js       the counters (reels through a mask, tabular digits)
  lib/brand.js         the logos, and the lockup's measures (equal widths, the frame, the × in the centre)
  actors/              option 1's opening: lockup · grid (campaigns) · numbers (the table)
                       the continuum: phone (iPhone 17 Pro, the pop-ups, the run) · texts (sentences, the push,
                       the wake) · carousel (the Aria wheel) · swipe (the Externability cards)
  machina/             option 2's opening: model.js (the cut) · plan.js (the line, stations, pen + camera tracks, the exit) ·
                       actor.js (draws the take; hands over to the continuum when the line has left) · lockup.js
  lib/                 type as geometry (opentype.js), brand artwork, shaders, canvas artwork (notifications, lock screen)
  ui/                  top bar, stage, timeline, effects panel (+ bezier editor, video picker)
tools/                 (they default to 16:9 and to option 1; CI_PAGE=machina.html for option 2)
  media.sh             video proxies from ~/Desktop/INTIMISSIMI VIDEO
  shot.mjs             frames / contact sheets (headless Chrome)  node tools/shot.mjs --intro B --n 24 --sheet
  snaps.mjs            renders every frame and flags frame-to-frame jumps
  interact.mjs         drives the editor like a user (resize, edit, intro keys, undo, playback fps, target length)
  interact-machina.mjs the same on option 2
  export.mjs           export from the command line   node tools/export.mjs --aspect 16:9 --intro A --ssaa 2
  media-v4.sh          V4's clips cut WITH their sound (video + .m4a, same start) into public/media/v4
  media-v3-audio.sh    the sound of the creators' videos (public/media/v3/{grid,feed}/<slug>.m4a + hero.m4a, the same
                       start as media.sh's pictures; two low-fps sources get their sound 0.05 s later: LEAD)
  clips-v4.py          V4's video library: clips.json (who, campaign, voice, the sentences of each voiced clip from
                       media-src/tx), a poster per clip (public/media/thumbs), the cuts inside the v4 clips
  score.mjs            V4's score rendered headless to a WAV + loudness / spectrogram (score-lab.html)
```

e.g. `CI_PAGE=machina.html node tools/shot.mjs --intro B --n 36 --sheet` · `CI_PAGE=v4.html node tools/export.mjs --aspect 9:16 --ssaa 2` (V4 exports carry the sound) · `CI_PAGE=machina.html node tools/export.mjs --aspect 9:16 --intro B --ssaa 2`.
`tools/snaps.mjs` flags 6.57 s and 6.83 s in option 1: cuts inside three creator videos of the row (source content), not the animation.

Everything on screen is a pure function of time (`value = lerp(a, b, ease(progress))`), so
scrubbing, the thumbnails and the export always agree. A shot only has a duration; its start
is the sum of what comes before, and each actor reads the resolved times, so resizing a block
retimes the animation inside it.

To add a parameter: add its spec to the shot / scene type in its model and read
`shot.p.<key>` in the actor. It appears in the panel on its own.

## Media

`npm run media` re-creates `public/media/v3` (≈ 250 MB, from ≈ 5 GB of sources):

- `grid/` 432 × 768 proxies of the 52 videos (duplicates in the folder made once)
- `feed/` 576 × 1024 for the carousels, the cards and the phone (all of ARIA and Esternabilità)
- `hero.mp4` 1080 × 1920, Alice Muzza (ARIA), the first video

## Notes

- **Type**: PP Neue Machina in both options. The files in `public/fonts/` are the "Free for Personal Use" cut, so
  publishing needs the Pangram Pangram commercial licence (Cooltura's own, if they hold one for their brand).
  Instrument Serif / Sans (OFL) are still loaded and selectable by id.
- **Video colour**: the videos are drawn with exactly their pixels (no dim, blur, grain). Video
  textures reach custom shaders sRGB-encoded, so `tileMaterial` decodes them. HDR (HLG) and
  Display P3 sources go through macOS (`avconvert`) before the proxies; every proxy is BT.709,
  limited range, tagged.
- **Intimissimi logo**: the official SVG from intimissimi.com (`public/logos/`); its frame is the SVG's largest path.
- Comments are verbatim from the "comments grid", typos included.
- Sources of every version: `archive/v1` … `archive/v4`, and `archive/v5` = the 45 s V4 "Instrument" + V5 "La nota" as they were
  before this 30 s recut. V6 "Il velo" was deleted on request.
- The storyboard (Progetto → Storyboard V2) still draws the V2 film.
