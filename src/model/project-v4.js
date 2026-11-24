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
// V4 · option 1, the 30 s recut (2026-11-22), set in PP Neue Machina, titles in
// capitals. Two intros on keys 1 / 2 (A: the two logotypes, intimissimi framed
// and as wide as cooltura*, the × on the centre of the frame; B: "Creators.
// Culture. Impact." then the logotypes) → the campaigns (one video and "311"
// centred under it; the other four videos come in from the right into a row,
// "5 campaigns" under it; the grid that opens on "One shared vision") → the four
// numbers as a table → then the continuum shared with V5 (model/continuum.js):
// the iPhone and the comments, "We paired creators…" (its last line pushed by the
// rest of the sentence), the Aria wheel, "We went beyond the brief…", the
// Externability cards, "The best part? We're just getting started."

import { FACES, SPLITS, ORDERS, num, bool, color, select, text, ez, face, typeFx, SHOT_TYPES as CONT_TYPES, SCENE_TYPES as CONT_SCENES, continuumEffects, continuumScenes, forgetOldPops } from './continuum.js'

export { FACES, SPLITS, ORDERS }

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

// ------------------------------------------------------------------ reusable effect blocks

/** The cube numeral + its caption (311 creators, 5 campaigns). */
const numberFx = (value, label) => [
  {
    id: 'number',
    label: 'Numero · cubo in chars',
    icon: 'cube',
    params: [
      text('value', 'Valore', value),
      color('fromColor', 'Colore di partenza', 'violet'),
      color('color', 'Colore', 'ink'),
      face('weight', 'Carattere', '340'),
      num('size', 'Scala', 1, 0.4, 2),
      select('nSplit', 'Dividi per', 'chars', SPLITS),
      select('nOrder', 'Ordine', 'start', ORDERS),
      num('nAt', 'Inizio', 0, -1.5, 4, 0.01, 's'),
      num('nStagger', 'Stagger', 0.06, 0, 0.3, 0.002, 's'),
      num('nDur', 'Durata', 0.78, 0.1, 2.5, 0.01, 's'),
      ez('nEase', 'Ease', 'ci.swift'),
      num('nRot', 'Rotazione (90 = dal basso)', 90, -180, 180, 1, '°'),
      num('nDepth', 'Profondità del cubo', 0.5, 0, 2, 0.01),
      num('nBlur', 'Blur', 12, 0, 150, 1, '%'),
    ],
  },
  {
    id: 'label',
    label: 'Didascalia',
    icon: 'text',
    params: [
      text('label', 'Testo', label),
      bool('labelCaps', 'Maiuscolo', true),
      color('labelColor', 'Colore', 'mute'),
      face('labelWeight', 'Carattere', '400'),
      num('labelSize', 'Scala', 0.8, 0.4, 2.5),
      num('labelTracking', 'Spaziatura lettere (em)', 0.14, -0.1, 0.4, 0.005),
      select('lSplit', 'Dividi per', 'chars', SPLITS),
      num('lAt', 'Inizio', 0.12, -1.5, 4, 0.01, 's'),
      num('lStagger', 'Stagger', 0.018, 0, 0.2, 0.002, 's'),
      num('lDur', 'Durata', 0.6, 0.1, 2, 0.01, 's'),
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
      num('intiWidth', 'intimissimi: larghezza (× quella di cooltura*)', 1, 0.4, 2, 0.005),
      bool('frameOn', 'intimissimi con la sua cornice (lo stroke del logotipo)', true),
      num('xSize', '× · dimensione (× occhio di cooltura)', 0.62, 0.2, 2),
      num('xWeight', '× · spessore (× lo stroke della cornice)', 1, 0.3, 4),
      num('gap', 'Distanza dalla ×', 1.3, 0.2, 3),
      color('logoColor', 'Colore', 'ink'),
    ],
  },
  {
    id: 'cross',
    label: '× che si disegna',
    icon: 'xmark',
    params: [num('xAt', 'Inizio', 0.05, -1, 3, 0.01, 's'), num('xDur', 'Durata', 0.6, 0.1, 2.5, 0.01, 's'), ez('xEase', 'Ease', 'ci.reveal'), num('xSpin', 'Rotazione iniziale', 0, -180, 180, 1, '°')],
  },
  {
    id: 'cool',
    label: 'cooltura · lettere da destra a sinistra',
    icon: 'signature',
    params: [
      select('cOrder', 'Ordine', 'end', ORDERS),
      num('cAt', 'Inizio', 0.14, -1, 3, 0.01, 's'),
      num('cStagger', 'Stagger', 0.045, 0, 0.3, 0.002, 's'),
      num('cDur', 'Durata', 0.68, 0.1, 2.5, 0.01, 's'),
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
      num('iAt', 'Inizio', 0.2, -1, 3, 0.01, 's'),
      num('iStagger', 'Stagger', 0.035, 0, 0.3, 0.002, 's'),
      num('iDur', 'Durata', 0.68, 0.1, 2.5, 0.01, 's'),
      ez('iEase', 'Ease', 'ci.reveal'),
      num('iY', 'Da Y (% dell’altezza, + = sotto)', 105, -300, 300, 1, '%'),
      num('iBlur', 'Blur', 30, 0, 200, 1, '%'),
      bool('iMask', 'Maschera', true),
      num('fAt', 'Cornice: compare da', 0.16, -1, 3, 0.01, 's'),
      num('fDur', 'Cornice: durata (opacità)', 0.55, 0.05, 2.5, 0.01, 's'),
    ],
  },
  {
    id: 'fade',
    label: 'Uscita in opacità',
    icon: 'droplet',
    on: 'outOn',
    params: [bool('outOn', 'Attiva', out), num('outLead', 'Prima della fine del blocco', 0.42, 0, 3, 0.01, 's'), num('outDur', 'Durata', 0.38, 0.05, 2, 0.01, 's'), ez('outEase', 'Ease', 'sine.inOut'), num('outBlur', 'Blur', 0, 0, 200, 1, '%')],
  },
]

