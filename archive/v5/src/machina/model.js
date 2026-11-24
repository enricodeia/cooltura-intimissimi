// V5 · "La nota". The edit of the third direction, set in PP Neue Machina.
//
// Cooltura signs with an asterisk, and in typography an asterisk sends you to a
// footnote. Here the asterisk of cooltura* leaves the logo, drops to the
// footnote rule and draws it, rolling: ONE line, one take, from the first frame
// to the last. Everything is born from that line (the creators rise from it,
// the figures roll up out of it, the words stand on it, the comments hang off
// it) and the camera only follows it: nothing leaves, the camera moves on. At
// the end the asterisk climbs back into the logo and reels its line in.
//
// Story (the original brief's structure): 311 creators → 5 campaigns → one
// shared vision → the numbers → beyond numbers → three chapters "From … to …"
// (insights → sales: Aria and the #1 on TikTok search · viral → iconic:
// Externability · content → communities: the comments) → "The best part?
// We're just getting started." → cooltura* × intimissimi.
//
// Shots are stations on the line. Each one: the camera travels to it
// (`travel`), the pen draws its stretch of line (`penDur`), what stands on the
// line rises when the pen passes under it; the rest of the block is the hold.

export const EDITION = { id: 'machina', label: 'V5 · La nota', page: './machina.html' }
export const STORE_KEY = 'cooltura-intimissimi.machina.v1'

export const PALETTE = {
  paper: '#f3f1ec',
  white: '#ffffff',
  ink: '#0b0b0c',
  mute: '#6b6b70',
  hair: '#c9c9cf',
  lime: '#c0ff33',
  lavender: '#b19aff',
  violet: '#8174f2',
  orange: '#f64414',
}
export const SWATCHES = ['violet', 'lavender', 'ink', 'mute', 'hair', 'white', 'paper', 'lime', 'orange']

// PP Neue Machina by weight (Light 300, Regular 400, Ultrabold 800 are the cuts;
// the others are real instances interpolated between them, see lib/type.js).
export const FACES = [
  ['300', 'Neue Machina Light'],
  ['340', 'Neue Machina Light+'],
  ['400', 'Neue Machina Regular'],
  ['500', 'Neue Machina Medium'],
  ['600', 'Neue Machina Semibold'],
  ['800', 'Neue Machina Ultrabold'],
]

const num = (k, label, d, min, max, step = 0.01, unit = '') => ({ k, label, t: 'num', d, min, max, step, unit })
const bool = (k, label, d) => ({ k, label, t: 'bool', d })
const color = (k, label, d) => ({ k, label, t: 'color', d })
const select = (k, label, d, opts) => ({ k, label, t: 'select', d, opts })
const text = (k, label, d) => ({ k, label, t: 'text', d })
const ez = (k, label, d) => ({ k, label, t: 'ease', d })
const face = (k, label, d) => select(k, label, d, FACES)
const videos = (k, label, d, pool) => ({ k, label, t: 'videos', d, pool })

export const SPLITS = [
  ['chars', 'Lettere'],
  ['words', 'Parole'],
  ['lines', 'Righe'],
]
export const ORDERS = [
  ['start', 'Dall’inizio'],
  ['end', 'Dalla fine'],
  ['center', 'Dal centro'],
  ['edges', 'Dai bordi'],
  ['random', 'Casuale'],
]

// ------------------------------------------------------------------ reusable effects

/** The camera and the pen: how the block arrives on its station. */
const moveFx = (o = {}) => ({
  id: 'move',
  label: 'Camera e penna',
  icon: 'pen',
  params: [
    num('travel', 'Camera: viaggio fino alla stazione', o.travel ?? 0.95, 0.1, 4, 0.01, 's'),
    ez('camEase', 'Camera: ease', o.camEase ?? 'cubic(0.65,0,0.3,1)'),
    num('penDur', 'Penna: tempo per disegnare il suo tratto', o.penDur ?? 1.3, 0.1, 5, 0.01, 's'),
    ez('penEase', 'Penna: ease', o.penEase ?? 'cubic(0.6,0,0.25,1)'),
  ],
})

