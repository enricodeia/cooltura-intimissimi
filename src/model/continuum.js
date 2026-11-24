// The second half of the film, the same in both editions ("due idee di intro
// diverse ma il continuum uguale"): from the comments to the last line.
//
//   From content to communities   the title, an iPhone 17 Pro rises from the bottom;
//                                 one camera move that never stops goes down into it
//                                 as three comments land as notifications, then the
//                                 rest come sooner and sooner and it accelerates down
//                                 with them, to white (redone 2026-11-23)
//   We paired creators…           drops in from the top, line by line; the push of
//                                 its last line ("insight-led strategy") by the rest
//                                 of the sentence ("to drive record sales") is
//                                 available, off in his tuning
//   Aria                          the wheel of Aria videos turns in from the right,
//                                 three steps, the #1 claim under it, out to the left
//   We went beyond the brief…     comes in from the right while the wheel leaves
//   Externability                 video cards pop up in the centre and are swiped
//                                 right and left, three times; the last one turns
//                                 away on its vertical axis, to the left
//   The best part? · We're just getting started.
//
// PP Neue Machina throughout; titles in capitals ("We went beyond the brief…"
// as a sentence). Both models (project-v4.js, machina/model.js) take their shot
// types, scenes and default shots from here; the defaults are his tuning of
// option 1 (2026-11-23).

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

export const num = (k, label, d, min, max, step = 0.01, unit = '') => ({ k, label, t: 'num', d, min, max, step, unit })
export const bool = (k, label, d) => ({ k, label, t: 'bool', d })
export const color = (k, label, d) => ({ k, label, t: 'color', d })
export const select = (k, label, d, opts) => ({ k, label, t: 'select', d, opts })
export const text = (k, label, d) => ({ k, label, t: 'text', d })
export const ez = (k, label, d) => ({ k, label, t: 'ease', d })
export const face = (k, label, d) => select(k, label, d, FACES)
export const videos = (k, label, d, pool) => ({ k, label, t: 'videos', d, pool })

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
const ALIGN = [
  ['left', 'Sinistra'],
  ['center', 'Centro'],
  ['right', 'Destra'],
]

// ------------------------------------------------------------------ kinetic type

/** The parameters of one phase of kinetic type (in = reveal, out = unreveal). */
export function phase(pre, d = {}, atLabel) {
  const isIn = pre === 'in'
  return [
    select(pre + 'Split', 'Dividi per', d.split ?? 'words', SPLITS),
    select(pre + 'Order', 'Ordine dello stagger', d.order ?? 'start', ORDERS),
    num(pre + 'At', atLabel || (isIn ? 'Inizio (dall’inizio del blocco)' : 'Inizio (rispetto alla fine del blocco)'), d.at ?? (isIn ? 0 : -0.45), -3, 4, 0.01, 's'),
    num(pre + 'Stagger', 'Stagger', d.stagger ?? 0.05, 0, 0.4, 0.002, 's'),
    num(pre + 'Dur', 'Durata', d.dur ?? 0.8, 0.05, 3, 0.01, 's'),
    ez(pre + 'Ease', 'Ease', d.ease ?? (isIn ? 'ci.reveal' : 'ci.exit')),
    num(pre + 'X', isIn ? 'Da X (% della lettera, + = destra)' : 'Verso X (%, + = destra)', d.x ?? 0, -800, 800, 1, '%'),
    num(pre + 'Y', isIn ? 'Da Y (% della lettera, + = sotto)' : 'Verso Y (%, + = sotto)', d.y ?? (isIn ? 110 : -110), -800, 800, 1, '%'),
    num(pre + 'Rot', isIn ? 'Rotazione X iniziale (90 = cubo dal basso)' : 'Rotazione X finale (−90 = cubo in alto)', d.rot ?? 0, -180, 180, 1, '°'),
    num(pre + 'Depth', 'Profondità della rotazione (0.5 = cubo)', d.depth ?? 0, 0, 2, 0.01),
    num(pre + 'Scale', isIn ? 'Scala iniziale' : 'Scala finale', d.scale ?? 1, 0, 3, 0.01),
    num(pre + 'Blur', isIn ? 'Blur iniziale (% della lettera)' : 'Blur finale (%)', d.blur ?? 0, 0, 200, 1, '%'),
    num(pre + 'Opacity', isIn ? 'Opacità iniziale' : 'Opacità finale', d.opacity ?? 0, 0, 1, 0.01),
    bool(pre + 'Mask', 'Maschera', d.mask ?? true),
  ]
}

