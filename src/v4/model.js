// V4 · the revision brief (Brief V2) on the version the client chose (2026-11-23):
// the asterisk and the line ("La nota", option 2) carry the opening up to the
// numbers; the intro, the numbers and everything after are V4's.
//
//   01 Intro           the logos · ONE AMBITION. → ONE PARTNERSHIP. (the word turns like a
//                      cube and pushes ONE to the left: always centred)
//   02 La nota         TO ACTIVATE CREATORS / FOR CULTURAL IMPACT word after word, then on the
//                      drop the line shoots in under them and AT SCALE rises out of it beside
//                      them (as tall as the two lines); the asterisk never stops from there:
//                      2 PLATFORMS → 5 CAMPAIGNS with the creator who speaks on the right (the
//                      asterisk draws her frame while she talks) → she is the first of 311
//                      CREATORS, the camera pulls back; the wall goes down into the line at
//                      once, the asterisk runs off and the line is reeled out
//   03 The results     THE RESULTS? · AMAZING. (the wine rises from the bottom) · the KPIs
//                      rise from the bottom on the beat into columns, the wave, they leave
//   04 Beyond numbers  LET'S GO BEYOND NUMBERS. and the three values (statement in short
//                      lines, then the creators: the Aria wheel, the community, Venice)
//   05 Closing         THE BEST PART? · WE'RE JUST GETTING STARTED. · the logos on the last beat
//
// Montserrat (SIL OFL), titles in capitals; ivory paper, plum ink, rose, wine. Times sit
// on the beats of the song (Dreambound, 115 BPM: BEAT). Every parameter of a block is in
// the panel; `cat` says where it goes (Contenuti · Motion · Aspetto e posizione). Every
// video comes from the library (media/v4/clips.json) and a voice follows the video that
// speaks (the panel's "Frase").

import { SPLITS, ORDERS, num, bool, color, select, text, ez, typeFx } from '../model/continuum.js'
import { SHOT_TYPES as OP1 } from '../model/project-v4.js'
import { SHOT_TYPES as LINE } from '../machina/model.js'

export { SPLITS, ORDERS }

export const FACES = [
  ['200', 'Montserrat ExtraLight'],
  ['300', 'Montserrat Light'],
  ['400', 'Montserrat Regular'],
  ['500', 'Montserrat Medium'],
  ['600', 'Montserrat SemiBold'],
  ['700', 'Montserrat Bold'],
]
const face = (k, label, d) => select(k, label, d, FACES)
const C = (cat) => (spec) => ({ ...spec, cat })
const content = C('content')
const motion = C('motion')
const look = C('look')

export const PALETTE = {
  paper: '#f7f1ec',
  white: '#ffffff',
  ink: '#2a1b21',
  mute: '#8a767c',
  hair: '#e6d9d3',
  blush: '#f1dcd5',
  rose: '#d29b9a',
  nude: '#e6cbbb',
  lilac: '#b8a6e6',
  wine: '#5e2235',
  // the names the shared actors ask for
  violet: '#c98a8f',
  lavender: '#b8a6e6',
  lime: '#d29b9a',
  orange: '#5e2235',
}
export const SWATCHES = ['ink', 'wine', 'rose', 'blush', 'nude', 'lilac', 'mute', 'paper', 'white']

// the beat of the song the cut is made on (Dreambound, 115 BPM): every block is a whole number of beats
export const BEAT = 60 / 115
const B = (n) => Math.round(n * BEAT * 100000) / 100000

// ------------------------------------------------------------------ shared blocks

/**
 * The sentence a clip says, picked from its own words (media/v4/clips.json, the panel's "Frase"): `clip` says
 * which clip speaks ({ list, index }: a 1-based position of a list, or a param holding it; { key }: a single
 * video param), `keys` which params the choice writes.
 */
const phrase = (label, clip, keys) => content({ k: keys.pick, t: 'phrase', label, d: null, clip, keys })

/** One window of a clip's original audio (clip seconds), placed in the block (block seconds); an optional second one cuts a pause out. */
const voiceFx = (d) => ({
  id: 'voice',
  label: 'Voce · l’audio originale del video',
  icon: 'volume',
  on: 'voiceOn',
  params: [
    bool('voiceOn', 'Audio originale del video (la musica si abbassa sotto)', d.on ?? true),
    phrase('La frase (dalle sue parole)', d.clip, { pick: 'voicePick', from: 'voiceFrom', to: 'voiceTo', text: 'voiceText', from2: 'voice2From', to2: 'voice2To', at: 'voiceAt', on: 'voiceOn' }),
    content(text('voiceText', 'Cosa dice', d.text ?? '')),
    ...(d.auto !== undefined ? [content(bool('voiceAuto', 'Parte da sola nel momento giusto (spento: «Parte a»)', d.auto))] : []),
    content(num('voiceAt', 'Parte a (dall’inizio del blocco)', d.at ?? 0, -2, 8, 0.01, 's')),
    content(num('voiceFrom', 'In · dal secondo del video', d.from ?? 0, 0, 12, 0.01, 's')),
    content(num('voiceTo', 'Out · al secondo del video', d.to ?? 2, 0, 12, 0.01, 's')),
    content(num('voice2From', 'Poi (taglia una pausa): In', d.from2 ?? 0, 0, 12, 0.01, 's')),
    content(num('voice2To', 'Poi: Out (uguale = niente)', d.to2 ?? 0, 0, 12, 0.01, 's')),
    content(num('voiceGain', 'Volume della voce', d.gain ?? 0, -24, 12, 0.5, 'dB')),
    content(num('voiceDuck', 'La musica si abbassa di (ducking)', d.duck ?? 16, 0, 30, 0.5, 'dB')),
  ],
})

/**
 * A list of videos from the library (media/v4/clips.json: the clips with their voices + the creators' videos).
 * o.talk: which positions speak (1-based numbers, or the key of the param that holds the position: the wheel's
 * protagonist); o.min: how few it may hold (0 = empty allowed).
 */
const clipList = (k, label, d, o = {}) => content({ k, label, t: 'videos', d, pool: '*', ...o })

/**
 * A text block in Montserrat (the shared kinetic type), with V4's dynamics: the lines in evidence (weight, colour
 * and an entrance of their own: the letters close in, tracking-in), the stagger in two levels (a line on each
 * eighth, its words rippling in), the paragraph that builds itself in the centre (each line that arrives pushes
 * the others up, each word its line sideways) and a slow breath while it holds.
 */
const T = (o = {}) => [
  ...typeFx({ faces: FACES, fromColor: 'rose', color: 'ink', ...o }).map((fx) =>
    fx.id === 'copy'
      ? {
          ...fx,
          params: [
            ...fx.params,
            content(text('accent', 'Righe in evidenza (es. 2, oppure 1,3)', o.accent ?? '')),
            look(face('accentWeight', 'Righe in evidenza: carattere', o.accentWeight ?? '600')),
            look(color('accentColor', 'Righe in evidenza: colore', o.accentColor ?? 'wine')),
          ],
        }
      : fx.id === 'in' || fx.id === 'out'
        ? {
            ...fx,
            params: [
              ...fx.params,
              motion(num(fx.id + 'LineStep', 'Una riga ogni (le parole a onda dentro la riga; 0 = stagger semplice)', 0, 0, 1.5, 0.01, 's')),
              motion(num(fx.id + 'Spread', fx.id === 'in' ? 'Le lettere si stringono (tracking-in, senza maschera)' : 'Le lettere si allargano uscendo (senza maschera)', 0, 0, 2, 0.01)),
            ],
          }
        : fx,
  ),
  {
    id: 'build',
    label: 'Costruzione · resta al centro mentre arriva',
    icon: 'fit',
    params: [
      motion(
        select('build', 'Si ricentra', 'none', [
          ['none', 'No'],
          ['lines', 'Righe'],
          ['words', 'Parole'],
          ['both', 'Entrambe'],
        ]),
      ),
      motion(num('buildDur', 'Durata della spinta', 0.55, 0.05, 2, 0.01, 's')),
      motion(ez('buildEase', 'Ease della spinta', 'cubic(0.55,0,0.15,1)')),
      motion(num('buildDelay', 'La spinta parte dopo l’arrivo di', 0, -0.3, 0.6, 0.01, 's')),
      motion(num('drift', 'Respiro: si avvicina piano (scala in più alla fine del blocco)', 0, 0, 0.2, 0.005)),
    ],
  },
  {
    id: 'accIn',
    label: 'Righe in evidenza · la loro entrata',
    icon: 'sparkles',
    on: 'accOn',
    params: [
      bool('accOn', 'Attiva', false),
      motion(select('accSplit', 'Dividi per', 'chars', SPLITS)),
      motion(select('accOrder', 'Ordine dello stagger', 'center', ORDERS)),
      motion(num('accDelay', 'Dopo il loro turno di', 0, -0.5, 1.5, 0.01, 's')),
      motion(num('accStagger', 'Stagger', 0.014, 0, 0.2, 0.002, 's')),
      motion(num('accDur', 'Durata', 0.8, 0.1, 2, 0.01, 's')),
      motion(ez('accEase', 'Ease', 'cubic(0.2,0.7,0.2,1)')),
      motion(num('accSpread', 'Le lettere si stringono (tracking-in)', 0.6, 0, 2, 0.01)),
      motion(num('accY', 'Da Y (% della lettera, + = sotto)', 30, -300, 300, 1, '%')),
      motion(num('accScale', 'Scala iniziale', 1, 0.5, 2, 0.01)),
      motion(num('accBlur', 'Blur iniziale (%)', 16, 0, 200, 1, '%')),
      motion(bool('accMask', 'Maschera (senza tracking-in)', false)),
    ],
  },
]