/** Type standing on the line: it rises out of the line when the pen passes under it. */
const riseFx = (o = {}) => ({
  id: 'rise',
  label: 'Nasce dalla linea',
  icon: 'arrow-up',
  params: [
    select('riseSplit', 'Dividi per', o.split ?? 'chars', SPLITS),
    num('riseDelay', 'Ritardo sul passaggio della penna', o.delay ?? 0.02, -0.5, 1.5, 0.01, 's'),
    num('riseDur', 'Durata', o.dur ?? 0.75, 0.1, 2.5, 0.01, 's'),
    ez('riseEase', 'Ease', o.ease ?? 'ci.reveal'),
    num('riseY', 'Da sotto la linea (% della lettera)', o.y ?? 150, 50, 300, 1, '%'),
    num('riseBlur', 'Blur iniziale (% della lettera)', o.blur ?? 26, 0, 150, 1, '%'),
    num('motion', 'Motion blur', o.motion ?? 0.7, 0, 3, 0.05),
  ],
})

const copyFx = (o = {}) => ({
  id: 'copy',
  label: 'Testo',
  icon: 'text',
  params: [
    text('lead', 'Prima parola (grigia)', o.lead ?? ''),
    text('text', 'Testo', o.text ?? ''),
    face('weight', 'Carattere', o.weight ?? '400'),
    num('size', 'Corpo (altezza maiuscole, % del lato corto)', o.size ?? 7.2, 1, 30, 0.1, '%'),
    num('tracking', 'Spaziatura lettere (em)', o.tracking ?? -0.02, -0.1, 0.3, 0.005),
    num('leading', 'Interlinea (em)', o.leading ?? 1.06, 0.8, 2, 0.01),
    num('measure', 'Larghezza del campo di testo (× lato corto)', o.measure ?? 1.5, 0.3, 3, 0.01),
    color('color', 'Colore', o.color ?? 'ink'),
    color('leadColor', 'Colore della prima parola', o.leadColor ?? 'mute'),
    color('fromColor', 'Colore mentre nasce', o.fromColor ?? 'violet'),
  ],
})

/** A figure standing on the line (a counter that rolls up) + its caption hanging under it. */
const figureParams = (o = {}) => [
  face('weight', 'Carattere delle cifre', o.weight ?? '340'),
  num('size', 'Cifre: corpo (% del lato corto)', o.size ?? 8.8, 2, 30, 0.1, '%'),
  color('fromColor', 'Colore mentre girano', o.fromColor ?? 'violet'),
  color('color', 'Colore', o.color ?? 'ink'),
  face('labelWeight', 'Carattere della didascalia', '400'),
  num('labelSize', 'Didascalia: corpo (% del lato corto)', o.labelSize ?? 2.05, 0.6, 6, 0.05, '%'),
  num('labelTracking', 'Didascalia: spaziatura (em)', 0.08, -0.05, 0.4, 0.005),
  color('labelColor', 'Colore della didascalia', 'mute'),
  num('cDur', 'Counter: durata', o.cDur ?? 1.25, 0.2, 3, 0.01, 's'),
  ez('cEase', 'Counter: ease', 'ci.emph'),
  num('spins', 'Giri del primo rullo', o.spins ?? 5, 1, 20, 1),
  num('spinStep', 'Giri in più per cifra', 1, 0, 6, 1),
  num('cBlur', 'Blur iniziale', 24, 0, 150, 1, '%'),
]

// ------------------------------------------------------------------ shot types