// ------------------------------------------------------------------ shot types

export const SHOT_TYPES = {
  lockup: { label: 'cooltura × intimissimi', effects: lockupFx(true) },
  ...CONT_TYPES,
  creators: {
    label: 'Primo video + numero',
    effects: [
      {
        id: 'open',
        label: 'Primo video · scale up',
        icon: 'expand',
        params: [
          num('from', 'Scala iniziale', 0, 0, 1),
          num('scaleDur', 'Durata', 0.9, 0.2, 2.5, 0.01, 's'),
          ez('scaleEase', 'Ease', 'ci.glide'),
          num('parallax', 'Parallasse immagine', 0.45, 0, 1),
          num('margin', 'Margine bianco', 0.04, 0, 0.2, 0.005),
          num('radius', 'Raggio angoli', 0.045, 0, 0.2, 0.005),
          num('camAt', 'Zoom out camera: inizio (prima resta a tutto schermo)', 0.95, 0, 3, 0.01, 's'),
          num('camDur', 'Zoom out camera: durata', 0.9, 0.2, 2.5, 0.01, 's'),
          ez('camEase', 'Zoom out camera: ease', 'ci.glide'),
        ],
      },
      ...numberFx('311', 'creators'),
    ],
  },
  row: {
    label: 'Gli altri quattro video + numero',
    effects: [
      {
        id: 'row',
        label: 'Gli altri quattro video arrivano da destra',
        icon: 'arrow-left',
        params: [
          num('rowAt', 'Inizio', 0.06, -1, 2, 0.01, 's'),
          num('rowStagger', 'Stagger', 0.07, 0, 0.4, 0.005, 's'),
          num('rowDur', 'Durata del viaggio', 1.05, 0.2, 3, 0.01, 's'),
          ez('rowEase', 'Ease', 'cubic(0.2,0.7,0.15,1)'),
          num('rowSpread', 'Arrivano distanziati (× passo), poi si stringono', 0.55, 0, 3, 0.01),
          num('rowFill', 'Cinque video occupano (× larghezza del frame)', 0.84, 0.4, 1, 0.01),
          num('camDur', 'Zoom out camera', 0.95, 0.2, 2.5, 0.01, 's'),
          ez('camEase', 'Ease camera', 'ci.glide'),
        ],
      },
      {
        id: 'prev',
        label: 'Uscita di 311 (prima della riga)',
        icon: 'cube',
        params: [
          num('prevAt', 'Inizio', 0, -1, 2, 0.01, 's'),
          num('prevDur', 'Durata', 0.42, 0.1, 2, 0.01, 's'),
          num('prevStagger', 'Stagger', 0.045, 0, 0.3, 0.002, 's'),
          ez('prevEase', 'Ease', 'ci.exit'),
          num('prevRot', 'Rotazione (−90 = cubo in alto)', -90, -180, 180, 1, '°'),
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
          num('gridAt', 'Inizio', 0.18, -1, 2, 0.01, 's'),
          num('gridSpan', 'Stagger dal centro (tempo totale)', 0.7, 0, 2, 0.01, 's'),
          num('gridDur', 'Durata di ogni video', 0.7, 0.1, 2, 0.01, 's'),
          ez('gridEase', 'Ease', 'ci.reveal'),
          num('camDur', 'Zoom out camera', 1.05, 0.2, 3, 0.01, 's'),
          ez('camEase', 'Ease camera', 'ci.glide'),
        ],
      },
      {
        id: 'numOut',
        label: 'Uscita del numero',
        icon: 'cube',
        params: [
          num('numOutAt', 'Inizio', 0, -1, 2, 0.01, 's'),
          num('numOutDur', 'Durata', 0.42, 0.1, 2, 0.01, 's'),
          num('numOutStagger', 'Stagger', 0.045, 0, 0.3, 0.002, 's'),
          ez('numOutEase', 'Ease', 'ci.exit'),
          num('numOutRot', 'Rotazione (−90 = cubo in alto)', -90, -180, 180, 1, '°'),
        ],
      },
      {
        id: 'open',
        label: 'La riga centrale si apre',
        icon: 'fit',
        params: [
          num('openAt', 'Inizio', 1.08, 0, 4, 0.01, 's'),
          num('openDur', 'Durata', 0.8, 0.1, 2.5, 0.01, 's'),
          ez('openEase', 'Ease', 'ci.glide'),
          num('spread', 'Le altre righe si allargano (× video)', 0.32, 0, 1.5, 0.01),
        ],
      },
      ...typeFx({
        text: 'One shared vision',
        caps: true,
        weight: '400',
        size: 5.6,
        measure: 1.7,
        tracking: -0.005,
        in: { split: 'chars', order: 'start', at: 1.32, stagger: 0.026, dur: 0.66, y: 70, blur: 40, mask: false },
        out: { split: 'chars', order: 'start', at: -0.42, stagger: 0.014, dur: 0.4, y: -60, blur: 40, mask: false },
        outAtLabel: 'Inizio (rispetto alla fine di “Uscita video”)',
        outSweep: false,
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
        params: [num('tilesAt', 'Inizio', 0, -1, 2, 0.01, 's'), num('tilesSpan', 'Stagger dal centro (tempo totale)', 0.32, 0, 2, 0.01, 's'), num('tilesDur', 'Durata di ogni video', 0.4, 0.05, 2, 0.01, 's'), ez('tilesEase', 'Ease', 'ci.exit')],
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
          text('l1', 'Etichetta 1', 'organic views'),
          text('v2', 'Valore 2', '60M'),
          text('l2', 'Etichetta 2', 'paid views'),
          text('v3', 'Valore 3', '+XX%'),
          text('l3', 'Etichetta 3', 'vs benchmark'),
          text('v4', 'Valore 4', '497K+'),
          text('l4', 'Etichetta 4', 'interactions'),
        ],
      },
      {
        id: 'style',
        label: 'Composizione · una tabella',
        icon: 'grid',
        params: [
          color('fromColor', 'Colore di partenza dei numeri', 'violet'),
          color('color', 'Colore numeri', 'ink'),
          color('labelColor', 'Colore etichette', 'mute'),
          face('weight', 'Carattere numeri', '340'),
          face('labelWeight', 'Carattere etichette', '400'),
          bool('labelCaps', 'Etichette in maiuscolo', true),
          num('labelTracking', 'Etichette: spaziatura (em)', 0.14, -0.05, 0.4, 0.005),
          num('size', 'Numeri: corpo (% del lato corto)', 6.2, 2, 20, 0.1, '%'),
          num('labelSize', 'Etichette: corpo (% del lato corto)', 1.75, 0.8, 8, 0.05, '%'),
          select('labelPos', 'Etichette', 'side', [
            ['side', 'Accanto'],
            ['below', 'Sotto'],
          ]),
          num('gutter', 'Spazio tra numero ed etichetta (× numero)', 0.42, 0.1, 2, 0.01),
          num('rowGap', 'Distanza tra le righe (× numero)', 1.62, 1, 3, 0.01),
        ],
      },
      {
        id: 'count',
        label: 'Counter · dynamic reveal',
        icon: 'gauge',
        params: [
          num('cAt', 'Inizio', -0.12, -1, 3, 0.01, 's'),
          num('rowStagger', 'Stagger righe', 0.16, 0, 0.8, 0.005, 's'),
          select('dOrder', 'Ordine cifre', 'end', ORDERS),
          num('digitStagger', 'Stagger cifre', 0.045, 0, 0.3, 0.002, 's'),
          num('cDur', 'Durata', 1.05, 0.2, 3, 0.01, 's'),
          ez('cEase', 'Ease', 'ci.emph'),
          num('spins', 'Giri', 5, 1, 30, 1),
          num('spinStep', 'Giri in più per cifra', 1, 0, 10, 1),
          num('cBlur', 'Blur iniziale', 30, 0, 200, 1, '%'),
          num('motion', 'Motion blur', 1, 0, 3, 0.05),
        ],
      },
      {
        id: 'labels',
        label: 'Etichette · reveal',
        icon: 'text',
        params: [
          select('lSplit', 'Dividi per', 'words', SPLITS),
          num('lAt', 'Ritardo sul numero', 0.22, -1, 2, 0.01, 's'),
          num('lStagger', 'Stagger', 0.04, 0, 0.3, 0.002, 's'),
          num('lDur', 'Durata', 0.6, 0.1, 2, 0.01, 's'),
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
          num('exLead', 'Prima della fine del blocco', 0.5, 0, 3, 0.01, 's'),
          num('exStagger', 'Stagger righe', 0.045, 0, 0.4, 0.002, 's'),
          num('exDur', 'Durata', 0.42, 0.05, 2, 0.01, 's'),
          ez('exEase', 'Ease', 'ci.exit'),
          num('exY', 'Verso Y (%, − = alto)', -130, -600, 600, 1, '%'),
          num('exBlur', 'Blur', 40, 0, 200, 1, '%'),
          bool('exMask', 'Maschera', true),
        ],
      },
    ],
  },
}