/** A block of type: copy + reveal + unreveal (+ the push of its last line). o = defaults for this block. */
export function typeFx(o = {}) {
  const fx = [
    {
      id: 'copy',
      label: 'Testo',
      icon: 'text',
      params: [
        text('text', 'Testo', o.text ?? ''),
        bool('caps', 'Maiuscolo', o.caps ?? true),
        o.faces ? select('weight', 'Carattere', o.weight ?? '400', o.faces) : face('weight', 'Carattere', o.weight ?? '400'),
        num('size', 'Corpo (altezza maiuscole, % del lato corto)', o.size ?? 6, 1, 40, 0.1, '%'),
        num('tracking', 'Spaziatura lettere (em)', o.tracking ?? -0.01, -0.1, 0.4, 0.005),
        num('leading', 'Interlinea (× corpo)', o.leading ?? 1.08, 0.8, 2.2, 0.01),
        select('align', 'Allineamento', o.align ?? 'center', ALIGN),
        num('measure', 'Larghezza del campo di testo (× lato corto)', o.measure ?? 0.88, 0.2, 2.6, 0.01),
        num('x', 'Posizione X (× metà frame)', o.x ?? 0, -1, 1, 0.005),
        num('y', 'Posizione Y (× metà frame, + = su)', o.y ?? 0, -1, 1, 0.005),
        color('fromColor', 'Colore di partenza (a opacità 0)', o.fromColor ?? 'violet'),
        color('color', 'Colore (a opacità 100)', o.color ?? 'ink'),
        num('motion', 'Motion blur', o.motion ?? 0.8, 0, 3, 0.05),
      ],
    },
    { id: 'in', label: 'Reveal', icon: 'arrow-up', params: [...phase('in', o.in), bool('inWake', 'Entra nella scia del carosello prima (mai sopra i video)', o.inWake ?? false)] },
    {
      id: 'out',
      label: 'Unreveal',
      icon: 'arrow-up',
      on: 'outOn',
      params: [bool('outOn', 'Attivo', o.outOn ?? true), bool('outSweep', 'Spazzato via dal carosello che segue (parola per parola)', o.outSweep ?? true), ...phase('out', o.out, o.outAtLabel)],
    },
  ]
  if (o.push)
    fx.push({
      id: 'push',
      label: 'L’ultima riga spinta via dal seguito della frase',
      icon: 'arrow-left',
      on: 'pushOn',
      params: [
        bool('pushOn', 'Attivo', true),
        num('pushWords', 'Parole dell’ultima riga (spinta via)', o.push.words ?? 2, 1, 12, 1),
        text('pushText', 'Il seguito (entra da destra)', o.push.text ?? ''),
        num('pushAt', 'Inizio (dall’inizio del blocco)', o.push.at ?? 1.1, -1, 5, 0.01, 's'),
        num('pushDur', 'Durata', o.push.dur ?? 0.62, 0.1, 2.5, 0.01, 's'),
        ez('pushEase', 'Ease', o.push.ease ?? 'cubic(0.6,0,0.25,1)'),
        num('pushWindow', 'Finestra della maschera (× la riga più lunga)', o.push.window ?? 1, 0.4, 2, 0.01),
      ],
    })
  return fx
}

// ------------------------------------------------------------------ the phone (From content to communities)