// ------------------------------------------------------------------ the line's stations (option 2), with what the brief asks

/** The figure on the line: its spacing and where it stands (the 311, the 5, the 2). */
const figurePlace = {
  id: 'figPlace',
  label: 'Numero e didascalia · spaziatura e posizione (la grandezza: nel numero)',
  icon: 'hashtag',
  params: [
    look(bool('figKern', 'Cifre strette (ognuna con la sua larghezza, come in un titolo)', true)),
    look(num('figTracking', 'Spaziatura tra le cifre (em, − = più vicine)', 0, -0.3, 0.5, 0.005)),
    look(num('figX', 'Sposta in orizzontale (× lato corto)', 0, -0.8, 0.8, 0.005)),
    look(num('figY', 'Sposta in verticale (× lato corto, + = su)', 0, -0.8, 0.8, 0.005)),
    look(num('labelDY', 'Didascalia più in basso di (× il suo corpo)', 0, -3, 8, 0.05)),
  ],
}
const lineExit = {
  id: 'exit',
  label: 'Uscita · i video rientrano nella linea, l’asterisco corre via',
  icon: 'arrow-right',
  on: 'exitOn',
  params: [
    bool('exitOn', 'Attiva', true),
    motion(
      select('exitMode', 'Come esce la griglia', 'drop', [
        ['drop', 'Tutta insieme: scende nella linea come un blocco'],
        ['sink', 'Ogni video rientra al suo posto'],
      ]),
    ),
    motion(num('exitLead', 'Inizio: prima della fine del blocco', 0.85, 0, 3, 0.01, 's')),
    motion(num('sinkDur', 'I video rientrano in', 0.5, 0.1, 2, 0.01, 's')),
    motion(num('sinkSpread', 'Ogni video: da sinistra a destra in (0 = tutti insieme)', 0, 0, 2, 0.01, 's')),
    motion(ez('sinkEase', 'Ease del rientro', 'cubic(0.55,0,0.75,0.3)')),
    motion(num('runAt', 'L’asterisco parte dopo', 0.12, 0, 2, 0.01, 's')),
    motion(num('runDur', 'Corsa dell’asterisco', 0.7, 0.1, 3, 0.01, 's')),
    motion(ez('runEase', 'Ease della corsa', 'cubic(0.5,0,0.75,0.25)')),
    motion(num('reelLag', 'La linea lo segue con un ritardo di', 0.08, 0, 1, 0.01, 's')),
  ],
}
const heroClip = {
  id: 'heroClip',
  label: 'Video · la griglia dei 311',
  icon: 'film',
  params: [
    // V4: the first of the 311 is the creator who spoke on the 5 campaigns (her frame is already drawn there)
    bool('fromCampaigns', 'La prima è la creator che ha parlato sulle 5 campagne', true),
    content({ k: 'heroKey', t: 'video', label: 'Altrimenti: la creator incorniciata qui', d: 'v3/hero.mp4', pool: '*' }),
    content({ k: 'gridVideos', t: 'videos', label: 'I video della griglia (nessuno scelto = tutti)', d: [], pool: 'grid', min: 0 }),
    motion(bool('stackSink', 'Le campagne rientrano nella linea mentre salgono le creator', true)),
    motion(num('stackSinkAt', 'Le campagne rientrano a', 0.0, -1, 3, 0.01, 's')),
  ],
}

/** V4 · on the 5 campaigns: the creator who speaks, on the right; the line draws her frame while she talks. */
const speaker = {
  id: 'speaker',
  label: 'La creator che parla · a destra, la linea le disegna la cornice',
  icon: 'film',
  on: 'heroOn',
  params: [
    bool('heroOn', 'Attiva', false),
    content({ k: 'heroKey', t: 'video', label: 'Video centrale (dalla libreria)', d: 'v4/hero-alice', pool: '*' }),
    look(num('heroH', 'Altezza del video (× frame)', 0.62, 0.3, 0.86, 0.005)),
    look(num('heroGap', 'Distanza dalle campagne (× lato corto)', 0.09, 0, 0.6, 0.005)),
    look(num('corner', 'Raggio angoli (× larghezza)', 0.06, 0, 0.3, 0.005)),
    motion(num('revealDur', 'Il video sale nella cornice in', 0.55, 0.1, 2, 0.01, 's')),
    motion(ez('revealEase', 'Ease', 'cubic(0.3,0.6,0.2,1)')),
    motion(bool('frameFollow', 'L’asterisco le gira intorno mentre parla (segue la voce)', true)),
    motion(num('frameAt', 'Altrimenti: il giro parte a', 0.8, 0, 6, 0.01, 's')),
    motion(num('frameDur', 'Altrimenti: il giro dura', 1.8, 0.2, 6, 0.01, 's')),
    motion(ez('frameEase', 'Ease del giro', 'cubic(0.42,0,0.4,1)')),
    motion(num('toHerAt', 'Formato verticale: dopo i nomi la camera va da lei a', 1.0, 0.3, 3, 0.01, 's')),
  ],
}

/**
 * V4 · the statement on the line: two lines word after word (each comes into focus), then on the drop the line
 * shoots in under them and AT SCALE rises out of it beside them, as tall as the two lines together.
 */
const statementFx = {
  id: 'pre',
  label: 'Le due righe, poi AT SCALE al loro posto',
  icon: 'text',
  params: [
    content(text('pre', 'Le righe prima (una per riga; vuoto = solo la frase grande)', 'To activate creators\nfor cultural impact')),
    content(text('preAccent', 'Riga in evidenza (es. 2)', '2')),
    motion(
      select('statStyle', 'Animazione', 'line', [
        ['line', 'La linea le trasforma: ogni parola esce mentre passa, AT SCALE sale dietro'],
        ['focus', 'Fuoco: le righe si sfocano, AT SCALE si mette a fuoco'],
        ['up', 'Spinta: le righe salgono via, AT SCALE sale dalla linea'],
        ['zoom', 'Zoom: le righe vengono verso di noi, AT SCALE arriva dal fondo'],
        ['mask', 'Maschera netta: senza blur né dissolvenza'],
      ]),
    ),
    motion(num('statMove', 'Quantità di movimento (× quella dello stile)', 1, 0, 2.5, 0.05)),
    motion(num('statBlur', 'Quantità di blur (× quella dello stile)', 1, 0, 2.5, 0.05)),
    motion(num('preAt', 'Le parole: inizio', 0.04, -0.5, 2, 0.01, 's')),
    motion(num('preStagger', 'Una parola ogni', 0.07, 0, 0.4, 0.005, 's')),
    motion(num('preLineStep', 'La seconda riga dopo', 0.22, 0, 1.5, 0.01, 's')),
    motion(num('preDur', 'Ogni parola arriva in', 0.5, 0.1, 2, 0.01, 's')),
    motion(ez('preEase', 'Ease dell’arrivo', 'cubic(0.16,0.8,0.25,1)')),
    motion(num('swapAt', 'AT SCALE prende il loro posto a (dall’inizio del blocco)', 1.15, 0.3, 4, 0.01, 's')),
    motion(num('outDur', 'Le righe escono in', 0.26, 0.1, 1.5, 0.01, 's')),
    motion(num('outStagger', 'Uscita: una parola ogni', 0.02, 0, 0.3, 0.005, 's')),
    motion(ez('outEase', 'Ease dell’uscita', 'cubic(0.55,0,0.75,0.3)')),
    motion(num('bigLag', 'AT SCALE parte dopo l’uscita di (– = prima)', 0.14, -0.5, 1, 0.01, 's')),
    motion(num('bigStagger', 'AT SCALE: una lettera ogni', 0.028, 0, 0.2, 0.002, 's')),
    motion(num('lineLag', 'La linea passa sotto le righe: rispetto al cambio', 0, -1, 1, 0.01, 's')),
    motion(num('bigOutAt', 'AT SCALE esce a (dall’inizio del blocco)', 2.2, 0.6, 6, 0.01, 's')),
    motion(num('bigOutDur', 'AT SCALE esce in', 0.3, 0.1, 1.5, 0.01, 's')),
    motion(num('bigOutStagger', 'Uscita di AT SCALE: una lettera ogni', 0.014, 0, 0.2, 0.002, 's')),
    motion(ez('bigOutEase', 'Ease dell’uscita di AT SCALE', 'cubic(0.55,0,0.8,0.3)')),
    motion(num('lineRun', 'Poi la linea corre avanti di (× lato corto)', 0.45, 0, 1.5, 0.01)),
    motion(num('camFrom', 'Camera: parte più larga di (× e si avvicina piano)', 1.08, 0.8, 1.6, 0.01)),
    look(face('preWeight', 'Carattere', '300')),
    look(face('preAccentWeight', 'Riga in evidenza: carattere', '600')),
    look(color('preColor', 'Colore', 'ink')),
    look(color('preAccentColor', 'Riga in evidenza: colore', 'wine')),
    look(color('preFrom', 'Colore mentre arrivano', 'rose')),
    look(num('preSize', 'Corpo (% del lato corto)', 3.6, 1, 12, 0.05, '%')),
    look(num('preLeading', 'Interlinea (em)', 1.18, 0.9, 2, 0.01)),
    look(num('preTracking', 'Spaziatura (em)', 0, -0.1, 0.4, 0.005)),
    look(num('bigK', 'AT SCALE: alta quanto le due righe (× quell’altezza)', 1, 0.5, 2, 0.01)),
  ],
}