// ------------------------------------------------------------------ scenes

// the campaign's four blocks are one choreography (actors/grid.js): they move and go with their scene only
for (const k of ['creators', 'row', 'vision', 'gridOut']) SHOT_TYPES[k].bound = true

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
          num('speed', 'Scorrimento delle righe', 0.25, 0, 2, 0.01),
          bool('alternate', 'Righe alternate', true),
          num('gridView', 'Righe visibili a schermo', 4.2, 2, 9, 0.05),
        ],
      },
      {
        id: 'layout',
        label: 'Numeri e video',
        icon: 'hashtag',
        params: [
          select('numberSide', '311: il numero', 'below', [
            ['below', 'Sotto il video, al centro'],
            ['auto', 'Accanto nel largo, sotto nello stretto'],
            ['side', 'Accanto al video'],
          ]),
          num('numberSize', 'Scala numero', 0.62, 0.3, 1.6),
          num('numberGap', 'Distanza dai video (× frame)', 0.035, 0, 0.2, 0.005),
          num('margin', 'Margine sopra e sotto (× frame)', 0.07, 0, 0.2, 0.005),
        ],
      },
    ],
  },
  numbers: { label: 'The numbers', hue: '#b19aff', effects: [] },
  ...CONT_SCENES,
}

// ------------------------------------------------------------------ default film