export const SHOT_TYPES = {
  lockup: {
    label: 'cooltura* × intimissimi',
    effects: [
      {
        id: 'layout',
        label: 'Composizione',
        icon: 'grid',
        params: [
          num('scale', 'Scala', 1, 0.4, 2),
          num('intiSize', 'intimissimi (× occhio di cooltura)', 0.96, 0.4, 2),
          num('xSize', '× · dimensione', 0.62, 0.2, 2),
          num('xWeight', '× · spessore', 1, 0.3, 4),
          num('gap', 'Distanza dalla ×', 1.3, 0.2, 3),
          color('logoColor', 'Colore', 'ink'),
          num('floor', 'La linea: sotto la base dei logotipi (× occhio)', 1.15, 0.3, 4, 0.01),
          num('hookR', 'La linea: raggio delle curve (× occhio)', 0.32, 0, 2, 0.01),
        ],
      },
      {
        id: 'cross',
        label: '× che si disegna',
        icon: 'xmark',
        params: [num('xAt', 'Inizio', 0.05, -1, 3, 0.01, 's'), num('xDur', 'Durata', 0.75, 0.1, 2.5, 0.01, 's'), ez('xEase', 'Ease', 'ci.reveal')],
      },
      {
        id: 'cool',
        label: 'cooltura · lettere da destra a sinistra',
        icon: 'signature',
        params: [
          select('cOrder', 'Ordine', 'end', ORDERS),
          num('cAt', 'Inizio', 0.22, -1, 3, 0.01, 's'),
          num('cStagger', 'Stagger', 0.055, 0, 0.3, 0.002, 's'),
          num('cDur', 'Durata', 0.8, 0.1, 2.5, 0.01, 's'),
          ez('cEase', 'Ease', 'ci.reveal'),
          num('cY', 'Da Y (% dell’altezza)', 105, -300, 300, 1, '%'),
          num('cBlur', 'Blur', 30, 0, 200, 1, '%'),
        ],
      },
      {
        id: 'inti',
        label: 'intimissimi · lettere da sinistra a destra',
        icon: 'signature',
        params: [
          select('iOrder', 'Ordine', 'start', ORDERS),
          num('iAt', 'Inizio', 0.3, -1, 3, 0.01, 's'),
          num('iStagger', 'Stagger', 0.05, 0, 0.3, 0.002, 's'),
          num('iDur', 'Durata', 0.8, 0.1, 2.5, 0.01, 's'),
          ez('iEase', 'Ease', 'ci.reveal'),
          num('iY', 'Da Y (% dell’altezza)', 105, -300, 300, 1, '%'),
          num('iBlur', 'Blur', 30, 0, 200, 1, '%'),
        ],
      },
      {
        id: 'dock',
        label: 'Chiusura: l’asterisco torna nel logo',
        icon: 'asterisk',
        params: [
          num('travel', 'Camera: viaggio', 1.0, 0.1, 4, 0.01, 's'),
          ez('camEase', 'Camera: ease', 'cubic(0.65,0,0.3,1)'),
          num('penDur', 'Penna: fino al suo posto nel logo', 1.5, 0.2, 5, 0.01, 's'),
          ez('penEase', 'Penna: ease', 'cubic(0.6,0,0.2,1)'),
          num('revealAt', 'Il logo si scrive da (dall’inizio del blocco)', 0.55, -1, 4, 0.01, 's'),
          num('retractAt', 'La linea si riavvolge: dopo l’arrivo', 0.02, -1, 3, 0.01, 's'),
          num('retractDur', 'La linea si riavvolge: durata', 0.75, 0.1, 3, 0.01, 's'),
          ez('retractEase', 'La linea si riavvolge: ease', 'cubic(0.7,0,0.25,1)'),
        ],
      },
    ],
  },
  word: {
    label: 'Parola (intro B)',
    effects: [
      {
        id: 'copy',
        label: 'Testo',
        icon: 'text',
        params: [
          text('text', 'Testo', ''),
          face('weight', 'Carattere', '400'),
          num('size', 'Corpo (% del lato corto)', 10, 2, 30, 0.1, '%'),
          num('tracking', 'Spaziatura lettere (em)', -0.025, -0.1, 0.3, 0.005),
          color('color', 'Colore', 'ink'),
          color('fromColor', 'Colore di partenza', 'violet'),
        ],
      },
      {
        id: 'in',
        label: 'Reveal · lettere da sotto, in maschera',
        icon: 'arrow-up',
        params: [
          num('inAt', 'Inizio', 0.02, -1, 2, 0.01, 's'),
          num('inStagger', 'Stagger', 0.026, 0, 0.3, 0.002, 's'),
          num('inDur', 'Durata', 0.6, 0.1, 2, 0.01, 's'),
          ez('inEase', 'Ease', 'ci.reveal'),
          num('inY', 'Da Y (%)', 50, -300, 300, 1, '%'),
          num('inBlur', 'Blur', 22, 0, 150, 1, '%'),
        ],
      },
      {
        id: 'out',
        label: 'Unreveal · verso l’alto (spinta dalla parola dopo)',
        icon: 'arrow-up',
        params: [
          num('outAt', 'Inizio (rispetto alla fine del blocco)', -0.26, -2, 1, 0.01, 's'),
          num('outStagger', 'Stagger', 0.022, 0, 0.3, 0.002, 's'),
          num('outDur', 'Durata', 0.38, 0.1, 2, 0.01, 's'),
          ez('outEase', 'Ease', 'ci.exit'),
          num('outY', 'Verso Y (%)', -50, -300, 300, 1, '%'),
          num('outBlur', 'Blur', 22, 0, 150, 1, '%'),
        ],
      },
    ],
  },
  creators: {
    label: 'Un creator → 311',
    effects: [
      {
        id: 'hero',
        label: 'Il primo video · la penna gli disegna la cornice',
        icon: 'camera',
        params: [
          num('heroH', 'Altezza del video (× frame)', 0.6, 0.2, 0.9, 0.005),
          num('corner', 'Raggio angoli (× larghezza)', 0.06, 0, 0.3, 0.005),
          num('frameGap', 'Distanza della cornice dal video (× altezza)', 0.014, 0, 0.08, 0.001),
          num('revealDur', 'Il video sale nella cornice: durata', 0.9, 0.1, 2.5, 0.01, 's'),
          ez('revealEase', 'Ease', 'cubic(0.5,0,0.2,1)'),
        ],
      },
      {
        id: 'mosaic',
        label: '310 creator salgono dalla linea · la camera si allontana',
        icon: 'grid',
        params: [
          num('count', 'Creator in tutto (il primo compreso)', 311, 2, 600, 1),
          num('rows', 'Righe (0 = dal formato)', 0, 0, 40, 1),
          num('gap', 'Spazio tra i video (× altezza)', 0.07, 0.01, 0.3, 0.005),
          num('pbAt', 'Inizio (dopo che la cornice si chiude)', 0.55, -1, 3, 0.01, 's'),
          num('pbDur', 'Durata dello zoom out', 1.9, 0.3, 5, 0.01, 's'),
          ez('pbEase', 'Ease dello zoom out', 'cubic(0.55,0,0.15,1)'),
          num('riseDur', 'Ogni video si riempie in', 0.42, 0.1, 2, 0.01, 's'),
          num('rowStagger', 'Da una riga alla successiva (la colonna cresce)', 0.035, 0, 0.3, 0.002, 's'),
          ez('riseEase', 'Ease', 'cubic(0.3,0.5,0.2,1)'),
        ],
      },
      {
        id: 'figure',
        label: '311 · creators',
        icon: 'hashtag',
        params: [text('value', 'Valore', '311'), text('label', 'Didascalia', 'creators'), ...figureParams({ size: 9.6, cDur: 1.6, spins: 6 })],
      },
      moveFx({ travel: 1.25, penDur: 1.75 }),
    ],
  },
  campaigns: {
    label: '5 campagne',
    effects: [
      {
        id: 'names',
        label: 'Le campagne · ognuna spinge su la precedente',
        icon: 'layer',
        params: [
          text('n1', 'Campagna 1', 'Aria'),
          text('n2', 'Campagna 2', 'Nude Look'),
          text('n3', 'Campagna 3', 'Ultralight with Cashmere (Italia)'),
          text('n4', 'Campagna 4', 'Ultralight with Cashmere (USA)'),
          text('n5', 'Campagna 5', 'Natale & Party Looks'),
          face('nameWeight', 'Carattere', '400'),
          num('nameSize', 'Corpo (% del lato corto)', 3.3, 1, 10, 0.05, '%'),
          num('nameLeading', 'Passo delle righe (em)', 1.42, 1, 2.5, 0.01),
          color('nameColor', 'Colore', 'ink'),
          num('enterAt', 'La prima entra (dopo il passaggio della penna)', 0.05, -1, 2, 0.01, 's'),
          num('enterEvery', 'Una ogni', 0.3, 0.05, 1.5, 0.01, 's'),
          num('enterDur', 'Durata della salita', 0.62, 0.1, 2, 0.01, 's'),
          ez('enterEase', 'Ease', 'cubic(0.3,0.6,0.2,1)'),
        ],
      },
      {
        id: 'figure',
        label: '5 · campaigns (il rullo conta le campagne)',
        icon: 'hashtag',
        params: [text('value', 'Valore', '5'), text('label', 'Didascalia', 'campaigns'), ...figureParams({ cDur: 0.5 })],
      },
      moveFx({ travel: 1.25, penDur: 1.75 }),
    ],
  },
  vision: {
    label: 'One shared vision',
    effects: [
      {
        id: 'sink',
        label: 'Le cinque campagne rientrano nella linea',
        icon: 'arrow-up',
        params: [num('sinkAt', 'Inizio', 0.05, -1, 2, 0.01, 's'), num('sinkDur', 'Durata', 0.7, 0.1, 2, 0.01, 's'), ez('sinkEase', 'Ease', 'cubic(0.6,0,0.8,0.4)')],
      },
      copyFx({ text: 'One shared vision.', size: 7.2 }),
      {
        id: 'rise',
        label: 'Ne nasce una frase sola',
        icon: 'arrow-up',
        params: [
          num('riseAt', 'Inizio', 0.5, -1, 3, 0.01, 's'),
          select('riseSplit', 'Dividi per', 'chars', SPLITS),
          select('riseOrder', 'Ordine', 'start', ORDERS),
          num('riseStagger', 'Stagger', 0.028, 0, 0.3, 0.002, 's'),
          num('riseDur', 'Durata', 0.8, 0.1, 2.5, 0.01, 's'),
          ez('riseEase', 'Ease', 'ci.reveal'),
          num('riseY', 'Da sotto la linea (%)', 150, 50, 300, 1, '%'),
          num('riseBlur', 'Blur iniziale (%)', 26, 0, 150, 1, '%'),
          num('motion', 'Motion blur', 0.7, 0, 3, 0.05),
        ],
      },
    ],
  },
  title: {
    label: 'Frase sulla linea',
    effects: [copyFx(), riseFx(), moveFx()],
  },
  figures: {
    label: 'Due numeri sulla linea',
    effects: [
      {
        id: 'data',
        label: 'Numeri (somma delle campagne)',
        icon: 'hashtag',
        params: [text('v1', 'Valore 1', ''), text('l1', 'Didascalia 1', ''), text('v2', 'Valore 2', ''), text('l2', 'Didascalia 2', '')],
      },
      { id: 'style', label: 'Cifre e didascalie', icon: 'text', params: [...figureParams(), num('colGap', 'Spazio tra le due colonne (× lato corto)', 0.26, 0.05, 1, 0.005)] },
      moveFx({ penDur: 1.5 }),
    ],
  },
  proof: {
    label: 'Video sulla linea',
    effects: [
      { id: 'videos', label: 'Video (in ordine)', icon: 'film', params: [videos('videos', 'Video', [], 'aria-')] },
      {
        id: 'frames',
        label: 'Cornici disegnate dalla penna',
        icon: 'camera',
        params: [
          num('count', 'Quanti (0 = dal formato: 3 largo, 2 stretto)', 0, 0, 6, 1),
          num('size', 'Altezza (× frame)', 0.5, 0.2, 0.85, 0.005),
          num('gap', 'Spazio tra i video (× altezza)', 0.1, 0, 0.5, 0.005),
          num('corner', 'Raggio angoli (× larghezza)', 0.06, 0, 0.3, 0.005),
          num('frameGap', 'Distanza della cornice dal video (× altezza)', 0.016, 0, 0.08, 0.001),
          num('revealDur', 'Il video sale nella cornice: durata', 0.75, 0.1, 2.5, 0.01, 's'),
          ez('revealEase', 'Ease', 'cubic(0.5,0,0.2,1)'),
        ],
      },
      {
        id: 'caption',
        label: 'Didascalia sotto la linea',
        icon: 'text',
        params: [text('caption', 'Testo', ''), num('labelSize', 'Corpo (% del lato corto)', 2.05, 0.6, 6, 0.05, '%'), num('labelTracking', 'Spaziatura (em)', 0.08, -0.05, 0.4, 0.005), color('labelColor', 'Colore', 'mute')],
      },
      moveFx({ travel: 1.0, penDur: 2.0, penEase: 'cubic(0.45,0,0.3,1)' }),
    ],
  },
  claim: {
    label: '#1 su TikTok',
    effects: [
      {
        id: 'claim',
        label: 'Claim',
        icon: 'hashtag',
        params: [
          text('big', 'Numero', '#1'),
          text('text', 'Testo', 'result on TikTok search for the product category'),
          face('weight', 'Carattere del numero', '340'),
          num('size', 'Numero: corpo (% del lato corto)', 15, 3, 40, 0.1, '%'),
          color('fromColor', 'Numero: colore mentre gira', 'ink'),
          color('color', 'Numero: colore', 'violet'),
          face('textWeight', 'Carattere del testo', '400'),
          num('textSize', 'Testo: corpo (% del lato corto)', 2.6, 1, 8, 0.05, '%'),
          num('textMeasure', 'Testo: larghezza (× lato corto)', 0.5, 0.2, 1.5, 0.01),
          color('textColor', 'Testo: colore', 'ink'),
          num('cDur', 'Counter: durata', 1.2, 0.2, 3, 0.01, 's'),
          num('spins', 'Giri', 8, 1, 20, 1),
        ],
      },
      riseFx({ split: 'words', dur: 0.8 }),
      moveFx(),
    ],
  },
  thread: {
    label: 'Il thread dei commenti',
    effects: [
      {
        id: 'figure',
        label: 'Numero dei commenti',
        icon: 'hashtag',
        params: [text('value', 'Valore', 'XXK'), text('label', 'Didascalia', 'comments'), ...figureParams()],
      },
      {
        id: 'thread',
        label: 'La linea scende e i commenti ci si appendono',
        icon: 'bell',
        params: [
          num('count', 'Commenti', 30, 4, 80, 1),
          num('width', 'Larghezza della colonna dei commenti (× lato corto)', 0.58, 0.2, 1.2, 0.005),
          num('gap', 'Spazio tra i commenti (× lato corto)', 0.034, 0, 0.2, 0.002),
          num('branch', 'Rametto dal filo (× lato corto)', 0.05, 0.01, 0.2, 0.002),
          num('slow', 'I primi si leggono: lentezza', 10, 1, 20, 0.1),
          num('slowPart', 'I primi si leggono: quanta parte del filo', 0.11, 0.02, 0.6, 0.005),
          num('revealDur', 'Ogni commento esce dal filo in', 0.5, 0.1, 2, 0.01, 's'),
          ez('revealEase', 'Ease', 'ci.reveal'),
          num('follow', 'La camera segue: penna sotto il centro (× frame)', 0.2, -0.4, 0.45, 0.005),
        ],
      },
      moveFx({ travel: 1.0, penDur: 3.9, penEase: 'cubic(0.45,0,0.3,1)' }),
    ],
  },
}