/** V4 · then the camera pushes in on AT SCALE (it grows), before it follows the asterisk to the first value. */
const pushIn = {
  id: 'push',
  label: 'La camera si avvicina · AT SCALE cresce',
  icon: 'expand',
  on: 'pushOn',
  params: [
    bool('pushOn', 'Attiva', true),
    motion(num('pushFrom', 'Senza le due righe: parte da (× la loro grandezza)', 0.92, 0.4, 2, 0.01)),
    motion(num('pushTo', 'Arriva a (×)', 1.12, 0.4, 3, 0.01)),
    motion(num('pushAt', 'Inizio (dal cambio)', 0, -1, 3, 0.01, 's')),
    motion(num('pushDur', 'Durata', 2.4, 0.1, 5, 0.01, 's')),
    motion(ez('pushEase', 'Ease', 'cubic(0.3,0,0.3,1)')),
    motion(num('riseSpread', 'Le lettere si stringono salendo (tracking-in)', 0.3, 0, 2, 0.01)),
  ],
}

// ------------------------------------------------------------------ shot types

export const SHOT_TYPES = {
  lockup: { label: 'cooltura × intimissimi · l’asterisco parte', effects: LINE.lockup.effects },
  // V4 · AT SCALE: the first station, the line arrives under it on the drop
  title: { label: 'Sulla linea · To activate creators… AT SCALE', effects: [statementFx, ...LINE.title.effects, pushIn] },
  campaigns: {
    label: 'Sulla linea · il numero che conta (+ la creator che parla)',
    effects: [...LINE.campaigns.effects, figurePlace, speaker, voiceFx({ on: false, auto: true, at: 0.92, from: 1.3, to: 3.4, text: 'Per me la parola d’ordine è comodità.', clip: { key: 'heroKey' } })],
  },
  // the voice over the grid is off (2026-11-23: "l'audio sulla griglia non ha senso"): she speaks on the campaigns now
  creators: { label: 'Sulla linea · 311 creators', effects: [heroClip, voiceFx({ on: false, at: 1.0, from: 1.3, to: 3.4, text: 'Per me la parola d’ordine è comodità.', clip: { key: 'heroKey' } }), ...LINE.creators.effects, figurePlace, lineExit] },
  hudlogo: { label: 'cooltura × intimissimi', effects: OP1.lockup.effects },
  text: { label: 'Testo', effects: T() },
  flip: {
    label: 'ONE + la parola che gira (cubo)',
    effects: [
      {
        id: 'copy',
        label: 'Testo',
        icon: 'text',
        params: [
          content(text('fixed', 'Parola fissa', 'One')),
          content(text('words', 'Parole che girano (una per riga)', 'Ambition.\nPartnership.')),
          bool('caps', 'Maiuscolo', true),
          face('weight', 'Carattere della parola fissa', '300'),
          face('weight2', 'Carattere delle parole che girano', '600'),
          num('size', 'Corpo (altezza maiuscole, % del lato corto)', 7, 2, 20, 0.1, '%'),
          num('tracking', 'Spaziatura lettere (em)', 0.04, -0.1, 0.4, 0.005),
          select('layout', 'Composizione', 'auto', [
            ['auto', 'Auto: in riga nel largo, in colonna nello stretto'],
            ['row', 'In riga'],
            ['stack', 'In colonna'],
          ]),
          look(num('posX', 'Posizione X (× metà frame)', 0, -1, 1, 0.005)),
          look(num('posY', 'Posizione Y (× metà frame, + = su)', 0, -1, 1, 0.005)),
          color('fromColor', 'Colore di partenza', 'rose'),
          color('color', 'Colore', 'ink'),
          color('color2', 'Colore delle parole che girano', 'wine'),
        ],
      },
      {
        id: 'in',
        label: 'Entrata',
        icon: 'arrow-up',
        params: [
          num('inAt', 'Inizio', 0, -1, 3, 0.01, 's'),
          num('inStagger', 'Stagger', 0.03, 0, 0.3, 0.002, 's'),
          num('inDur', 'Durata', 0.7, 0.1, 2, 0.01, 's'),
          ez('inEase', 'Ease', 'ci.reveal'),
          num('inY', 'Da Y (% della lettera, + = sotto)', 100, -300, 300, 1, '%'),
          num('inBlur', 'Blur', 24, 0, 200, 1, '%'),
        ],
      },
      {
        id: 'turn',
        label: 'Il cubo · la parola gira, ONE resta',
        icon: 'cube',
        params: [
          num('flipAt', 'Gira a (dall’inizio del blocco)', 1.04, 0, 4, 0.01, 's'),
          num('flipEvery', 'Una ogni (con più di due parole)', 0.5, 0.1, 2, 0.01, 's'),
          num('flipDur', 'Durata del giro', 0.6, 0.1, 2, 0.01, 's'),
          ez('flipEase', 'Ease', 'cubic(0.6,0,0.2,1)'),
          num('flipStagger', 'Stagger lettere', 0.016, 0, 0.2, 0.002, 's'),
          num('depth', 'Profondità del cubo (0.5 = cubo)', 0.5, 0, 1.5, 0.01),
          select('dir', 'Gira', 'up', [
            ['up', 'Verso l’alto'],
            ['down', 'Verso il basso'],
          ]),
        ],
      },
      {
        id: 'push',
        label: 'La spinta · la parola nuova spinge ONE a sinistra, tutto resta al centro',
        icon: 'arrow-left',
        params: [
          motion(num('glide', 'Quanto si ricentra (1 = sempre al centro, 0 = ONE fermo)', 1, 0, 1, 0.01)),
          motion(num('pushDelay', 'La spinta parte dopo il giro di', 0.06, -0.3, 0.6, 0.01, 's')),
          motion(num('pushDur', 'Durata della spinta', 0.62, 0.1, 2, 0.01, 's')),
          motion(ez('pushEase', 'Ease della spinta', 'cubic(0.55,0,0.15,1)')),
        ],
      },
      {
        id: 'out',
        label: 'Uscita',
        icon: 'arrow-up',
        params: [
          num('outLead', 'Prima della fine del blocco', 0.4, 0, 2, 0.01, 's'),
          num('outStagger', 'Stagger', 0.012, 0, 0.2, 0.002, 's'),
          num('outDur', 'Durata', 0.42, 0.05, 2, 0.01, 's'),
          ez('outEase', 'Ease', 'ci.exit'),
          num('outY', 'Verso Y (%, − = alto)', -80, -300, 300, 1, '%'),
          num('outBlur', 'Blur', 30, 0, 200, 1, '%'),
        ],
      },
    ],
  },
  results: {
    label: 'The results? Amazing.',
    effects: [
      {
        id: 'copy',
        label: 'Testo',
        icon: 'text',
        params: [
          content(text('q', 'Domanda', 'The results?')),
          content(text('a', 'Risposta (segnaposto, si cambia qui)', 'Amazing.')),
          bool('caps', 'Maiuscolo', true),
        ],
      },
      {
        id: 'qType',
        label: 'Domanda · tipografia',
        icon: 'text',
        params: [
          look(face('qWeight', 'Carattere', '300')),
          look(num('qSize', 'Corpo (% del lato corto)', 4.2, 1, 20, 0.1, '%')),
          look(num('qTracking', 'Spaziatura lettere (em)', 0.2, -0.05, 0.6, 0.005)),
          look(color('qColor', 'Colore', 'ink')),
        ],
      },
      {
        id: 'aType',
        label: 'Risposta · tipografia',
        icon: 'text',
        params: [
          look(face('aWeight', 'Carattere', '600')),
          look(num('aSize', 'Corpo (% del lato corto)', 14, 2, 40, 0.1, '%')),
          look(num('aTracking', 'Spaziatura lettere (em)', -0.01, -0.1, 0.4, 0.005)),
          look(num('posY', 'Posizione Y del blocco (× metà frame, + = su)', 0, -0.8, 0.8, 0.005)),
        ],
      },
      {
        id: 'timing',
        label: 'Tempi · dal basso, a tempo',
        icon: 'stopwatch',
        params: [
          motion(num('qAt', 'La domanda a', 0.0, -1, 2, 0.01, 's')),
          motion(num('aAt', 'La risposta (sul battere) a', 0.52, 0, 3, 0.01, 's')),
          motion(num('aDur', 'La risposta sale in', 0.75, 0.1, 2, 0.01, 's')),
          motion(ez('aEase', 'Ease', 'ci.reveal')),
          motion(num('aRise', 'Sale da sotto di (× frame)', 0.42, 0, 1.2, 0.01)),
          motion(num('aSpread', 'Le lettere si stringono salendo (tracking-in)', 0.35, 0, 2, 0.01)),
          motion(num('outLead', 'Uscita verso l’alto (spinta dai numeri): prima della fine', 0.15, -1, 2, 0.01, 's')),
        ],
      },
      {
        id: 'flood',
        label: 'Il vino sale dal basso',
        icon: 'droplet',
        on: 'floodOn',
        params: [
          bool('floodOn', 'Attivo', true),
          look(color('floodColor', 'Colore', 'wine')),
          look(color('onColor', 'Colore del testo sul colore', 'paper')),
          motion(num('floodAt', 'Inizio (con la risposta)', 0.45, -1, 3, 0.01, 's')),
          motion(num('floodDur', 'Durata della salita', 0.7, 0.1, 2, 0.01, 's')),
        ],
      },
    ],
  },
  kpis: {
    label: 'I numeri · dal basso, in colonne',
    effects: [
      {
        id: 'data',
        label: 'Numeri (dai report: da verificare)',
        icon: 'hashtag',
        params: [
          content(text('v1', 'Valore 1', '9.8M+')),
          content(text('l1', 'Etichetta 1', 'Organic views')),
          content(text('v2', 'Valore 2', '60M')),
          content(text('l2', 'Etichetta 2', 'Paid views')),
          content(text('v3', 'Valore 3', '+XX%')),
          content(text('l3', 'Etichetta 3', 'vs benchmark')),
          content(text('v4', 'Valore 4', '497K+')),
          content(text('l4', 'Etichetta 4', 'Interactions')),
          content(bool('fifthOn', 'Quinto numero (commenti: nessun dato nel materiale)', false)),
          content(text('v5', 'Valore 5', 'XXX')),
          content(text('l5', 'Etichetta 5', 'Comments')),
        ],
      },
      {
        id: 'arrive',
        label: 'Arrivo dal basso · uno per battuta',
        icon: 'arrow-up',
        params: [
          motion(num('kAt', 'Il primo arriva a (sul controtempo)', 0.26, -1, 2, 0.01, 's')),
          motion(num('every', 'Uno ogni (un ottavo = 0,26 s)', 0.26, 0.1, 1.5, 0.01, 's')),
          motion(num('riseDur', 'Salita: durata', 0.8, 0.1, 2, 0.01, 's')),
          motion(ez('riseEase', 'Salita: ease', 'ci.reveal')),
          motion(num('rise', 'Parte da sotto di (× frame)', 0.5, 0, 1.2, 0.01)),
          motion(num('fromScale', 'Scala di partenza', 1.08, 0.5, 2, 0.01)),
          motion(num('cDur', 'Le cifre girano per', 0.75, 0.2, 3, 0.01, 's')),
          motion(ez('cEase', 'Ease delle cifre', 'ci.emph')),
          motion(num('spins', 'Giri del primo rullo', 4, 1, 20, 1)),
          motion(num('cBlur', 'Blur delle cifre mentre girano (%)', 6, 0, 60, 1, '%')),
          motion(num('cMotion', 'Scia dei rulli (motion blur)', 0.45, 0, 1.5, 0.01)),
          motion(num('labelAt', 'L’etichetta dopo il numero di', 0.12, -0.5, 1, 0.01, 's')),
        ],
      },
      {
        id: 'wave',
        label: 'Ola · finito il conteggio, una piccola onda di scala',
        icon: 'wave',
        on: 'waveOn',
        params: [
          bool('waveOn', 'Ola dei numeri (KPI wave): attiva', true),
          motion(num('waveDelay', 'Parte dopo che l’ultimo numero si è fermato di', 0.06, -0.5, 1, 0.01, 's')),
          motion(num('waveTotal', 'Durata di tutta l’onda (tutti i numeri)', 1.5, 0.3, 4, 0.01, 's')),
          motion(num('waveEach', 'Ogni numero: su e giù in', 0.75, 0.1, 2, 0.01, 's')),
          motion(num('waveAmp', 'Quanto cresce (1 → 1 + questo)', 0.08, 0, 0.4, 0.005)),
          motion(ez('waveEase', 'Ease (su e giù)', 'cubic(0.65,0,0.35,1)')),
        ],
      },
      {
        id: 'leave',
        label: 'Uscita · scompaiono verso l’alto',
        icon: 'arrow-up',
        params: [
          motion(num('outLead', 'Inizio: prima della fine', 0.62, 0, 2, 0.01, 's')),
          motion(num('outStagger', 'Una colonna dopo l’altra', 0.06, 0, 0.5, 0.005, 's')),
          motion(num('outDur', 'Durata', 0.42, 0.05, 2, 0.01, 's')),
          motion(ez('outEase', 'Ease', 'ci.exit')),
        ],
      },
      {
        id: 'numType',
        label: 'Numeri · tipografia',
        icon: 'text',
        params: [
          look(face('weight', 'Carattere', '500')),
          look(num('size', 'Corpo (% del lato corto)', 10, 2, 30, 0.1, '%')),
          look(num('tracking', 'Spaziatura tra le cifre (em)', -0.01, -0.15, 0.5, 0.005)),
          look(color('color', 'Colore', 'paper')),
          look(color('fromColor', 'Colore mentre girano', 'blush')),
        ],
      },
      {
        id: 'labType',
        label: 'Etichette · tipografia',
        icon: 'text',
        params: [
          look(face('labelWeight', 'Carattere', '500')),
          look(num('labelSize', 'Corpo (% del lato corto)', 1.75, 0.6, 6, 0.05, '%')),
          look(num('labelTracking', 'Spaziatura lettere (em)', 0.24, -0.05, 0.6, 0.005)),
          look(color('labelColor', 'Colore', 'blush')),
          look(num('labelGap', 'Distanza dal numero (× il numero)', 0.34, 0, 2, 0.01)),
        ],
      },
      {
        id: 'cols',
        label: 'Colonne',
        icon: 'grid',
        params: [
          look(num('width', 'Larghezza totale (× frame)', 0.94, 0.3, 1, 0.005)),
          look(num('posY', 'Posizione Y (× metà frame, + = su)', 0, -0.8, 0.8, 0.005)),
          look(bool('rules', 'Filetti tra le colonne', true)),
          look(color('ruleColor', 'Colore dei filetti', 'rose')),
          look(num('ruleH', 'Altezza dei filetti (× il numero)', 2.2, 0.5, 5, 0.05)),
        ],
      },
    ],
  },
  wheel: {
    label: 'Carosello · una creator viene avanti e parla',
    effects: [
      {
        id: 'videos',
        label: 'Video',
        icon: 'film',
        params: [
          clipList('videos', 'Video (in ordine) · il microfono sceglie chi viene avanti e parla', ['aria-alice-muzza', 'aria-asia-busciantella', 'v4/hero-chiara', 'aria-aurora-pederzoli', 'aria-giulia-romanelli', 'aria-chiara-chelo', 'aria-beatrice-scintu', 'v4/venice-dance', 'v4/venice-aurora', 'v4/hero-alice'], { talk: 'hero' }),
          content(num('hero', 'Video centrale: quella che viene avanti e parla (posizione)', 4, 1, 12, 1)),
        ],
      },
      voiceFx({ auto: true, at: 0.3, from: 4.97, to: 7.49, text: 'Il reggiseno giusto può farti tutto l’outfit.', clip: { list: 'videos', index: 'hero' } }),
      {
        id: 'shape',
        label: 'Forma',
        icon: 'circle',
        params: [
          look(num('cardH', 'Altezza delle card (× frame)', 0.56, 0.15, 0.9, 0.005)),
          look(num('radius', 'Raggio della ruota (× altezza card)', 1.75, 0.8, 8, 0.01)),
          look(num('spacing', 'Spazio tra le card (× larghezza)', 0.16, 0, 1, 0.005)),
          look(num('lean', 'Le card seguono la ruota', 0.85, 0, 1, 0.01)),
          look(num('centerY', 'Altezza (× metà frame)', 0.0, -0.8, 0.8, 0.005)),
          look(num('corner', 'Raggio angoli (× larghezza)', 0.08, 0, 0.3, 0.005)),
        ],
      },
      {
        id: 'motion',
        label: 'Movimento',
        icon: 'rotate',
        params: [
          num('inDur', 'Arriva da destra in', 0.9, 0.2, 3, 0.01, 's'),
          ez('inEase', 'Ease arrivo', 'ci.soft'),
          num('heroAt', 'Viene avanti a', 0.25, 0, 4, 0.01, 's'),
          num('heroDur', 'In', 0.7, 0.1, 2, 0.01, 's'),
          ez('heroEase', 'Ease', 'cubic(0.55,0,0.15,1)'),
          num('heroScale', 'Quanto (× altezza card)', 1.62, 1, 3, 0.01),
          num('heroBack', 'Le altre arretrano (scala)', 0.86, 0.5, 1, 0.01),
          num('backAt', 'Torna nella ruota: prima della fine', 0.45, 0, 3, 0.01, 's'),
          num('outDur', 'Uscita a sinistra', 0.5, 0.1, 3, 0.01, 's'),
          ez('outEase', 'Ease uscita', 'ci.accel'),
        ],
      },
    ],
  },
  community: {
    label: 'Community · la creator parla, i commenti arrivano',
    effects: [
      { id: 'video', label: 'Video', icon: 'film', params: [clipList('videos', 'Video di sfondo (parla)', ['v4/comm-corinne'], { talk: [1] })] },
      voiceFx({ at: 0.15, from: 0.5, to: 4.39, text: 'Io, non scherzo, ci dormo anche con questo reggiseno per quanto è comodo.', clip: { list: 'videos', index: 1 } }),
      {
        id: 'comments',
        label: 'Commenti reali (dal report, testo esatto)',
        icon: 'comment',
        params: [
          content(text('c1', 'Commento 1', 'shirandra214 · Confermo, lo adoro è comodissimo 😍')),
          content(text('c2', 'Commento 2', 'aleale · IO AMO QUESTO REGGISENO LO DEVO COMPRAREEEE')),
          content(text('c3', 'Commento 3', 'faby._.1983 · Vero, comodo quasi come non averlo 👏approvato')),
          content(text('c4', 'Commento 4', 'michyy. · amo è comodissimo io c’è looo😍')),
          content(text('c5', 'Commento 5', 'carmen_balosin · I swear that bra is sooo comfortable!!🙌❤️')),
          content(text('c6', 'Commento 6', 'Gemma Langiu · Lo voglio subitoooooo!!!! Ti sta da Dio ❤️')),
        ],
      },
      {
        id: 'pops',
        label: 'Pop-up · a tempo',
        icon: 'bell',
        params: [
          motion(num('popAt', 'Il primo a', 0.52, 0, 3, 0.01, 's')),
          motion(num('every', 'Uno ogni (un battito = 0,52 s)', 0.52, 0.1, 1.5, 0.01, 's')),
          motion(num('popDur', 'Durata della comparsa', 0.7, 0.1, 2, 0.01, 's')),
          motion(ez('popEase', 'Ease', 'ci.reveal')),
          motion(num('drift', 'Salgono piano (× frame al secondo)', 0.035, 0, 0.3, 0.001)),
          look(num('bubble', 'Larghezza (× lato corto)', 0.36, 0.2, 0.9, 0.005)),
          look(
            select('style', 'Materiale', 'light', [
              ['light', 'Vetro chiaro'],
              ['dark', 'Vetro scuro'],
            ]),
          ),
        ],
      },
      {
        id: 'frame',
        label: 'Il video',
        icon: 'expand',
        params: [
          motion(num('inDur', 'Entra in', 0.55, 0.1, 2, 0.01, 's')),
          motion(ez('inEase', 'Ease', 'expo.out')),
          look(num('cardH', 'Altezza (× frame, nel largo)', 0.94, 0.4, 1, 0.005)),
          look(num('corner', 'Raggio angoli (× larghezza)', 0.06, 0, 0.3, 0.005)),
          motion(num('outLead', 'Uscita: prima della fine', 0.28, 0, 2, 0.01, 's')),
        ],
      },
    ],
  },
  deck: {
    label: 'Card · Venezia, Nude Look',
    effects: [
      { id: 'videos', label: 'Video delle card', icon: 'film', params: [clipList('videos', 'Video (in ordine: le prime due parlano)', ['v4/venice-chiara', 'v4/venice-terrace', 'v4/venice-walk', 'v4/venice-duo'], { talk: [1, 2] })] },
      voiceFx({ at: 0.2, from: 0.5, to: 2.58, from2: 3.77, to2: 5.09, text: 'È stata una serata stupenda per celebrare le donne.', clip: { list: 'videos', index: 1 } }),
      {
        id: 'voiceB',
        label: 'Voce della seconda card',
        icon: 'volume',
        on: 'voiceBOn',
        params: [
          bool('voiceBOn', 'Attiva', true),
          phrase('La frase (dalle sue parole)', { list: 'videos', index: 2 }, { pick: 'voiceBPick', from: 'voiceBFrom', to: 'voiceBTo', text: 'voiceBText', from2: 'voiceB2From', to2: 'voiceB2To', at: 'voiceBAt', on: 'voiceBOn' }),
          content(text('voiceBText', 'Cosa dice', 'Io mi sentivo completamente un’altra persona. Mi sentivo proprio confidente, sexy.')),
          content(num('voiceBLead', 'Parte dopo l’inizio del suo scorrimento (con «Lo stacco segue le voci»)', 0.3, -1, 2, 0.01, 's')),
          content(num('voiceBAt', 'Altrimenti parte a (dall’inizio del blocco)', 3.6, 0, 12, 0.01, 's')),
          content(num('voiceBFrom', 'In · dal secondo del video', 0.26, 0, 12, 0.01, 's')),
          content(num('voiceBTo', 'Out · al secondo del video', 3.66, 0, 12, 0.01, 's')),
          content(num('voiceB2From', 'Poi (taglia una pausa): In', 0, 0, 12, 0.01, 's')),
          content(num('voiceB2To', 'Poi: Out (uguale = niente)', 0, 0, 12, 0.01, 's')),
          content(num('voiceBGain', 'Volume della voce', 0, -24, 12, 0.5, 'dB')),
          content(num('voiceBDuck', 'La musica si abbassa di (ducking)', 16, 0, 30, 0.5, 'dB')),
        ],
      },
      {
        id: 'label',
        label: 'Nome della campagna',
        icon: 'text',
        on: 'labelOn',
        params: [
          bool('labelOn', 'Attivo', true),
          content(text('label', 'Testo', 'Nude Look · Venezia')),
          bool('caps', 'Maiuscolo', true),
          color('labelColor', 'Colore', 'ink'),
          face('labelWeight', 'Carattere', '500'),
          num('labelSize', 'Corpo (% del lato corto)', 1.9, 0.6, 10, 0.05, '%'),
          num('labelTracking', 'Spaziatura (em)', 0.22, -0.05, 0.5, 0.005),
          motion(num('labelAt', 'Inizio', 0.3, -1, 4, 0.01, 's')),
          motion(num('labelOut', 'Uscita: prima della fine', 0.5, 0, 4, 0.01, 's')),
        ],
      },
      {
        id: 'cards',
        label: 'Le card',
        icon: 'layer',
        params: [
          look(num('cardH', 'Altezza (× frame)', 0.8, 0.2, 0.92, 0.005)),
          look(num('corner', 'Raggio angoli (× larghezza)', 0.07, 0, 0.3, 0.005)),
          motion(num('popAt', 'La prima si apre a', 0.0, -1, 2, 0.01, 's')),
          motion(num('popDur', 'Si apre in', 0.55, 0.1, 2, 0.01, 's')),
          motion(ez('popEase', 'Ease', 'ci.reveal')),
        ],
      },
      {
        id: 'feed',
        label: 'Scorrono come un feed (lo stacco sulla fine della frase)',
        icon: 'arrow-left',
        params: [
          motion(num('swipes', 'Quante volte scorre', 1, 0, 6, 1)),
          motion(bool('follow', 'Lo stacco segue le voci (scorre quando lei finisce di parlare)', true)),
          motion(num('swipeGap', 'Scorre dopo la sua ultima parola di', 0.1, -0.5, 1.5, 0.01, 's')),
          motion(num('swipeAt', 'Altrimenti: il primo stacco a', 3.3, 0, 12, 0.01, 's')),
          motion(num('swipeEvery', 'Poi uno ogni (le card senza voce)', 2.09, 0.1, 6, 0.01, 's')),
          motion(num('swipeDur', 'Durata dello scorrimento', 0.5, 0.1, 2, 0.01, 's')),
          motion(ez('swipeEase', 'Ease', 'cubic(0.65,0,0.25,1)')),
          look(num('gap', 'Distanza dal bordo della card che aspetta (× larghezza)', 0.08, 0, 1, 0.005)),
          motion(num('closeLead', 'Si chiude a tenda: prima della fine', 0.55, 0, 2, 0.01, 's')),
          motion(num('closeDur', 'Durata della chiusura', 0.45, 0.1, 2, 0.01, 's')),
        ],
      },
    ],
  },
}

