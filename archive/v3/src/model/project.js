// The edit: scenes → shots (the blocks on the timeline) → effect parameters.
//
// Shots are sequential (a magnetic track, as in CapCut): each has only a
// duration, its start is the sum of everything before it. The scenes read the
// resolved times, so resizing a block retimes the animation inside it and
// ripples the rest of the film.
//
// A parameter spec: { k, label, t: 'num'|'bool'|'color'|'select'|'text'|'ease'|'videos', d: default, min, max, step, unit, opts }
// Effects group parameters the way Premiere's Effect Controls do; an effect with
// `on` gets a switch (the key of its boolean parameter).
//
// V3 (the campaign brief): two intros on keys 1 / 2 (A: the two logos; B:
// "Creators. Culture. Impact." then the logos) → the campaigns (311 creators,
// 5 campaigns, one shared vision: one video, a row, the grid that opens) → the
// numbers (four counters, "From content to communities", the comments as
// notifications the camera follows) → beyond numbers (two statements, each
// swept away by a carousel of its campaign: ARIA, Esternabilità) → "The best
// part? We're just getting started." → the logos. White throughout.

export const PALETTE = {
  paper: '#f3f1ec',
  white: '#ffffff',
  ink: '#0b0b0c',
  lime: '#c0ff33',
  lavender: '#b19aff',
  violet: '#8174f2',
  orange: '#f64414',
}
export const SWATCHES = ['violet', 'lavender', 'ink', 'white', 'paper', 'lime', 'orange']

const num = (k, label, d, min, max, step = 0.01, unit = '') => ({ k, label, t: 'num', d, min, max, step, unit })
const bool = (k, label, d) => ({ k, label, t: 'bool', d })
const color = (k, label, d) => ({ k, label, t: 'color', d })
const select = (k, label, d, opts) => ({ k, label, t: 'select', d, opts })
const text = (k, label, d) => ({ k, label, t: 'text', d })
const ez = (k, label, d) => ({ k, label, t: 'ease', d })
const weight = (k, label, d) => num(k, label, d, 300, 800, 10)
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
const ALIGN = [
  ['left', 'Sinistra'],
  ['center', 'Centro'],
  ['right', 'Destra'],
]

// ------------------------------------------------------------------ reusable effect blocks