const shot = (id, type, name, dur, params = {}) => ({ id, type, name, dur, params })

// the words of intro B: chars from y 50 in a mask, the next one pushes the last one up
const word = (txt) => ({
  text: txt,
  caps: true,
  weight: '400',
  size: 9,
  tracking: -0.01,
  inSplit: 'chars',
  inOrder: 'start',
  inAt: 0.02,
  inStagger: 0.024,
  inDur: 0.52,
  inEase: 'ci.reveal',
  inY: 50,
  inBlur: 22,
  inMask: true,
  outSplit: 'chars',
  outOrder: 'start',
  outAt: -0.22,
  outStagger: 0.02,
  outDur: 0.34,
  outEase: 'ci.exit',
  outY: -50,
  outBlur: 22,
  outMask: true,
  outSweep: false,
  motion: 0.6,
})

/** A saved project of an older version brought up to this one (9 → 10: the pop-ups redone, their old timing forgotten). */
export function migrate(saved) {
  if (!saved || saved.version !== 9) return saved
  return { ...saved, version: 10, scenes: forgetOldPops(saved.scenes) }
}

export function defaultProject() {
  return {
    version: 10,
    aspect: '16:9',
    intro: 'A',
    fps: 30,
    target: 30,
    look: { grain: 0, vignette: 0, plainZero: true },
    scenes: [
      { id: 'intro-a', type: 'introA', when: 'A', params: {}, shots: [shot('logo', 'lockup', 'cooltura × intimissimi', 2.15)] },
      {
        id: 'intro-b',
        type: 'introB',
        when: 'B',
        params: {},
        shots: [
          shot('w-creators', 'text', 'Creators.', 0.46, word('Creators.')),
          shot('w-culture', 'text', 'Culture.', 0.44, word('Culture.')),
          shot('w-impact', 'text', 'Impact.', 0.48, word('Impact.')),
          shot('logo-b', 'lockup', 'cooltura × intimissimi', 1.32, { xAt: 0.04, xDur: 0.55, cAt: 0.1, cStagger: 0.035, cDur: 0.58, iAt: 0.14, iStagger: 0.03, iDur: 0.58, fAt: 0.1, outLead: 0.36, outDur: 0.34 }),
        ],
      },
      // his tuning (the JSON of 2026-11-23, every value as is, in its key order)
      {
        id: 'campaigns',
        type: 'campaigns',
        params: { numberGap: 0.165 },
        shots: [
          shot('creators', 'creators', '311 Creators', 2.1, {
            nAt: 0.77, lAt: 1.36, from: 0, scaleEase: 'expo.out', camAt: 0.68, parallax: 0.47, labelSize: 0.65, labelTracking: 0.315,
            labelColor: 'ink', lSplit: 'words', camDur: 0.91, scaleDur: 0.78, nDur: 0.69,
          }),
          shot('campaigns', 'row', '5 campaigns', 1.4, {
            nAt: 0.35, lAt: 0.92, rowAt: 0.03, prevAt: 0.45, prevDur: 0.12, rowEase: 'circ.inOut', rowDur: 0.86, rowFill: 0.84,
            rowSpread: 0.49, labelTracking: 0.315, labelSize: 0.65, labelColor: 'ink', lBlur: 21, lSplit: 'words',
          }),
          shot('vision', 'vision', 'One shared vision', 1.8, {
            camDur: 1.92, openAt: 0.8, openDur: 1.37, openEase: 'expo.inOut', spread: 0, size: 3.5, gridAt: 0.2, numOutDur: 0.42,
            numOutAt: 0, numOutStagger: 0.045, numOutEase: 'ci.exit', numOutRot: -90, tracking: -0.07, inAt: 1.33, inDur: 0.8,
          }),
          shot('vision-out', 'gridOut', 'Uscita video', 0.85, { tilesAt: -0.54 }),
        ],
      },
      { id: 'numbers', type: 'numbers', params: {}, shots: [shot('stats', 'stats', 'I numeri', 2.05, { exMask: false })] },
      ...continuumScenes(),
    ],
  }
}

/** Extra effects only some shots have (the Aria claim; each carousel picks from its own folder). */
export function effectsOf(sh) {
  return continuumEffects(sh) || SHOT_TYPES[sh.type]?.effects || []
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

// ------------------------------------------------------------------ edition

export const EDITION = { id: 'v4', label: 'Opzione 1 · logo', page: './' }
export const STORE_KEY = 'cooltura-intimissimi.project.v9'
/** The global look (panel shown when no block is selected). */
export const LOOK = {
  fx: {
    id: 'look',
    label: 'Look globale',
    icon: 'sliders',
    params: [bool('plainZero', 'Zero senza barra (Neue Machina ss12)', true), num('grain', 'Grana', 0, 0, 0.12, 0.002), num('vignette', 'Vignetta', 0, 0, 0.6, 0.01)],
  },
  defaults: { grain: 0, vignette: 0, plainZero: true },
}