// the line's stations are one choreography (machina/plan.js): they move and go with their scene only
for (const k of ['title', 'campaigns', 'creators']) SHOT_TYPES[k].bound = true

export const SCENE_TYPES = {
  intro: { label: '01 · Intro · Partnership', hue: '#f1dcd5', effects: [] },
  line: { label: '02 · La nota · l’asterisco · Campaigns · Creators', hue: '#d29b9a', effects: [] },
  results: { label: '03 · The results', hue: '#5e2235', effects: [] },
  beyond: { label: '04 · Beyond numbers · tre valori', hue: '#b8a6e6', effects: [] },
  closing: { label: '05 · Closing', hue: '#2a1b21', effects: [] },
}

// ------------------------------------------------------------------ the film

const shot = (id, type, name, dur, params = {}) => ({ id, type, name, dur, params })

/**
 * A statement in short lines that builds itself in the centre: a line on each eighth (its words rippling up
 * through their masks) pushes the ones before it up; the line in evidence closes its letters in (tracking-in,
 * wine, semibold); a slow breath while it holds; it leaves upwards through its masks.
 */
const lines = (txt, o = {}) => ({
  text: txt,
  caps: true,
  weight: '300',
  size: 4.5,
  tracking: 0.05,
  leading: 1.34,
  measure: 1.9,
  align: 'center',
  inSplit: 'words',
  inOrder: 'start',
  inAt: 0,
  inStagger: 0.045,
  inLineStep: 0.26,
  inDur: 0.62,
  inEase: 'ci.reveal',
  inY: 105,
  inBlur: 10,
  inMask: true,
  inSpread: 0,
  outSplit: 'lines',
  outOrder: 'start',
  outAt: -0.4,
  outStagger: 0.05,
  outLineStep: 0,
  outDur: 0.36,
  outEase: 'ci.exit',
  outY: -105,
  outBlur: 10,
  outMask: true,
  outSpread: 0,
  outSweep: false,
  motion: 0.7,
  fromColor: 'rose',
  color: 'ink',
  accentWeight: '600',
  accentColor: 'wine',
  accOn: true,
  accSplit: 'chars',
  accOrder: 'center',
  accDelay: 0,
  accStagger: 0.012,
  accDur: 0.8,
  accEase: 'cubic(0.2,0.7,0.2,1)',
  accSpread: 0.55,
  accY: 30,
  accScale: 1,
  accBlur: 16,
  accMask: false,
  build: 'lines',
  buildDur: 0.5,
  buildEase: 'cubic(0.55,0,0.15,1)',
  buildDelay: 0,
  drift: 0.03,
  ...o,
})