const phoneFx = [
  {
    id: 'title',
    label: 'Titolo',
    icon: 'text',
    params: [
      text('text', 'Testo', 'From content to communities'),
      bool('caps', 'Maiuscolo', true),
      face('weight', 'Carattere', '400'),
      num('size', 'Corpo (% del lato corto)', 4.0, 1, 20, 0.1, '%'),
      num('tracking', 'Spaziatura lettere (em)', -0.01, -0.1, 0.4, 0.005),
      num('leading', 'Interlinea (× corpo)', 1.12, 0.8, 2.2, 0.01),
      color('fromColor', 'Colore di partenza', 'violet'),
      color('color', 'Colore', 'ink'),
      select('inSplit', 'Dividi per', 'words', SPLITS),
      num('inAt', 'Inizio', 0, -1.5, 3, 0.01, 's'),
      num('inStagger', 'Stagger', 0.06, 0, 0.3, 0.002, 's'),
      num('inDur', 'Durata', 0.62, 0.1, 2, 0.01, 's'),
      ez('inEase', 'Ease', 'ci.reveal'),
      num('inY', 'Da Y (%, + = sotto)', 110, -400, 400, 1, '%'),
      num('inBlur', 'Blur', 24, 0, 150, 1, '%'),
    ],
  },
  {
    id: 'device',
    label: 'iPhone 17 Pro · sale dal basso',
    icon: 'mobile',
    params: [
      num('phoneH', 'Altezza del telefono (× frame; ne entra solo la parte alta)', 1.18, 0.5, 2, 0.01),
      num('restTop', 'Il bordo alto si ferma a (× metà frame, + = su)', 0.1, -0.8, 0.8, 0.005),
      num('riseAt', 'Inizio', 0.3, -1, 3, 0.01, 's'),
      num('riseDur', 'Durata', 0.95, 0.1, 3, 0.01, 's'),
      ez('riseEase', 'Ease', 'ci.reveal'),
      select('finish', 'Colore', 'silver', [
        ['silver', 'Argento'],
        ['orange', 'Arancio cosmico'],
        ['blue', 'Blu intenso'],
      ]),
      videos('wallpaper', 'Sfondo (video sulla schermata di blocco)', ['aria-beatrice-scintu'], 'aria-'),
      text('clock', 'Ora', '9:41'),
      text('date', 'Data', 'lunedì 17 novembre'),
    ],
  },
  {
    id: 'notifs',
    label: 'Pop-up · i commenti arrivano',
    icon: 'bell',
    params: [
      num('count', 'Pop-up uno alla volta (prima della corsa)', 3, 1, 6, 1),
      num('popAt', 'Il primo arriva', 1.3, 0, 4, 0.01, 's'),
      num('every', 'Uno ogni', 0.34, 0.1, 2, 0.01, 's'),
      num('popDur', 'Durata della comparsa', 0.62, 0.1, 1.5, 0.01, 's'),
      ez('popEase', 'Ease della comparsa', 'ci.reveal'),
      num('popRise', 'Sale da sotto di (× altezza della notifica)', 0.5, -1, 2, 0.01),
      num('popScale', 'Scala di partenza', 0.94, 0.5, 1, 0.005),
      select('style', 'Materiale', 'light', [
        ['light', 'Chiaro'],
        ['dark', 'Scuro'],
      ]),
    ],
  },
  {
    id: 'camera',
    label: 'La camera scende nel telefono (senza mai fermarsi)',
    icon: 'camera',
    params: [
      num('camAt', 'Parte a (a metà della partenza morbida)', 0.8, 0, 3, 0.01, 's'),
      num('camSoft', 'Partenza e cambi di velocità morbidi (±)', 0.35, 0.02, 1, 0.01, 's'),
      num('frameY', 'Il pop-up nuovo sta sotto il centro di (× frame)', 0.1, -0.4, 0.4, 0.005),
      num('zoom', 'Zoom sui pop-up', 1.0, 0.3, 2, 0.01),
      num('drift', 'Avvicinamento lento mentre arrivano (×)', 1.07, 1, 1.6, 0.005),
    ],
  },
  {
    id: 'dive',
    label: 'La corsa · accelera verso il basso',
    icon: 'gauge',
    params: [
      num('extra', 'Commenti nella corsa', 12, 0, 40, 1),
      num('accel', 'Ogni intervallo dura × (più basso = accelera di più)', 0.7, 0.4, 1, 0.01),
      num('minEvery', 'Intervallo minimo', 0.1, 0.03, 0.4, 0.005, 's'),
      num('runZoom', 'Zoom nella corsa (×)', 1.18, 1, 2.5, 0.01),
      num('runSoft', 'Accelerazione morbida (±)', 0.2, 0.02, 0.8, 0.01, 's'),
      num('dissolveAt', 'Il telefono si dissolve: dal primo della corsa', 0.05, -1, 1.5, 0.01, 's'),
      num('dissolveDur', 'Il telefono si dissolve: durata', 0.4, 0.05, 1.5, 0.01, 's'),
      num('fadeDur', 'Al bianco: ultimi', 0.5, 0.1, 1.5, 0.01, 's'),
      num('speedBlur', 'Speed blur', 1, 0, 3, 0.05),
      num('fadeBlur', 'Sfocatura finale', 1, 0, 3, 0.05),
    ],
  },
]