// ------------------------------------------------------------------ scenes

export const SCENE_TYPES = {
  introA: { label: 'Intro A · logo', hue: '#ffffff', effects: [] },
  introB: { label: 'Intro B · statement', hue: '#c0ff33', effects: [] },
  campaigns: { label: 'Campaigns', hue: '#8174f2', effects: [] },
  numbers: { label: 'The numbers', hue: '#b19aff', effects: [] },
  beyond: { label: 'Beyond numbers', hue: '#f64414', effects: [] },
  closing: { label: 'Closing', hue: '#0b0b0c', effects: [] },
}

/** The look of the whole film (panel shown when no block is selected). */
export const LOOK = {
  fx: {
    id: 'look',
    label: 'La linea e l’asterisco',
    icon: 'asterisk',
    params: [
      color('lineColor', 'Colore della linea', 'violet'),
      num('lineWidth', 'Spessore della linea (px a 1080)', 2.4, 0.5, 10, 0.1, 'px'),
      color('penColor', 'Colore dell’asterisco in viaggio', 'violet'),
      num('penSize', 'Asterisco in viaggio (% del lato corto)', 2.5, 0.8, 8, 0.05, '%'),
      bool('plainZero', 'Zero senza barra (Neue Machina ss12)', true),
      num('motionBlur', 'Motion blur della camera', 0.2, 0, 1.5, 0.01),
      num('grain', 'Grana', 0, 0, 0.12, 0.002),
      num('vignette', 'Vignetta', 0, 0, 0.6, 0.01),
    ],
  },
  defaults: { lineColor: 'violet', lineWidth: 2.4, penColor: 'violet', penSize: 2.5, plainZero: true, motionBlur: 0.2, grain: 0, vignette: 0 },
}