/** The reveal of the closing ("We're just getting started."), reused where the brief asks for it (We paired…). */
const finaleIn = { inSplit: 'words', inOrder: 'start', inStagger: 0.06, inDur: 0.55, inEase: 'ci.reveal', inY: 105, inBlur: 10, inMask: true, inSpread: 0, build: 'lines', buildDur: 0.5, buildEase: 'cubic(0.55,0,0.15,1)', buildDelay: 0 }

// the phrases of the defaults (clip seconds, media/v4/clips.json): where the voice really starts and stops
const VOICE = {
  alice: { from: 1.3, to: 3.4, text: 'Per me la parola d’ordine è comodità.' },
  aurora: { from: 4.97, to: 7.49, text: 'Il reggiseno giusto può farti tutto l’outfit.' },
  chiara: { from: 0.5, to: 2.58, from2: 3.77, to2: 5.09, text: 'È stata una serata stupenda per celebrare le donne.' },
}
const voiceOf = (v, pre = 'voice') => ({ [pre + 'From']: v.from, [pre + 'To']: v.to, [pre + '2From']: v.from2 ?? 0, [pre + '2To']: v.to2 ?? 0, [pre + 'Text']: v.text })

const near = (a, b, e = 0.02) => Number.isFinite(a) && Math.abs(a - b) < e