// ------------------------------------------------------------------ the cards (Externability)

const swipeFx = [
  { id: 'videos', label: 'Video delle card', icon: 'film', params: [videos('videos', 'Video (la prima è sopra)', [], 'ext-')] },
  {
    id: 'label',
    label: 'Nome della campagna',
    icon: 'text',
    on: 'labelOn',
    params: [
      bool('labelOn', 'Attivo', true),
      text('label', 'Testo', 'Externability'),
      bool('caps', 'Maiuscolo', true),
      color('labelColor', 'Colore', 'ink'),
      face('labelWeight', 'Carattere', '400'),
      num('labelSize', 'Corpo (% del lato corto)', 2.3, 0.6, 10, 0.05, '%'),
      num('labelTracking', 'Spaziatura (em)', 0.14, -0.05, 0.4, 0.005),
      num('labelAt', 'Inizio', 0.2, -1, 4, 0.01, 's'),
      num('labelOut', 'Uscita: prima della fine', 0.62, 0, 4, 0.01, 's'),
    ],
  },
  {
    id: 'cards',
    label: 'Le card',
    icon: 'layer',
    params: [
      num('cardH', 'Altezza (× frame)', 0.62, 0.2, 0.9, 0.005),
      num('corner', 'Raggio angoli (× larghezza)', 0.06, 0, 0.3, 0.005),
      num('under', 'La card sotto (scala)', 0.93, 0.6, 1, 0.005),
      num('popAt', 'Spuntano: inizio', 0.05, -1, 2, 0.01, 's'),
      num('popDur', 'Spuntano: durata (scale up dal centro)', 0.55, 0.1, 2, 0.01, 's'),
      ez('popEase', 'Spuntano: ease', 'ci.reveal'),
      num('popStagger', 'Spuntano: una dopo l’altra', 0.06, 0, 0.4, 0.005, 's'),
    ],
  },
  {
    id: 'swipe',
    label: 'Swipe a destra e a sinistra',
    icon: 'fit',
    params: [
      num('swipes', 'Quante', 3, 0, 8, 1),
      select('first', 'La prima va', 'right', [
        ['right', 'A destra'],
        ['left', 'A sinistra'],
      ]),
      num('swipeAt', 'La prima parte', 0.62, 0, 4, 0.01, 's'),
      num('swipeEvery', 'Una ogni', 0.46, 0.1, 2, 0.01, 's'),
      num('swipeDur', 'Durata', 0.42, 0.1, 2, 0.01, 's'),
      ez('swipeEase', 'Ease', 'cubic(0.45,0,0.75,0.35)'),
      num('swipeRot', 'Rotazione', 14, 0, 45, 0.5, '°'),
      num('swipeLift', 'Sale un poco (× altezza card)', 0.06, -0.5, 0.5, 0.005),
      num('riseDur', 'La card sotto viene avanti: durata', 0.4, 0.05, 2, 0.01, 's'),
    ],
  },
  {
    id: 'turn',
    label: 'Uscita · giro 3D sull’asse Y, verso sinistra',
    icon: 'rotate',
    params: [
      num('turnLead', 'Inizio: prima della fine del blocco', 0.6, 0, 3, 0.01, 's'),
      num('turnDur', 'Durata', 0.55, 0.1, 2.5, 0.01, 's'),
      ez('turnEase', 'Ease', 'cubic(0.55,0,0.75,0.25)'),
      num('turnAngle', 'Angolo (− = la faccia si gira a sinistra)', -92, -180, 180, 1, '°'),
      num('turnShift', 'Scivola a sinistra (× larghezza card)', 0.35, -2, 2, 0.01),
    ],
  },
]

// ------------------------------------------------------------------ the wheel (Aria)