// ------------------------------------------------------------------ default film

const shot = (id, type, name, dur, params = {}) => ({ id, type, name, dur, params })

const ARIA_SET = ['aria-alessia-morelli', 'aria-rachele-santoro', 'aria-giulia-romanelli']
const EXT_SET = ['ext-virginia-giva', 'ext-gaia-sgalia', 'ext-coco-genge']

const title = (lead, txt, o = {}) => ({ lead, text: txt, ...o })

export function defaultProject() {
  return {
    version: 1,
    aspect: '16:9',
    intro: 'A',
    fps: 30,
    target: 45,
    look: { ...LOOK.defaults },
    scenes: [
      { id: 'intro-a', type: 'introA', when: 'A', params: {}, shots: [shot('logo', 'lockup', 'cooltura* × intimissimi', 2.1)] },
      {
        id: 'intro-b',
        type: 'introB',
        when: 'B',
        params: {},
        shots: [
          shot('w-creators', 'word', 'Creators.', 0.48, { text: 'Creators.' }),
          shot('w-culture', 'word', 'Culture.', 0.46, { text: 'Culture.' }),
          shot('w-impact', 'word', 'Impact.', 0.5, { text: 'Impact.' }),
          shot('logo-b', 'lockup', 'cooltura* × intimissimi', 1.3, { xAt: 0.04, xDur: 0.6, cAt: 0.12, cStagger: 0.04, cDur: 0.62, iAt: 0.16, iStagger: 0.035, iDur: 0.62 }),
        ],
      },
      {
        id: 'campaigns',
        type: 'campaigns',
        params: {},
        shots: [
          shot('creators', 'creators', '1 → 311 creators', 4.85),
          shot('campaigns', 'campaigns', '5 campaigns', 3.4),
          shot('vision', 'vision', 'One shared vision.', 1.95),
        ],
      },
      {
        id: 'numbers',
        type: 'numbers',
        params: {},
        shots: [
          shot('stat-a', 'figures', '9.8M+ · 60M', 2.75, { v1: '9.8M+', l1: 'organic views', v2: '60M', l2: 'paid views' }),
          shot('stat-b', 'figures', '+XX% · 497K+', 2.6, { v1: '+XX%', l1: 'vs benchmark', v2: '497K+', l2: 'interactions' }),
        ],
      },
      {
        id: 'beyond',
        type: 'beyond',
        params: {},
        shots: [
          shot('beyond', 'title', 'Beyond numbers.', 1.7, title('', 'Beyond numbers.')),
          shot('ch1-from', 'title', 'From insights', 1.4, title('From', 'insights')),
          shot('aria', 'proof', 'Aria', 2.2, { videos: ARIA_SET, caption: 'Aria' }),
          shot('claim', 'claim', '#1 on TikTok search', 2.1),
          shot('ch1-to', 'title', 'to sales.', 1.4, title('to', 'sales.')),
          shot('ch2-from', 'title', 'From viral', 1.4, title('From', 'viral')),
          shot('ext', 'proof', 'Externability', 2.2, { videos: EXT_SET, caption: 'Externability' }),
          shot('ch2-to', 'title', 'to iconic.', 1.4, title('to', 'iconic.')),
          shot('ch3-from', 'title', 'From content', 1.4, title('From', 'content')),
          shot('thread', 'thread', 'Comments', 4.2),
          shot('ch3-to', 'title', 'to communities.', 1.5, title('to', 'communities.')),
        ],
      },
      {
        id: 'closing',
        type: 'closing',
        params: {},
        shots: [
          shot('best', 'title', 'The best part?', 1.45, title('', 'The best part?')),
          shot('started', 'title', 'We’re just getting started.', 1.85, title('', 'We’re just getting started.')),
          shot('outro', 'lockup', 'cooltura* × intimissimi', 3.15),
        ],
      },
    ],
  }
}