/**
 * Saves of earlier cuts → version 4 (2026-11-24, his JSON of that morning is the new default cut):
 *   v2 → v3  the type's new dynamics replace the old motion of the text blocks (their copy, sizes and colours
 *            are kept), the Venice block gets its 15 beats, edits that belonged to old default clips go
 *   v3 → v4  "To activate creators / for cultural impact / at scale." becomes three blocks (two phrases, then
 *            AT SCALE on the line); the framed creator moves to the 5 campaigns (she speaks there); the blocks
 *            whose length or motion changed take the new one (his copy and choices stay); We paired… takes the
 *            reveal of the closing; old phrase windows of the defaults take their natural ends
 */
export function migrate(saved) {
  if (!saved) return saved
  if (saved.version === 2) {
    const MOTION = /^(in|out|acc|build)[A-Z]|^(motion|drift)$/
    const oldVenice = Math.round(11 * BEAT * 100000) / 100000
    for (const sc of saved.scenes || [])
      for (const sh of sc.shots || []) {
        const P = (sh.params ||= {})
        if (sh.type === 'text') for (const k of Object.keys(P)) if (MOTION.test(k)) delete P[k]
        if (sh.type === 'deck') {
          if (Math.abs((sh.dur ?? 0) - oldVenice) < 0.02) sh.dur = B(15)
          if (!P.videos) for (const k of ['voiceBAt', 'voiceBFrom', 'voiceBTo', 'voiceBText']) delete P[k]
          for (const k of ['swipeAt', 'swipeDur', 'closeLead', 'closeDur', 'voiceAt']) delete P[k]
        }
        if (sh.type === 'creators') delete P.voiceOn
        if (sh.type === 'flip') delete P.glide
      }
    if (saved.target === 46) saved.target = 48.4
    saved.version = 3
  }
  if (saved.version === 3) {
    const MOTION = /^(in|out|acc|build)[A-Z]|^(motion|drift)$/
    const scenes = saved.scenes || []
    const find = (id) => {
      for (const sc of scenes) {
        const i = (sc.shots || []).findIndex((x) => x.id === id)
        if (i >= 0) return { sc, i, sh: sc.shots[i] }
      }
      return null
    }
    const was = (sh, beats) => sh && Math.abs((sh.dur ?? -1) - B(beats)) < 0.02
    // the three lines of the statement → three blocks
    const act = find('activate')
    if (act) {
      const P = (act.sh.params ||= {})
      const ls = String(P.text ?? '').split('\n').map((x) => x.trim())
      const line = scenes.find((sc) => sc.id === 'line')
      if (ls.length >= 3 && line && !find('scale')) {
        const params = { pre: ls.slice(0, 2).join('\n'), text: ls.slice(2).join(' ') }
        if (P.caps !== undefined) params.caps = P.caps
        if (P.accent !== undefined) params.preAccent = P.accent
        ;(line.shots ||= []).unshift({ id: 'scale', type: 'title', name: 'To activate creators… at scale.', params })
      }
      // the block itself becomes the first station of the line (the intro keeps the logos and ONE)
      act.sc.shots.splice(act.i, 1)
    }
    // the framed creator speaks on the 5 campaigns now
    const cr = find('creators')
    const ca = find('campaigns')
    if (cr) {
      const P = (cr.sh.params ||= {})
      if (ca) {
        const Q = (ca.sh.params ||= {})
        if (P.heroKey && P.heroKey !== 'v3/hero.mp4') Q.heroKey = P.heroKey
        if (P.heroH !== undefined) Q.heroH = P.heroH
        for (const k of ['travel', 'penDur', 'penEase']) delete Q[k]
        if (was(ca.sh, 4)) delete ca.sh.dur
      }
      for (const k of ['heroKey', 'heroH', 'pbAt', 'penDur', 'travel', 'revealDur', 'sinkSpread', 'voiceOn', 'voiceAt', 'voiceFrom', 'voiceTo', 'voiceText']) delete P[k]
      if (was(cr.sh, 8)) delete cr.sh.dur
    }
    const kp = find('kpis')
    if (kp && was(kp.sh, 6)) delete kp.sh.dur
    // We paired…: the reveal of the closing, one line after the other (the brief)
    const v1 = find('v1')
    if (v1) for (const k of Object.keys(v1.sh.params || {})) if (MOTION.test(k) && /^(in|build)/.test(k)) delete v1.sh.params[k]
    // the wheel's sentence was the one of its old protagonist: the new default (hers) applies
    const wh = find('wheel')
    if (wh) for (const k of ['voiceFrom', 'voiceTo', 'voiceText', 'voice2From', 'voice2To', 'voiceAt']) delete (wh.sh.params || {})[k]
    // Venice: Chiara's sentence with its natural end; a first card with no sentence of its own stays silent
    const ve = find('venice')
    if (ve) {
      const P = (ve.sh.params ||= {})
      if (near(P.voiceBFrom, 0.76) && near(P.voiceBTo, 2.62)) for (const k of ['voiceBFrom', 'voiceBTo', 'voiceB2From', 'voiceB2To', 'voiceBText']) delete P[k]
      if (Array.isArray(P.videos) && P.videos[0] === 'v4/open-sara' && P.voiceFrom === undefined) P.voiceOn = false
    }
    saved.version = 4
  }
  if (saved.version === 4) {
    const find = (id) => {
      for (const sc of saved.scenes || []) for (const sh of sc.shots || []) if (sh.id === id) return sh
      return null
    }
    // the statement: AT SCALE takes the place of the two lines now, one move with no pause (2026-11-24 pm):
    // the old timings of the side-by-side version go, the new ones apply
    const sc = find('scale')
    if (sc?.params)
      for (const k of ['lineAt', 'pushAt', 'pushDur', 'pushTo', 'pushEase', 'penDur', 'penEase', 'riseDur', 'riseY', 'riseBlur', 'riseSpread', 'riseEase', 'riseSplit', 'riseDelay', 'preAt', 'preStagger', 'preLineStep', 'preDur', 'preEase', 'preScale', 'preBlur', 'preY', 'camIn', 'openLead', 'openDur', 'openEase', 'preGap'])
        delete sc.params[k]
    // the voices that cut into a word (Corinne's "Io,", Chiara's "È" and "per"): their windows on the pauses now
    const co = find('community')?.params
    if (co && near(co.voiceFrom, 0.72) && near(co.voiceTo, 4.41)) for (const k of ['voiceFrom', 'voiceTo']) delete co[k]
    const ve = find('venice')?.params
    if (ve) for (const pre of ['voice', 'voiceB']) if (near(ve[pre + 'From'], 0.76) && near(ve[pre + '2From'], 3.84)) for (const k of ['From', 'To', '2From', '2To']) delete ve[pre + k]
    saved.version = 5
  }
  if (saved.version === 5) {
    // AT SCALE is read and goes (the camera push lasts until then), the line runs on: those timings are new
    // and its block is two beats shorter (one more for 2 platforms, one for the creator who speaks: same total)
    const was = (sh, beats) => Math.abs((sh.dur ?? -1) - B(beats)) < 0.02
    for (const sc of saved.scenes || [])
      for (const sh of sc.shots || []) {
        if (sh.id === 'scale' && sh.params) for (const k of ['pushDur', 'pushTo', 'pushEase', 'pushAt', 'penDur', 'penEase', 'swapAt']) delete sh.params[k]
        if (sh.id === 'scale' && was(sh, 7)) sh.dur = B(5)
        if (sh.id === 'platforms' && was(sh, 3)) sh.dur = B(4)
        if (sh.id === 'campaigns' && was(sh, 6)) sh.dur = B(7)
      }
    saved.version = 6
  }
  if (saved.version === 6) {
    // narrow frames: the camera goes to the creator a little sooner, her sentence ends before the 311 open
    for (const sc of saved.scenes || []) for (const sh of sc.shots || []) if (sh.id === 'campaigns' && sh.params && near(sh.params.toHerAt, 1.35)) delete sh.params.toHerAt
    saved.version = 7
  }
  return saved
}