const carouselFx = [
  { id: 'videos', label: 'Video del carosello', icon: 'film', params: [videos('videos', 'Video (in ordine di arrivo)', [], 'aria-')] },
  {
    id: 'label',
    label: 'Nome della campagna',
    icon: 'text',
    on: 'labelOn',
    params: [
      bool('labelOn', 'Attivo', false),
      text('label', 'Testo', ''),
      bool('caps', 'Maiuscolo', true),
      color('labelColor', 'Colore', 'ink'),
      face('labelWeight', 'Carattere', '400'),
      num('labelSize', 'Corpo (% del lato corto)', 2.3, 0.6, 20, 0.05, '%'),
      num('labelTracking', 'Spaziatura (em)', 0.14, -0.05, 0.4, 0.005),
      select('labelPos', 'Posizione', 'below', [
        ['below', 'In basso al centro'],
        ['above', 'Sopra la ruota'],
      ]),
      num('labelAt', 'Inizio', 0.6, -1, 4, 0.01, 's'),
      num('labelOut', 'Uscita: prima della fine', 0.9, 0, 4, 0.01, 's'),
    ],
  },
  {
    id: 'wheel',
    label: 'Forma',
    icon: 'circle',
    params: [
      select('mode', 'Forma', 'wheel', [
        ['wheel', 'Ruota (semicerchio)'],
        ['ring', 'Anello 3D'],
      ]),
      num('cardH', 'Altezza delle card (× frame)', 0.5, 0.15, 0.9, 0.005),
      num('radius', 'Raggio della ruota (× altezza card)', 1.7, 0.8, 8, 0.01),
      num('spacing', 'Spazio tra le card (× larghezza)', 0.12, 0, 1, 0.005),
      num('lean', 'Le card seguono la ruota (0 dritte, 1 radiali)', 0.85, 0, 1, 0.01),
      num('centerY', 'Altezza (× metà frame)', 0.1, -0.8, 0.8, 0.005),
      num('corner', 'Raggio angoli', 0.06, 0, 0.3, 0.005),
      num('tilt', 'Anello: inclinazione', 10, -40, 40, 0.5, '°'),
    ],
  },
  {
    id: 'motion',
    label: 'Movimento · arrivo, scatti, uscita',
    icon: 'rotate',
    params: [
      num('inAt', 'Inizio', 0, -1, 2, 0.01, 's'),
      num('inDur', 'Arrivo da destra', 0.95, 0.2, 4, 0.01, 's'),
      ez('inEase', 'Ease arrivo', 'ci.soft'),
      select('settle', 'Si ferma con al centro', 'auto', [
        ['auto', 'Auto (dal formato)'],
        ['first', 'La prima card'],
        ['middle', 'La card di mezzo'],
      ]),
      num('steps', 'Scatti di una card (con una pausa su ognuna)', 3, 0, 10, 1),
      num('stepDur', 'Durata di uno scatto', 0.4, 0.1, 2, 0.01, 's'),
      ez('stepEase', 'Ease scatto', 'ci.swift'),
      num('minPause', 'Pausa minima su ogni video', 0.3, 0.05, 2, 0.01, 's'),
      num('outDur', 'Uscita a sinistra', 0.8, 0.1, 3, 0.01, 's'),
      ez('outEase', 'Ease uscita', 'ci.accel'),
      num('outLead', 'Uscita: prima della fine', 0.05, -1, 2, 0.01, 's'),
    ],
  },
]

const claimFx = {
  id: 'claim',
  label: 'Claim #1 su TikTok',
  icon: 'hashtag',
  on: 'claimOn',
  params: [
    bool('claimOn', 'Attivo', true),
    text('claimBig', 'Numero', '#1'),
    text('claim', 'Testo', 'result on TikTok search for the product category'),
    bool('claimCaps', 'Testo in maiuscolo', true),
    color('claimColor', 'Colore numero', 'ink'),
    color('claimTextColor', 'Colore testo', 'ink'),
    face('claimFace', 'Carattere numero', '340'),
    face('claimTextFace', 'Carattere testo', '400'),
    num('claimSize', 'Scala', 1, 0.4, 2),
    num('claimAt', 'Inizio', 1.0, -1, 4, 0.01, 's'),
    num('claimOut', 'Uscita: prima della fine', 0.95, 0, 4, 0.01, 's'),
  ],
}