/** The proof shots pick from their own campaign folder. */
export function effectsOf(sh) {
  const base = SHOT_TYPES[sh.type]?.effects || []
  if (sh.type === 'proof') {
    const pool = sh.id === 'ext' ? 'ext-' : 'aria-'
    return base.map((f) => (f.id === 'videos' ? { ...f, params: f.params.map((p) => ({ ...p, pool })) } : f))
  }
  return base
}
export const sceneEffects = (sc) => SCENE_TYPES[sc.type]?.effects || []

const defaultsOf = (effects) => {
  const o = {}
  for (const fx of effects) for (const p of fx.params) o[p.k] = Array.isArray(p.d) ? [...p.d] : p.d
  return o
}

export const MIN_DUR = 0.2
export const INTROS = { A: 'Intro A · logo', B: 'Intro B · statement + logo' }

/** Absolute times + parameters merged over their defaults (same contract as V4). */
export function resolve(project) {
  let t = 0
  const shots = []
  const scenes = []
  const byId = new Map()
  const sceneById = new Map()
  const intro = project.intro === 'B' ? 'B' : 'A'
  for (const sc of project.scenes) {
    if (sc.when && sc.when !== intro) continue
    const rs = { id: sc.id, type: sc.type, label: SCENE_TYPES[sc.type].label, hue: SCENE_TYPES[sc.type].hue, start: t, end: t, p: { ...defaultsOf(sceneEffects(sc)), ...sc.params }, shots: [], src: sc }
    for (const sh of sc.shots) {
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
    intro,
    scenes,
    shots,
    shot: (id) => byId.get(id),
    scene: (id) => sceneById.get(id),
    at: (time) => shots.find((s) => time >= s.start && time < s.end) || shots[shots.length - 1],
    next: (sh) => shots[sh.index + 1] || null,
    prev: (sh) => shots[sh.index - 1] || null,
  }
}