export function defaultProject() {
  return {
    version: 7,
    aspect: '16:9',
    intro: 'A',
    fps: 30,
    // his JSON of 2026-11-24 is the base of this cut (his target included)
    target: 46,
    look: { ...LOOK.defaults },
    scenes: [
      {
        id: 'intro',
        type: 'intro',
        params: {},
        shots: [
          shot('logo', 'hudlogo', 'cooltura × intimissimi', B(4), { xAt: 0.04, xDur: 0.55, cAt: 0.1, cStagger: 0.035, cDur: 0.6, iAt: 0.14, iStagger: 0.03, iDur: 0.6, fAt: 0.1, outLead: 0.34, outDur: 0.32 }),
          shot('one', 'flip', 'One ambition · One partnership', B(4), { size: 5.1, tracking: -0.06, posX: 0, words: 'Ambition.\nPartnership.' }),
        ],
      },
      {
        // the line shoots in from the left under AT SCALE on the drop; the asterisk never stops from here to the 311
        id: 'line',
        type: 'line',
        params: {},
        shots: [
          // TO ACTIVATE CREATORS / FOR CULTURAL IMPACT word after word, then on the drop (2.09 s in) the line shoots in under
          // them and AT SCALE rises out of it beside them, as tall as the two lines; the camera opens, then pushes in on it
          shot('scale', 'title', 'To activate creators… at scale.', B(5), { pre: 'To activate creators\nfor cultural impact', preAccent: '2', text: 'at scale.', caps: true, weight: '300', tracking: -0.02, color: 'ink', fromColor: 'rose', statStyle: 'line', statMove: 1, statBlur: 1, preAt: 0.04, preStagger: 0.07, preLineStep: 0.22, preDur: 0.5, swapAt: 1.15, outDur: 0.26, outStagger: 0.02, bigLag: 0.14, bigStagger: 0.028, lineLag: 0, bigOutAt: 2.2, bigOutDur: 0.3, bigOutStagger: 0.014, lineRun: 0.45, camFrom: 1.08, riseSplit: 'chars', riseDelay: 0, riseDur: 0.55, riseEase: 'cubic(0.2,0.75,0.2,1)', riseY: 130, riseBlur: 12, riseSpread: 0.3, motion: 0.8, travel: 1.0, penDur: 0.85, penEase: 'cubic(0.12,0.7,0.2,1)', pushOn: true, pushTo: 1.12, pushAt: 0, pushEase: 'cubic(0.3,0,0.3,1)' }),
          shot('platforms', 'campaigns', '2 platforms', B(4), { n1: 'TikTok', n2: 'Instagram', n3: '', n4: '', n5: '', value: '2', label: 'platforms', travel: 1.0, penDur: 1.0, penEase: 'cubic(0.45,0,0.2,1)', enterAt: 0.0, enterEvery: 0.26, enterDur: 0.48, cBlur: 6 }),
          // the creator speaks beside the 5 campaigns (the first talking video, early), the asterisk goes round her frame
          shot('campaigns', 'campaigns', '5 campaigns · lei parla', B(7), { travel: 0.85, penDur: 0.85, penEase: 'cubic(0.45,0,0.2,1)', enterAt: 0.0, enterEvery: 0.26, enterDur: 0.46, cBlur: 6, heroOn: true, heroKey: 'v4/hero-alice', heroH: 0.66, voiceOn: true, voiceAuto: true, voiceAt: 0.92, ...voiceOf(VOICE.alice) }),
          // she is the first of the 311: the others rise beside her, the camera pulls back; the wall goes down at once
          shot('creators', 'creators', '311 creators', B(5), { travel: 0.9, pbAt: 0.0, pbDur: 1.2, riseDur: 0.32, rowStagger: 0.024, cDur: 1.1, exitLead: 0.8, exitOn: true, exitMode: 'drop', sinkSpread: 0, reelLag: 0.08, size: 12.5, figKern: true, figTracking: -0.02, cBlur: 6 }),
        ],
      },
      {
        id: 'results',
        type: 'results',
        params: {},
        // the numbers: their counters, then the wave (8 beats: the song gets one more bar here, audio.js repeat)
        shots: [shot('results', 'results', 'The results? Amazing.', B(3)), shot('kpis', 'kpis', 'I numeri', B(8))],
      },
      {
        id: 'beyond',
        type: 'beyond',
        params: {},
        shots: [
          // the words arrive on the sixteenths and push the line, so it is always centred
          shot('beyond', 'text', 'Let’s go beyond numbers.', B(3), lines('Let’s go beyond numbers.', { weight: '600', size: 5.2, tracking: 0.01, inLineStep: 0, inStagger: 0.13, inDur: 0.55, inAt: 0.0, fromColor: 'blush', accent: '', accOn: false, build: 'words', buildDur: 0.42, drift: 0.045, outSplit: 'words', outStagger: 0.03, outAt: -0.36, outDur: 0.32 })),
          // the three lines one after the other (0.35 s apart), with the reveal of the closing
          shot('v1', 'text', 'We paired creators…', B(4), lines('We paired creators\nwith powerful insight-led strategies\nto drive record sales.', { accent: '2', ...finaleIn, inLineStep: 0.35 })),
          shot('wheel', 'wheel', 'Strategy · Aria', B(10), { videos: ['aria-alice-muzza', 'aria-asia-busciantella', 'v4/hero-chiara', 'aria-aurora-pederzoli', 'aria-giulia-romanelli', 'aria-chiara-chelo', 'aria-beatrice-scintu', 'v4/venice-dance', 'v4/venice-aurora', 'v4/hero-alice'], hero: 4, voiceAuto: true, voiceAt: 0.3, voiceGain: -1, ...voiceOf(VOICE.aurora), inEase: 'ci.emph', inDur: 1.24 }),
          shot('v2', 'text', 'We created content…', B(4), lines('We created content\nwith and for the community\nin real time.', { accent: '2' })),
          shot('community', 'community', 'Community · Real time', B(8), { videos: ['v4/comm-corinne'] }),
          shot('v3', 'text', 'We went beyond…', B(4), lines('We went beyond\nbrief and product\nto transform social perception.', { accent: '3' })),
          // Sara first (her clip has no sentence of its own: silent, the music carries), then Chiara speaks
          shot('venice', 'deck', 'Nude Look · Venezia', B(15), { videos: ['v4/open-sara', 'v4/venice-chiara'], voiceOn: false, ...voiceOf(VOICE.chiara, 'voiceB') }),
        ],
      },
      {
        id: 'closing',
        type: 'closing',
        params: {},
        shots: [
          // approved as it is (2026-11-24): the question breathes in, its letters close in from the centre
          shot('best', 'text', 'The best part?', B(2), lines('The best part?', { weight: '300', size: 4.2, tracking: 0.16, inSplit: 'chars', inOrder: 'center', inLineStep: 0, inStagger: 0.012, inDur: 0.75, inEase: 'cubic(0.2,0.7,0.2,1)', inY: 0, inBlur: 24, inMask: false, inSpread: 0.9, inAt: -0.1, outSplit: 'chars', outOrder: 'center', outStagger: 0.006, outAt: -0.24, outDur: 0.3, outY: -30, outBlur: 30, outMask: false, outSpread: 0.35, accent: '', accOn: false, build: 'none', drift: 0.06 })),
          shot('started', 'text', 'We’re just getting started.', B(3), lines('We’re just\ngetting started.', { weight: '300', size: 6.4, tracking: 0.01, leading: 1.12, accent: '2', inStagger: 0.06, inDur: 0.55, inAt: -0.04, accSpread: 0.5, outAt: -0.22, outDur: 0.3, outSplit: 'words', outStagger: 0.025 })),
          shot('logo-end', 'hudlogo', 'cooltura × intimissimi', 2.0, { xAt: 0.02, xDur: 0.5, cAt: 0.0, cStagger: 0.03, cDur: 0.55, iAt: 0.04, iStagger: 0.025, iDur: 0.55, fAt: 0.0, outOn: false }),
        ],
      },
    ],
  }
}