export const SHOT_TYPES = {
  text: { label: 'Testo', effects: typeFx() },
  statement: { label: 'Frase (l’ultima riga spinta via)', effects: typeFx({ push: {} }) },
  carousel: { label: 'Carosello circolare', effects: carouselFx },
  phone: { label: 'iPhone · notifiche', effects: phoneFx },
  swipe: { label: 'Card · swipe', effects: swipeFx },
}

export const SCENE_TYPES = {
  communities: { label: 'From content to communities', hue: '#b19aff', effects: [] },
  beyond: { label: 'Aria · Externability', hue: '#f64414', effects: [] },
  closing: { label: 'Closing', hue: '#0b0b0c', effects: [] },
}

/** Pools and extra effects of the continuum's shots (the claim under Aria). null when the shot is not one of them. */
export function continuumEffects(sh) {
  const base = SHOT_TYPES[sh.type]?.effects
  if (!base) return null
  if (sh.type === 'carousel') {
    const pool = sh.id === 'externability' ? 'ext-' : 'aria-'
    const fx = base.map((f) => (f.id === 'videos' ? { ...f, params: f.params.map((p) => ({ ...p, pool })) } : f))
    return sh.id === 'aria' ? [...fx, claimFx] : fx
  }
  return base
}

// ------------------------------------------------------------------ default shots
//
// His tuning of option 1 (the JSON he pasted on 2026-11-23, every value as is):
// the continuum is the same in both editions. Keys are in the order of his JSON.

const shot = (id, type, name, dur, params = {}) => ({ id, type, name, dur, params })

// the wheel and the cards: the campaign's own videos, in this order (any of the folder can be added from the panel)
export const ARIA_SET = ['aria-corinne-pino', 'aria-chiara-chelo', 'aria-asia-busciantella', 'aria-federica-bimbi', 'aria-chiara-chelo-spark']
export const EXT_SET = ['ext-virginia-giva', 'ext-gaia-sgalia', 'ext-coco-genge', 'ext-corinne-tiktok']
// the lock screen plays the first one (the others are in his list, not shown)
const WALLPAPERS = [
  'aria-beatrice-scintu',
  'aria-rachele-santoro',
  'aria-noemi-piunti',
  'aria-laura-tanushi',
  'aria-giulia-romanelli',
  'aria-rebecca-maurino',
  'aria-federica-bimbi',
  'aria-corinne-pino',
  'aria-clean-look',
  'aria-chiara-parente',
  'aria-chiara-chelo-spark',
  'aria-chiara-chelo',
]

/** The pop-up timing of the old choreography (before 2026-11-23): a saved project forgets it so the new one plays. */
const OLD_POPS = ['count', 'popAt', 'every', 'popDur', 'popEase', 'camLag', 'camDur', 'camEase', 'diveDur', 'diveEase']
export function forgetOldPops(scenes) {
  return (scenes || []).map((sc) =>
    sc.id !== 'communities'
      ? sc
      : { ...sc, shots: (sc.shots || []).map((sh) => (sh.type !== 'phone' ? sh : { ...sh, params: Object.fromEntries(Object.entries(sh.params || {}).filter(([k]) => !OLD_POPS.includes(k))) })) },
  )
}