/** The parameters of one phase of kinetic type (in = reveal, out = unreveal). */
function phase(pre, d = {}, atLabel) {
  const isIn = pre === 'in'
  return [
    select(pre + 'Split', 'Dividi per', d.split ?? 'words', SPLITS),
    select(pre + 'Order', 'Ordine dello stagger', d.order ?? 'start', ORDERS),
    num(pre + 'At', atLabel || (isIn ? 'Inizio (dall’inizio del blocco)' : 'Inizio (rispetto alla fine del blocco)'), d.at ?? (isIn ? 0 : -0.45), -3, 3, 0.01, 's'),
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

/** A block of type: copy + reveal + unreveal. o = defaults for this block. */
function typeFx(o = {}) {
  return [
    {
      id: 'copy',
      label: 'Testo',
      icon: 'text',
      params: [
        text('text', 'Testo', o.text ?? ''),
        weight('weight', 'Peso', o.weight ?? 400),
        num('size', 'Corpo (altezza maiuscole, % del lato corto)', o.size ?? 6, 1, 40, 0.1, '%'),
        num('tracking', 'Spaziatura', o.tracking ?? 0, -0.1, 0.4, 0.005),
        num('leading', 'Interlinea', o.leading ?? 1.08, 0.8, 2.2, 0.01),
        select('align', 'Allineamento', o.align ?? 'center', ALIGN),
        num('measure', 'Larghezza della riga (× lato corto)', o.measure ?? 0.88, 0.2, 2.6, 0.01),
        num('x', 'Posizione X (× metà frame)', o.x ?? 0, -1, 1, 0.005),
        num('y', 'Posizione Y (× metà frame, + = su)', o.y ?? 0, -1, 1, 0.005),
        color('fromColor', 'Colore di partenza (a opacità 0)', o.fromColor ?? 'violet'),
        color('color', 'Colore (a opacità 100)', o.color ?? 'ink'),
        num('motion', 'Motion blur', o.motion ?? 0.8, 0, 3, 0.05),
      ],
    },
    { id: 'in', label: 'Reveal', icon: 'arrow-up', params: phase('in', o.in) },
    {
      id: 'out',
      label: 'Unreveal',
      icon: 'arrow-up',
      on: 'outOn',
      params: [bool('outOn', 'Attivo', o.outOn ?? true), bool('outSweep', 'Spazzato via dal carosello che segue (parola per parola)', true), ...phase('out', o.out, o.outAtLabel)],
    },
  ]
}

/** The cube number + its subtitle (311 Creators, 5 campaigns). */
const numberFx = (value, label) => [
  {
    id: 'number',
    label: 'Numero · cubo in chars',
    icon: 'cube',
    params: [
      text('value', 'Valore', value),
      color('color', 'Colore', 'violet'),
      weight('weight', 'Peso', 400),
      num('size', 'Scala', 1, 0.4, 2),
      select('nSplit', 'Dividi per', 'chars', SPLITS),
      select('nOrder', 'Ordine', 'start', ORDERS),
      num('nAt', 'Inizio', 0, -1.5, 3, 0.01, 's'),
      num('nStagger', 'Stagger', 0.07, 0, 0.3, 0.002, 's'),
      num('nDur', 'Durata', 0.9, 0.1, 2.5, 0.01, 's'),
      ez('nEase', 'Ease', 'ci.swift'),
      num('nRot', 'Rotazione (90 = dal basso)', 90, -180, 180, 1, '°'),
      num('nDepth', 'Profondità del cubo', 0.5, 0, 2, 0.01),
      num('nBlur', 'Blur', 12, 0, 150, 1, '%'),
    ],
  },
  {
    id: 'label',
    label: 'Sottotitolo',
    icon: 'text',
    params: [
      text('label', 'Testo', label),
      color('labelColor', 'Colore', 'ink'),
      weight('labelWeight', 'Peso', 400),
      num('labelSize', 'Scala', 1, 0.4, 2),
      select('lSplit', 'Dividi per', 'chars', SPLITS),
      num('lAt', 'Inizio', 0.12, -1.5, 3, 0.01, 's'),
      num('lStagger', 'Stagger', 0.022, 0, 0.2, 0.002, 's'),
      num('lDur', 'Durata', 0.75, 0.1, 2, 0.01, 's'),
      ez('lEase', 'Ease', 'ci.reveal'),
      num('lY', 'Da Y (%, + = sotto)', 110, -400, 400, 1, '%'),
      num('lBlur', 'Blur', 20, 0, 150, 1, '%'),
      bool('lMask', 'Maschera', true),
    ],
  },
]

const lockupFx = (out = true) => [
  {
    id: 'layout',
    label: 'Composizione',
    icon: 'grid',
    params: [
      num('scale', 'Scala', 1, 0.4, 2),
      num('intiSize', 'intimissimi (× altezza di cooltura)', 1, 0.4, 1.8),
      num('xSize', '× · dimensione (× occhio di cooltura)', 0.56, 0.2, 2),
      num('xWeight', '× · spessore', 1, 0.3, 4),
      num('gap', 'Distanza dalla ×', 1, 0.2, 3),
      color('logoColor', 'Colore', 'ink'),
    ],
  },
  {
    id: 'cross',
    label: '× che si disegna',
    icon: 'xmark',
    params: [num('xAt', 'Inizio', 0.05, -1, 3, 0.01, 's'), num('xDur', 'Durata', 0.75, 0.1, 2.5, 0.01, 's'), ez('xEase', 'Ease', 'ci.reveal'), num('xSpin', 'Rotazione iniziale', 45, -180, 180, 1, '°')],
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
      num('cY', 'Da Y (% dell’altezza, + = sotto)', 105, -300, 300, 1, '%'),
      num('cBlur', 'Blur', 30, 0, 200, 1, '%'),
      bool('cMask', 'Maschera', true),
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
      num('iY', 'Da Y (% dell’altezza, + = sotto)', 105, -300, 300, 1, '%'),
      num('iBlur', 'Blur', 30, 0, 200, 1, '%'),
      bool('iMask', 'Maschera', true),
      num('frameAt', 'Cornice: inizio', 0.18, -1, 3, 0.01, 's'),
      num('frameDur', 'Cornice: durata', 1.0, 0.1, 3, 0.01, 's'),
      ez('frameEase', 'Cornice: ease', 'ci.glide'),
    ],
  },
  {
    id: 'fade',
    label: 'Uscita in opacità',
    icon: 'droplet',
    on: 'outOn',
    params: [bool('outOn', 'Attiva', out), num('outLead', 'Prima della fine del blocco', 0.5, 0, 3, 0.01, 's'), num('outDur', 'Durata', 0.5, 0.05, 2, 0.01, 's'), ez('outEase', 'Ease', 'power2.inOut'), num('outBlur', 'Blur', 18, 0, 200, 1, '%')],
  },
]

// ------------------------------------------------------------------ shot types

export const SHOT_TYPES = {
  lockup: { label: 'cooltura × intimissimi', effects: lockupFx(true) },
  text: { label: 'Testo', effects: typeFx() },
  creators: {
    label: 'Primo video + numero',
    effects: [
      {
        id: 'open',
        label: 'Primo video · scale up',
        icon: 'expand',
        params: [
          num('from', 'Scala iniziale', 0, 0, 1),
          num('scaleDur', 'Durata', 1.1, 0.2, 2.5, 0.01, 's'),
          ez('scaleEase', 'Ease', 'ci.glide'),
          num('parallax', 'Parallasse immagine', 0.45, 0, 1),
          num('margin', 'Margine bianco', 0.04, 0, 0.2, 0.005),
          num('radius', 'Raggio angoli', 0.045, 0, 0.2, 0.005),
          num('camAt', 'Zoom out camera: inizio', 0.6, 0, 3, 0.01, 's'),
          num('camDur', 'Zoom out camera: durata', 1.1, 0.2, 2.5, 0.01, 's'),
          ez('camEase', 'Zoom out camera: ease', 'ci.glide'),
        ],
      },
      ...numberFx('311', 'Creators'),
    ],
  },
  row: {
    label: 'Riga di video + numero',
    effects: [
      {
        id: 'row',
        label: 'La riga di video',
        icon: 'grid',
        params: [
          num('rowAt', 'Inizio', -0.1, -1, 2, 0.01, 's'),
          num('rowStagger', 'Stagger', 0.08, 0, 0.4, 0.005, 's'),
          num('rowDur', 'Durata di ogni video', 0.85, 0.1, 2, 0.01, 's'),
          ez('rowEase', 'Ease', 'ci.glide'),
          num('camDur', 'Zoom out camera', 1.15, 0.2, 2.5, 0.01, 's'),
          ez('camEase', 'Ease camera', 'ci.glide'),
        ],
      },
      ...numberFx('5', 'campaigns'),
    ],
  },
  vision: {
    label: 'Griglia · One shared vision',
    effects: [
      {
        id: 'grid',
        label: 'Tutti i video sulla griglia',
        icon: 'grid',
        params: [
          num('gridAt', 'Inizio', -0.05, -1, 2, 0.01, 's'),
          num('gridSpan', 'Stagger dal centro (tempo totale)', 0.75, 0, 2, 0.01, 's'),
          num('gridDur', 'Durata di ogni video', 0.75, 0.1, 2, 0.01, 's'),
          ez('gridEase', 'Ease', 'ci.reveal'),
          num('camDur', 'Zoom out camera', 1.25, 0.2, 3, 0.01, 's'),
          ez('camEase', 'Ease camera', 'ci.glide'),
        ],
      },
      {
        id: 'numOut',
        label: 'Uscita del numero',
        icon: 'cube',
        params: [
          num('numOutAt', 'Inizio', 0.05, -1, 2, 0.01, 's'),
          num('numOutDur', 'Durata', 0.65, 0.1, 2, 0.01, 's'),
          num('numOutStagger', 'Stagger', 0.05, 0, 0.3, 0.002, 's'),
          ez('numOutEase', 'Ease', 'ci.exit'),
          num('numOutRot', 'Rotazione (−90 = cubo in alto)', -90, -180, 180, 1, '°'),
        ],
      },
      {
        id: 'open',
        label: 'La riga centrale si apre',
        icon: 'fit',
        params: [
          num('openAt', 'Inizio', 0.8, 0, 3, 0.01, 's'),
          num('openDur', 'Durata', 0.9, 0.1, 2.5, 0.01, 's'),
          ez('openEase', 'Ease', 'ci.glide'),
          num('spread', 'Le altre righe si allargano (× video)', 0.22, 0, 1.5, 0.01),
        ],
      },
      ...typeFx({
        text: 'One shared vision',
        size: 6.4,
        weight: 400,
        in: { split: 'chars', order: 'start', at: 1.05, stagger: 0.035, dur: 0.85, y: 70, blur: 40, mask: false },
        out: { split: 'chars', order: 'start', at: -0.55, stagger: 0.018, dur: 0.5, y: -60, blur: 40, mask: false },
        outAtLabel: 'Inizio (rispetto alla fine di “Uscita video”)',
      }),
    ],
  },
  gridOut: {
    label: 'Uscita dei video',
    effects: [
      {
        id: 'tiles',
        label: 'I video escono dal centro verso l’esterno',
        icon: 'expand',
        params: [num('tilesAt', 'Inizio', 0, -1, 2, 0.01, 's'), num('tilesSpan', 'Stagger dal centro (tempo totale)', 0.42, 0, 2, 0.01, 's'), num('tilesDur', 'Durata di ogni video', 0.45, 0.05, 2, 0.01, 's'), ez('tilesEase', 'Ease', 'ci.exit')],
      },
    ],
  },
  stats: {
    label: 'Quattro numeri',
    effects: [
      {
        id: 'data',
        label: 'Numeri (somma delle campagne)',
        icon: 'hashtag',
        params: [
          text('v1', 'Valore 1', '9.8M+'),
          text('l1', 'Etichetta 1', 'views organiche'),
          text('v2', 'Valore 2', '60M'),
          text('l2', 'Etichetta 2', 'views paid'),
          text('v3', 'Valore 3', '+XX%'),
          text('l3', 'Etichetta 3', 'vs benchmark'),
          text('v4', 'Valore 4', '497K+'),
          text('l4', 'Etichetta 4', 'interactions'),
        ],
      },
      {
        id: 'style',
        label: 'Composizione',
        icon: 'grid',
        params: [
          color('color', 'Colore numeri', 'violet'),
          color('labelColor', 'Colore etichette', 'ink'),
          weight('weight', 'Peso numeri', 400),
          weight('labelWeight', 'Peso etichette', 400),
          num('size', 'Scala', 1, 0.4, 2),
          select('labelPos', 'Etichette', 'auto', [
            ['auto', 'Auto'],
            ['side', 'Accanto'],
            ['below', 'Sotto'],
          ]),
          num('rowGap', 'Distanza righe', 1, 0.5, 2),
        ],
      },
      {
        id: 'count',
        label: 'Counter · dynamic reveal',
        icon: 'gauge',
        params: [
          num('cAt', 'Inizio', 0.05, -1, 3, 0.01, 's'),
          num('rowStagger', 'Stagger righe', 0.17, 0, 0.6, 0.005, 's'),
          select('dOrder', 'Ordine cifre', 'end', ORDERS),
          num('digitStagger', 'Stagger cifre', 0.05, 0, 0.3, 0.002, 's'),
          num('cDur', 'Durata', 1.35, 0.2, 3, 0.01, 's'),
          ez('cEase', 'Ease', 'ci.emph'),
          num('spins', 'Giri', 7, 1, 30, 1),
          num('spinStep', 'Giri in più per cifra', 2, 0, 10, 1),
          num('cBlur', 'Blur iniziale', 35, 0, 200, 1, '%'),
          num('motion', 'Motion blur', 1, 0, 3, 0.05),
        ],
      },
      {
        id: 'labels',
        label: 'Etichette · reveal',
        icon: 'text',
        params: [
          select('lSplit', 'Dividi per', 'words', SPLITS),
          num('lAt', 'Ritardo sul numero', 0.25, -1, 2, 0.01, 's'),
          num('lStagger', 'Stagger', 0.05, 0, 0.3, 0.002, 's'),
          num('lDur', 'Durata', 0.8, 0.1, 2, 0.01, 's'),
          ez('lEase', 'Ease', 'ci.reveal'),
          num('lY', 'Da Y (%)', 110, -400, 400, 1, '%'),
          num('lBlur', 'Blur', 25, 0, 200, 1, '%'),
        ],
      },
      {
        id: 'exit',
        label: 'Uscita verso l’alto',
        icon: 'arrow-up',
        params: [
          num('exLead', 'Prima della fine del blocco', 0.6, 0, 3, 0.01, 's'),
          num('exStagger', 'Stagger righe', 0.07, 0, 0.4, 0.002, 's'),
          num('exDur', 'Durata', 0.6, 0.05, 2, 0.01, 's'),
          ez('exEase', 'Ease', 'ci.exit'),
          num('exY', 'Verso Y (%, − = alto)', -130, -600, 600, 1, '%'),
          num('exBlur', 'Blur', 40, 0, 200, 1, '%'),
          bool('exMask', 'Maschera', true),
        ],
      },
    ],
  },
  communities: {
    label: 'From content to communities',
    effects: [
      ...typeFx({
        text: 'From content to communities',
        size: 4.6,
        weight: 400,
        in: { split: 'words', order: 'start', at: 0.05, stagger: 0.07, dur: 0.85, y: 110, blur: 25, mask: true },
        outOn: false,
      }),
      {
        id: 'apart',
        label: 'Si apre per il numero',
        icon: 'fit',
        params: [
          num('splitAfter', 'Parole a sinistra', 2, 1, 8, 1),
          num('apartAt', 'Inizio', 0.75, 0, 3, 0.01, 's'),
          num('apartDur', 'Durata', 0.85, 0.1, 2.5, 0.01, 's'),
          ez('apartEase', 'Ease', 'ci.glide'),
          num('apartGap', 'Spazio tra le due parti (× numero)', 1.12, 0.5, 3, 0.01),
        ],
      },
      {
        id: 'comments',
        label: 'Numero dei commenti',
        icon: 'hashtag',
        params: [
          text('value', 'Valore', 'XXK'),
          text('label', 'Sottotitolo', 'commenti'),
          color('numColor', 'Colore numero', 'violet'),
          color('labelColor', 'Colore sottotitolo', 'ink'),
          weight('numWeight', 'Peso', 400),
          num('numSize', 'Scala', 1, 0.4, 2.5),
          num('numY', 'Sotto il centro (× lato corto)', 0.07, -0.5, 0.5, 0.005),
          num('cAt', 'Inizio counter', 0.95, -1, 3, 0.01, 's'),
          num('cDur', 'Durata', 1.2, 0.2, 3, 0.01, 's'),
          ez('cEase', 'Ease', 'ci.emph'),
          num('digitStagger', 'Stagger cifre', 0.05, 0, 0.3, 0.002, 's'),
          num('spins', 'Giri', 7, 1, 30, 1),
          num('cBlur', 'Blur iniziale', 35, 0, 200, 1, '%'),
          num('lAt', 'Sottotitolo: ritardo', 0.25, -1, 2, 0.01, 's'),
        ],
      },
    ],
  },
  comments: {
    label: 'Commenti · notifiche',
    effects: [
      {
        id: 'pop',
        label: 'Notifiche che arrivano',
        icon: 'bell',
        params: [
          num('count', 'Quante', 9, 2, 20, 1),
          num('popAt', 'Prima notifica', -0.15, -1.5, 2, 0.01, 's'),
          num('every', 'Intervallo iniziale', 0.4, 0.05, 1.2, 0.01, 's'),
          num('accel', 'Accelerazione (× a ogni notifica)', 0.8, 0.4, 1, 0.01),
          num('popDur', 'Durata', 0.6, 0.1, 1.5, 0.01, 's'),
          ez('popEase', 'Ease', 'ci.reveal'),
          num('popY', 'Da Y (% della card)', 45, -200, 300, 1, '%'),
          num('popScale', 'Scala iniziale', 0.92, 0.3, 1.2, 0.01),
          num('popBlur', 'Blur', 18, 0, 100, 1, '%'),
          num('motion', 'Motion blur', 1, 0, 3, 0.05),
          select('style', 'Materiale', 'light', [
            ['light', 'Chiaro'],
            ['dark', 'Scuro'],
          ]),
        ],
      },
      {
        id: 'follow',
        label: 'La camera segue',
        icon: 'camera',
        params: [num('followDur', 'Inseguimento', 0.6, 0.1, 2, 0.01, 's'), ez('followEase', 'Ease', 'ci.glide'), num('bottom', 'Margine in basso (× frame)', 0.1, 0, 0.4, 0.005)],
      },
      {
        id: 'dive',
        label: 'Transizione in blur',
        icon: 'gauge',
        params: [
          num('diveDur', 'Durata', 0.8, 0.1, 2.5, 0.01, 's'),
          ez('diveEase', 'Ease', 'ci.accel'),
          num('diveDist', 'Corsa (× frame)', 1.6, 0.2, 5, 0.01),
          num('speedBlur', 'Speed blur', 1, 0, 3, 0.05),
          num('fadeBlur', 'Sfocatura finale', 55, 0, 200, 1, '%'),
        ],
      },
      {
        id: 'layout',
        label: 'Colonna',
        icon: 'grid',
        params: [num('cardW', 'Larghezza (× lato corto)', 0.86, 0.3, 1.4, 0.01), num('gap', 'Distanza tra le card', 0.022, 0, 0.1, 0.001), num('firstGap', 'Distanza dal numero', 0.06, 0, 0.3, 0.005)],
      },
    ],
  },
  carousel: {
    label: 'Carosello circolare',
    effects: [
      { id: 'videos', label: 'Video del carosello', icon: 'film', params: [videos('videos', 'Video (in ordine di arrivo)', [], 'aria-')] },
      {
        id: 'wheel',
        label: 'Forma',
        icon: 'circle',
        params: [
          select('mode', 'Forma', 'wheel', [
            ['wheel', 'Semicerchio'],
            ['ring', 'Anello 3D'],
          ]),
          num('cardH', 'Altezza delle card (× frame)', 0.46, 0.15, 0.9, 0.005),
          num('radius', 'Raggio (× altezza card)', 2.6, 0.8, 8, 0.01),
          num('spacing', 'Distanza tra le card', 1.08, 0.7, 2.5, 0.01),
          num('centerY', 'Altezza (× metà frame)', 0, -0.8, 0.8, 0.005),
          num('corner', 'Raggio angoli', 0.06, 0, 0.3, 0.005),
          num('tilt', 'Anello: inclinazione', 10, -40, 40, 0.5, '°'),
        ],
      },
      {
        id: 'motion',
        label: 'Movimento',
        icon: 'rotate',
        params: [
          num('inAt', 'Inizio', -0.05, -1, 2, 0.01, 's'),
          num('inDur', 'Ingresso da destra', 1.45, 0.2, 3, 0.01, 's'),
          ez('inEase', 'Ease ingresso', 'ci.glide'),
          num('drift', 'Giro lento mentre le leggi (card al secondo)', 0.45, 0, 3, 0.01),
          num('outDur', 'Uscita a sinistra', 0.85, 0.1, 3, 0.01, 's'),
          ez('outEase', 'Ease uscita', 'ci.accel'),
          num('outLead', 'Uscita: prima della fine', 0.05, -1, 2, 0.01, 's'),
          num('motion', 'Motion blur', 0.8, 0, 3, 0.05),
        ],
      },
    ],
  },
}

const claimFx = {
  id: 'claim',
  label: 'Claim #1 su TikTok',
  icon: 'hashtag',
  on: 'claimOn',
  params: [
    bool('claimOn', 'Attivo', true),
    text('claimBig', 'Numero', '#1'),
    text('claim', 'Testo', 'result on TikTok search for the product category'),
    color('claimColor', 'Colore numero', 'violet'),
    color('claimTextColor', 'Colore testo', 'ink'),
    num('claimSize', 'Scala', 1, 0.4, 2),
    num('claimAt', 'Inizio', 1.0, -1, 3, 0.01, 's'),
    num('claimOut', 'Uscita: prima della fine', 0.7, 0, 3, 0.01, 's'),
  ],
}

// ------------------------------------------------------------------ scenes

export const SCENE_TYPES = {
  introA: { label: 'Intro A · logo', hue: '#ffffff', effects: [] },
  introB: { label: 'Intro B · statement', hue: '#c0ff33', effects: [] },
  campaigns: {
    label: 'Campaigns',
    hue: '#8174f2',
    effects: [
      {
        id: 'grid',
        label: 'Griglia di video',
        icon: 'grid',
        params: [
          num('rows', 'Righe', 7, 3, 11, 2),
          num('gap', 'Spazio tra i video', 0.07, 0.01, 0.3, 0.005),
          num('corner', 'Raggio angoli', 0.07, 0, 0.3, 0.005),
          num('speed', 'Scorrimento delle righe', 0.35, 0, 2, 0.01),
          bool('alternate', 'Righe alternate', true),
          num('gridView', 'Righe visibili a schermo', 4.2, 2, 9, 0.05),
        ],
      },
      { id: 'layout', label: 'Numero sui video', icon: 'hashtag', params: [num('numberSize', 'Scala numero', 1, 0.5, 1.6), num('overlap', 'Numero sopra i video', 0.42, 0, 1), num('bottom', 'Margine in basso', 0.085, 0.03, 0.25, 0.005)] },
    ],
  },
  numbers: { label: 'The numbers', hue: '#b19aff', effects: [] },
  beyond: { label: 'Beyond numbers', hue: '#f64414', effects: [] },
  closing: { label: 'Closing', hue: '#0b0b0c', effects: [] },
}

// ------------------------------------------------------------------ default film

const shot = (id, type, name, dur, params = {}) => ({ id, type, name, dur, params })

// carousels: the first six of each campaign, in this order (any of the folder can be added from the panel)
const ARIA_SET = ['aria-alessia-morelli', 'aria-aurora-pederzoli', 'aria-rachele-santoro', 'aria-chiara-chelo', 'aria-giulia-romanelli', 'aria-noemi-piunti']
const EXT_SET = ['ext-virginia-giva', 'ext-gaia-sgalia', 'ext-coco-genge', 'ext-gaia-amati', 'ext-benedetta-quagli', 'ext-elettra-lastra']

// the statement words of intro B: chars from y 50 in a mask, the next one pushes the last one up
const word = (txt) => ({
  text: txt,
  size: 13,
  weight: 400,
  inSplit: 'chars',
  inOrder: 'start',
  inAt: 0.02,
  inStagger: 0.026,
  inDur: 0.6,
  inEase: 'ci.reveal',
  inY: 50,
  inBlur: 22,
  inMask: true,
  outSplit: 'chars',
  outOrder: 'start',
  outAt: -0.26,
  outStagger: 0.022,
  outDur: 0.38,
  outEase: 'ci.exit',
  outY: -50,
  outBlur: 22,
  outMask: true,
  motion: 0.6,
})

const sentence = (txt) => ({
  text: txt,
  size: 4.3,
  weight: 400,
  align: 'left',
  measure: 0.9,
  leading: 1.16,
  inSplit: 'words',
  inOrder: 'start',
  inAt: 0.05,
  inStagger: 0.05,
  inDur: 0.9,
  inY: 110,
  inBlur: 22,
  inMask: true,
  outSplit: 'words',
  outOrder: 'end',
  outAt: -0.32,
  outStagger: 0.028,
  outDur: 0.42,
  outEase: 'ci.soft',
  outY: -110,
  outBlur: 30,
  outMask: true,
})

export function defaultProject() {
  return {
    version: 6,
    aspect: '9:16',
    intro: 'A',
    fps: 30,
    look: { grain: 0, vignette: 0 },
    scenes: [
      { id: 'intro-a', type: 'introA', when: 'A', params: {}, shots: [shot('logo', 'lockup', 'cooltura × intimissimi', 3.0)] },
      {
        id: 'intro-b',
        type: 'introB',
        when: 'B',
        params: {},
        shots: [
          shot('w-creators', 'text', 'Creators.', 0.52, word('Creators.')),
          shot('w-culture', 'text', 'Culture.', 0.5, word('Culture.')),
          shot('w-impact', 'text', 'Impact.', 0.56, word('Impact.')),
          shot('logo-b', 'lockup', 'cooltura × intimissimi', 1.42, { xAt: 0.06, xDur: 0.6, cAt: 0.14, cStagger: 0.04, cDur: 0.62, iAt: 0.18, iStagger: 0.035, iDur: 0.62, frameAt: 0.1, frameDur: 0.75, outLead: 0.4, outDur: 0.4 }),
        ],
      },
      {
        id: 'campaigns',
        type: 'campaigns',
        params: {},
        shots: [
          shot('creators', 'creators', '311 Creators', 1.7, { nAt: 0.62, lAt: 0.8 }),
          shot('campaigns', 'row', '5 campaigns', 1.35),
          shot('vision', 'vision', 'One shared vision', 2.1),
          shot('vision-out', 'gridOut', 'Uscita video', 0.65),
        ],
      },
      {
        id: 'numbers',
        type: 'numbers',
        params: {},
        shots: [shot('stats', 'stats', 'I numeri', 2.55), shot('communities', 'communities', 'From content to communities', 1.7), shot('comments', 'comments', 'Commenti', 2.15)],
      },
      {
        id: 'beyond',
        type: 'beyond',
        params: {},
        shots: [
          shot('beyond', 'text', 'Beyond numbers.', 1.2, {
            text: 'Beyond numbers.',
            size: 8.2,
            measure: 1.8,
            inSplit: 'words',
            inAt: -0.2,
            inStagger: 0.08,
            inDur: 1.0,
            inY: 40,
            inBlur: 90,
            inMask: false,
            inEase: 'ci.emph',
            outSplit: 'words',
            outAt: -0.4,
            outStagger: 0.05,
            outDur: 0.5,
            outY: -100,
            outBlur: 30,
            outMask: true,
          }),
          shot('insight', 'text', 'We paired creators…', 2.25, sentence('We paired creators with a powerful insight-led strategy to drive record sales')),
          shot('aria', 'carousel', 'ARIA', 2.4, { videos: ARIA_SET }),
          shot('brief', 'text', 'We went beyond the brief…', 2.25, sentence('We went beyond the brief and the product to transform the collections’ social perception')),
          shot('externability', 'carousel', 'Esternabilità', 2.3, { videos: EXT_SET }),
        ],
      },
      {
        id: 'closing',
        type: 'closing',
        params: {},
        shots: [
          shot('best', 'text', 'The best part?', 1.25, {
            text: 'The best part?',
            size: 7,
            x: 0.06,
            inSplit: 'chars',
            inOrder: 'start',
            inAt: 0,
            inStagger: 0.03,
            inDur: 0.8,
            inX: 50,
            inY: 0,
            inBlur: 25,
            inMask: true,
            outSplit: 'chars',
            outOrder: 'start',
            outAt: -0.42,
            outStagger: 0.016,
            outDur: 0.42,
            outX: -50,
            outY: 0,
            outBlur: 25,
            outMask: true,
          }),
          shot('started', 'text', 'We’re just getting started.', 1.6, {
            text: 'We’re just getting started.',
            size: 5.6,
            measure: 1.8,
            inSplit: 'chars',
            inOrder: 'start',
            inAt: 0.16,
            inStagger: 0.022,
            inDur: 0.8,
            inX: 50,
            inY: 0,
            inBlur: 25,
            inMask: true,
            outSplit: 'chars',
            outOrder: 'start',
            outAt: -0.48,
            outStagger: 0.011,
            outDur: 0.42,
            outX: -50,
            outY: 0,
            outBlur: 25,
            outMask: true,
          }),
          shot('outro', 'lockup', 'cooltura × intimissimi', 1.55, { outOn: false, xAt: 0.14, xDur: 0.6, cAt: 0.22, cStagger: 0.04, cDur: 0.65, iAt: 0.26, iStagger: 0.035, iDur: 0.65, frameAt: 0.18, frameDur: 0.8 }),
        ],
      },
    ],
  }
}

/** Extra effects only some shots have (the Aria claim). The externability carousel picks from its own folder. */
export function effectsOf(sh) {
  const base = SHOT_TYPES[sh.type]?.effects || []
  if (sh.type === 'carousel') {
    const pool = sh.id === 'externability' ? 'ext-' : 'aria-'
    const fx = base.map((f) => (f.id === 'videos' ? { ...f, params: f.params.map((p) => ({ ...p, pool })) } : f))
    return sh.id === 'aria' ? [...fx, claimFx] : fx
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

/**
 * Absolute times + parameters merged over their defaults. Only the chosen intro is in the film.
 * → { duration, scenes: [{ id, type, start, end, p, shots }], shots: [...], shot(id), scene(id) }
 */
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