export function effectsOf(sh) {
  return SHOT_TYPES[sh.type]?.effects || []
}
export const sceneEffects = (sc) => SCENE_TYPES[sc.type]?.effects || []

const defaultsOf = (effects) => {
  const o = {}
  for (const fx of effects) for (const p of fx.params) o[p.k] = Array.isArray(p.d) ? [...p.d] : p.d
  return o
}

export const MIN_DUR = 0.2
export const INTROS = { A: 'Intro · Partnership' }

/** Same contract as the other editions: absolute times + parameters merged over their defaults. */
export function resolve(project) {
  let t = 0
  const shots = []
  const scenes = []
  const byId = new Map()
  const sceneById = new Map()
  for (const sc of project.scenes) {
    const st = SCENE_TYPES[sc.type] || { label: sc.type, hue: '#999', effects: [] }
    const rs = { id: sc.id, type: sc.type, label: st.label, hue: st.hue, start: t, end: t, p: { ...defaultsOf(sceneEffects(sc)), ...sc.params }, shots: [], src: sc }
    for (const sh of sc.shots) {
      if (!SHOT_TYPES[sh.type]) continue
      const dur = Math.max(MIN_DUR, sh.dur)
      const r = { id: sh.id, type: sh.type, name: sh.name, start: t, end: t + dur, dur, p: { ...defaultsOf(effectsOf(sh)), ...sh.params }, scene: rs, src: sh, index: shots.length }
      t += dur
      rs.shots.push(r)
      shots.push(r)
      byId.set(sh.id, r)
    }
    rs.end = t
    rs.dur = rs.end - rs.start
    scenes.push(rs)
    sceneById.set(sc.id, rs)
  }
  return {
    duration: t,
    intro: 'A',
    scenes,
    shots,
    shot: (id) => byId.get(id),
    scene: (id) => sceneById.get(id),
    at: (time) => shots.find((s) => time >= s.start && time < s.end) || shots[shots.length - 1],
    next: (sh) => shots[sh.index + 1] || null,
    prev: (sh) => shots[sh.index - 1] || null,
  }
}

// ------------------------------------------------------------------ edition

export const EDITION = { id: 'rev', label: 'V4 · La nota', page: './v4.html', font: 'montserrat' }
// a new key: the earlier V4 cuts are not carried over
export const STORE_KEY = 'cooltura-intimissimi.v4brief.v4'
export const LOOK = {
  fx: {
    id: 'look',
    label: 'Look',
    icon: 'sliders',
    params: [
      num('grain', 'Grana', 0.018, 0, 0.12, 0.002),
      num('vignette', 'Vignetta', 0, 0, 0.6, 0.01),
      num('light', 'Luce morbida sulla carta', 0.5, 0, 1, 0.01),
      color('lineColor', 'Colore della linea', 'rose'),
      num('lineWidth', 'Spessore della linea (px a 1080)', 2.4, 0.5, 10, 0.1, 'px'),
      color('penColor', 'Colore dell’asterisco in viaggio', 'violet'),
      num('penSize', 'Asterisco in viaggio (% del lato corto)', 2.5, 0.8, 8, 0.05, '%'),
      num('motionBlur', 'Motion blur della camera sulla linea', 0.2, 0, 1.5, 0.01),
      // the line never stops: it slows down on each station and drifts on, the camera keeps the asterisk in the frame
      bool('flow', 'La linea non si ferma mai (rallenta sulle tappe, poi riparte)', true),
      num('creep', 'La sua velocità più lenta (sulle tappe)', 0.42, 0, 2, 0.01),
      num('camLeft', 'L’asterisco resta nel quadro: non più a sinistra di (frazione del quadro)', 0.16, 0, 0.5, 0.01),
      num('camRight', 'e non più a destra di (frazione)', 0.78, 0.5, 1, 0.01),
      num('camSmooth', 'Morbidezza della camera che lo segue', 0.04, 0.005, 0.5, 0.005, 's'),
      num('camLead', 'In viaggio la camera lo tiene a (frazione del quadro da sinistra)', 0.64, 0.3, 0.85, 0.01),
      num('camRide', 'In viaggio la camera segue l’asterisco (0 = solo le tappe, 1 = sempre con lui)', 1, 0, 1, 0.01),
      num('textTime', 'Testi sulla linea: durata (× quella del blocco)', 0.72, 0.3, 1.5, 0.01),
      num('textBlur', 'Testi sulla linea: blur (×)', 0.2, 0, 1.5, 0.01),
      bool('textFade', 'Testi sulla linea: con dissolvenza', false),
      bool('musicOn', 'Musica', true),
      num('music', 'Musica', 0, -24, 6, 0.5, 'dB'),
      num('duck', 'La musica sotto le voci (−dB, dove il blocco non dice altro)', 16, 0, 30, 0.5, 'dB'),
      num('voices', 'Voci', 2, -12, 12, 0.5, 'dB'),
    ],
  },
  defaults: { lineFromLeft: true, grain: 0.018, vignette: 0, light: 0.5, lineColor: 'rose', lineWidth: 2.4, penColor: 'violet', penSize: 2.5, plainZero: false, motionBlur: 0.2, flow: true, creep: 0.42, camLeft: 0.16, camRight: 0.78, camSmooth: 0.04, camLead: 0.64, camRide: 1, textTime: 0.72, textBlur: 0.2, textFade: false, musicOn: true, music: 0, duck: 16, voices: 2 },
}