export function continuumScenes() {
  return [
    {
      id: 'communities',
      type: 'communities',
      params: {},
      shots: [
        // the phone rests low (only its top in the frame), the two comments land, the camera goes down into it, no speed blur
        shot('communities', 'phone', 'From content to communities', 3.35, {
          size: 2.9, phoneH: 1.19, restTop: -0.8, riseAt: 0.59, tracking: -0.04, leading: 0.8, fromColor: 'ink',
          extra: 12, inY: 59, inAt: 0, inEase: 'ci.soft', finish: 'silver', zoom: 1.06, fadeBlur: 1.05, style: 'light',
          speedBlur: 0, wallpaper: [...WALLPAPERS],
          // the pop-ups and the run, redone 2026-11-23 ("più fluida"): these replace his
          // count 2, popAt 0.78, every 0.97, popDur 0.78, popEase ci.glide, camLag -0.13,
          // camDur 1.82, diveDur 0.99, diveEase ci.swift (the old choreography's timing)
          count: 3,
        }),
      ],
    },
    {
      id: 'beyond',
      type: 'beyond',
      params: {},
      shots: [
        // in capitals, line by line from the top (no mask), out word by word from the end; the push is there, off
        shot('insight', 'statement', 'We paired creators…', 1.7, {
          text: 'We paired creators with a powerful insight-led strategy', caps: true, weight: '400', size: 4.1, tracking: -0.01,
          align: 'center', measure: 1.24, leading: 1.2,
          inSplit: 'lines', inOrder: 'start', inAt: -0.25, inStagger: 0.094, inDur: 1.37, inEase: 'ci.reveal', inY: -115, inBlur: 26, inMask: false,
          outSplit: 'words', outOrder: 'end', outAt: -0.45, outStagger: 0.054, outDur: 1.15, outEase: 'ci.swift', outY: -110, outBlur: 30, outMask: false,
          pushOn: false, pushWords: 2, pushText: 'to drive record sales', pushAt: 1.05, pushDur: 0.7, pushEase: 'cubic(0.6,0,0.25,1)',
          outSweep: false, fromColor: 'lavender', color: 'ink', outScale: 0,
        }),
        shot('aria', 'carousel', 'Aria', 4.1, {
          videos: [...ARIA_SET], label: 'Aria', labelOn: false, cardH: 0.605, claimSize: 0.76, claimAt: 0.34, claimTextFace: '600',
          outLead: -0.11, radius: 1.61, spacing: 0.2, centerY: 0.245, tilt: -3, claimCaps: true,
        }),
        // word by word from the right while the wheel leaves to the left, in its wake
        shot('brief', 'text', 'We went beyond the brief…', 2.05, {
          text: 'We went beyond the brief and the product to transform the collections’ social perception', caps: false, weight: '400',
          size: 4.1, tracking: -0.01, align: 'center', measure: 1.24, leading: 1.2,
          inSplit: 'words', inOrder: 'start', inAt: -0.19, inStagger: 0.06, inDur: 0.78, inEase: 'cubic(0.1,0.75,0.2,1)', inX: 620, inY: 0,
          inBlur: 40, inOpacity: 0, inMask: false, inWake: true, outSweep: false,
          outSplit: 'lines', outOrder: 'start', outAt: -0.44, outStagger: 0.035, outDur: 0.34, outEase: 'ci.exit', outX: 0, outY: -110,
          outBlur: 30, outMask: false, motion: 0.9, fromColor: 'lime', color: 'ink',
        }),
        shot('externability', 'swipe', 'Externability', 2.9, {
          videos: [...EXT_SET], label: 'Externability', swipeDur: 0.32, turnAngle: -95, labelSize: 2.9, labelWeight: '500',
          labelTracking: 0.07, swipeEvery: 0.41, swipeAt: 0.8, swipeRot: 45, swipeLift: 0.5, riseDur: 0.05, turnLead: 0.78,
          turnDur: 0.55, turnEase: 'cubic(0.55,0,0.75,0.25)', turnShift: 0.35,
        }),
      ],
    },
    {
      id: 'closing',
      type: 'closing',
      params: {},
      shots: [
        shot('best', 'text', 'The best part?', 1.05, {
          text: 'The best part?', caps: true, weight: '500', size: 3.6, tracking: -0.005, measure: 1.7,
          inSplit: 'chars', inOrder: 'start', inAt: -0.39, inStagger: 0.022, inDur: 0.7, inX: 690, inY: -10, inBlur: 25, inMask: false,
          outSplit: 'chars', outOrder: 'start', outAt: -0.3, outStagger: 0.012, outDur: 0.3, outX: -60, outY: 0, outBlur: 25, outMask: true,
          inRot: 20, fromColor: 'lime',
        }),
        shot('started', 'text', 'We’re just getting started.', 1.65, {
          text: 'We’re just getting started.', caps: true, weight: '400', size: 5.6, tracking: -0.065, measure: 1.7,
          inSplit: 'words', inOrder: 'start', inAt: 0, inStagger: 0.075, inDur: 0.55, inX: 0, inY: 105, inBlur: 25, inMask: false,
          outOn: false, align: 'center', fromColor: 'lime',
        }),
      ],
    },
  ]
}
