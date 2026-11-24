// The edit: scenes → shots (the blocks on the timeline) → effect parameters.
//
// Shots are sequential (a magnetic track, as in CapCut): each has only a
// duration, its start is the sum of everything before it. The scenes read the
// resolved times, so resizing a block retimes the animation inside it and
// ripples the rest of the film.
//
// A parameter spec: { k, label, t: 'num'|'bool'|'color'|'select'|'text'|'ease', d: default, min, max, step, unit, opts }
// Effects group parameters the way Premiere's Effect Controls do; an effect with
// `on` gets a switch (the key of its boolean parameter).
//
// V2 (from Enrico's notes on V1): no lockup, the film opens on the first video;
// white throughout (violet only for the roadmap); flat violet numbers, lighter;
// the videos join step by step (1 → 3 → the row → the sphere); an orderly pile;
// the iPhone at once, "made for / externability"; real light beams + dust;
// realistic notifications and a camera that closes in; an all-caps semibold
// title; counters instead of the bounce; the roadmap straight from the wipe;
// the logotype as in the Cooltura reel. Every ease is a smooth one.

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

// ------------------------------------------------------------------ shot types

const statFx = (value, label) => [
  {
    id: 'number',
    label: 'Numero',
    icon: 'hashtag',
    params: [text('value', 'Valore', value), color('color', 'Colore', 'violet'), weight('weight', 'Peso', 400), num('size', 'Scala', 1, 0.5, 1.5)],
  },
  {
    id: 'roll',
    label: 'Ruota (cambio numero)',
    icon: 'rotate',
    params: [
      select('axis', 'Asse', 'x', [['x', 'X · dal basso'], ['y', 'Y · di lato']]),
      num('angle', 'Angolo', 90, 30, 180, 1, '°'),
      num('rollDur', 'Durata', 0.75, 0.15, 1.5, 0.01, 's'),
      num('digitStagger', 'Stagger cifre', 0.06, 0, 0.2, 0.005, 's'),
      ez('rollEase', 'Ease', 'power3.inOut'),
    ],
  },
  {
    id: 'label',
    label: 'Sottotitolo',
    icon: 'text',
    params: [text('label', 'Testo', label), color('labelColor', 'Colore', 'ink'), weight('labelWeight', 'Peso', 400), num('labelSize', 'Scala', 1, 0.5, 1.8)],
  },
  {
    id: 'videos',
    label: 'Video che si aggiungono',
    icon: 'grid',
    params: [
      num('videoDur', 'Durata ingresso', 0.95, 0.2, 2, 0.01, 's'),
      num('videoStagger', 'Stagger', 0.5, 0, 1),
      ez('videoEase', 'Ease', 'power3.inOut'),
      num('cameraDur', 'Zoom out camera', 1.15, 0.2, 2.5, 0.01, 's'),
      ez('cameraEase', 'Ease camera', 'power3.inOut'),
    ],
  },
]

const firstStatFx = [
  {
    id: 'zoom',
    label: 'Zoom out del numero',
    icon: 'expand',
    params: [num('zoomFrom', 'Parte da (× la sua misura)', 2.4, 1, 5), num('zoomDur', 'Durata', 1.1, 0.2, 2, 0.01, 's'), ez('zoomEase', 'Ease', 'power3.out')],
  },
  {
    id: 'icons',
    label: 'Icone 3D Instagram + TikTok',
    icon: 'icons',
    on: 'iconsOn',
    params: [bool('iconsOn', 'Attive', true), num('iconSize', 'Scala', 1, 0.4, 2), num('iconFloat', 'Rotazione', 1, 0, 3)],
  },
]

const viewFx = (value, label) => [
  {
    id: 'value',
    label: 'Valore',
    icon: 'hashtag',
    params: [text('value', 'Valore', value), text('label', 'Sottotitolo', label), color('color', 'Colore', 'violet'), color('labelColor', 'Colore sottotitolo', 'ink'), weight('weight', 'Peso', 400)],
  },
  {
    id: 'enter',
    label: 'Ingresso dal basso',
    icon: 'arrow-up',
    params: [num('enterDur', 'Durata', 0.95, 0.2, 1.6, 0.01, 's'), ez('enterEase', 'Ease', 'expo.out'), bool('odometer', 'Cifre a rullo', true), num('charStagger', 'Stagger cifre', 0.05, 0, 0.15, 0.005, 's')],
  },
]

const pinFx = (name, count, date) => [
  {
    id: 'pin',
    label: 'Tappa',
    icon: 'location',
    params: [text('name', 'Nome', name), text('count', 'Contenuti', count), text('date', 'Data', date)],
  },
  {
    id: 'arrive',
    label: 'Arrivo',
    icon: 'camera',
    params: [num('travel', 'Viaggio (quota del blocco)', 0.42, 0.15, 0.9), ez('travelEase', 'Ease camera', 'power2.inOut'), num('drawDur', 'Disegno cerchio', 0.55, 0.15, 1.2, 0.01, 's'), ez('drawEase', 'Ease cerchio', 'power2.inOut')],
  },
]

const logoFx = (logoCol, discCol) => ({
  id: 'logo3d',
  label: 'Logo 3D “c?”',
  icon: 'cube',
  params: [color('logoColor', 'Colore logo', logoCol), color('discColor', 'Colore cerchio', discCol), num('spin', 'Giri in ingresso', 1, 0, 3, 0.25), num('logoDepth', 'Spessore', 0.24, 0.04, 0.6)],
})

export const SHOT_TYPES = {
  open: {
    label: 'Video · scale up',
    effects: [
      {
        id: 'scale',
        label: 'Scale up',
        icon: 'expand',
        params: [num('from', 'Scala iniziale', 0.36, 0.05, 1), num('scaleDur', 'Durata', 1.2, 0.2, 2.5, 0.01, 's'), ez('scaleEase', 'Ease', 'power3.inOut'), num('parallax', 'Parallasse immagine', 0.45, 0, 1)],
      },
      { id: 'card', label: 'Card', icon: 'mobile', params: [num('margin', 'Margine bianco', 0.04, 0, 0.2, 0.005), num('radius', 'Raggio angoli', 0.045, 0, 0.2, 0.005)] },
    ],
  },
  stat: { label: 'Numero', effects: statFx('2', 'piattaforme') },
  stack: {
    label: 'Video in pila',
    effects: [
      {
        id: 'deck',
        label: 'Pila ordinata',
        icon: 'layer',
        params: [
          num('retract', 'Le altre righe rientrano', 0.4, 0.1, 0.8),
          num('cards', 'Card per lato', 3, 2, 6, 1),
          num('slide', 'Scivolata di ogni card', 0.2, 0.08, 0.5),
          ez('slideEase', 'Ease scivolata', 'power3.inOut'),
          ez('growEase', 'Ease della pila che diventa schermo', 'power3.inOut'),
        ],
      },
    ],
  },
  phone: {
    label: 'iPhone',
    effects: [
      { id: 'appear', label: 'iPhone che si forma', icon: 'mobile', params: [num('appearDur', 'Durata', 0.5, 0.1, 1.2, 0.01, 's'), ez('appearEase', 'Ease', 'power3.out')] },
      {
        id: 'words',
        label: 'Testi ai lati',
        icon: 'text',
        params: [
          text('left', 'Sinistra', 'made for'),
          text('right', 'Destra', 'externability'),
          weight('weight', 'Peso', 400),
          color('color', 'Colore', 'ink'),
          num('size', 'Scala', 1, 0.5, 1.6),
          select('split', 'Dividi per', 'chars', [['chars', 'Lettere'], ['words', 'Parole']]),
        ],
      },
      {
        id: 'reveal',
        label: 'Reveal',
        icon: 'arrow-up',
        params: [num('inAt', 'Inizio', 0.32, 0, 1.5, 0.01, 's'), num('charStagger', 'Stagger', 0.03, 0, 0.12, 0.002, 's'), num('charDur', 'Durata', 0.65, 0.15, 1.2, 0.01, 's'), ez('inEase', 'Ease', 'power3.out')],
      },
      {
        id: 'unreveal',
        label: 'Unreveal',
        icon: 'arrow-up',
        params: [num('outLead', 'Prima della fine', 0.95, 0.3, 2, 0.01, 's'), num('outStagger', 'Stagger', 0.022, 0, 0.12, 0.002, 's'), num('outDur', 'Durata', 0.42, 0.15, 1, 0.01, 's'), ez('outEase', 'Ease', 'power3.in')],
      },
      {
        id: 'pose',
        label: 'Verso destra',
        icon: 'arrow-right',
        params: [
          num('moveDur', 'Durata', 1, 0.3, 1.8, 0.01, 's'),
          ez('moveEase', 'Ease', 'power3.inOut'),
          num('tiltX', 'Tilt X', -7, -40, 40, 0.5, '°'),
          num('tiltY', 'Tilt Y', -20, -60, 60, 0.5, '°'),
          num('tiltZ', 'Tilt Z', 2, -20, 20, 0.5, '°'),
        ],
      },
    ],
  },
  view: { label: 'Views', effects: viewFx('70M', 'views complessive') },
  notifs: {
    label: 'Notifiche iOS',
    effects: [
      {
        id: 'front',
        label: 'iPhone davanti',
        icon: 'mobile',
        params: [num('frontDur', 'Durata movimento', 0.95, 0.2, 1.6, 0.01, 's'), ez('frontEase', 'Ease', 'power3.inOut'), num('phoneFill', 'Larghezza a schermo', 0.84, 0.5, 1.2)],
      },
      { id: 'zoom', label: 'Zoom verso il telefono', icon: 'zoom-in', params: [num('zoomTo', 'Zoom', 1.28, 1, 2), ez('zoomEase', 'Ease', 'sine.inOut')] },
      {
        id: 'pop',
        label: 'Notifiche',
        icon: 'bell',
        params: [
          num('count', 'Quante', 6, 2, 10, 1),
          num('every', 'Ogni', 0.3, 0.1, 0.8, 0.01, 's'),
          num('popDur', 'Durata', 0.6, 0.2, 1.2, 0.01, 's'),
          ez('popEase', 'Ease', 'expo.out'),
          select('style', 'Materiale', 'light', [['light', 'Chiaro'], ['dark', 'Scuro']]),
          bool('clock', 'Ora sul blocco schermo', true),
        ],
      },
    ],
  },
  dive: {
    label: 'Tuffo nei commenti',
    effects: [
      { id: 'zoom', label: 'Zoom nello schermo', icon: 'expand', params: [num('zoom', 'Zoom', 1.6, 1, 2.5), ez('zoomEase', 'Ease', 'power3.inOut')] },
      {
        id: 'speed',
        label: 'Velocità + motion blur',
        icon: 'gauge',
        params: [num('extra', 'Commenti in corsa', 10, 2, 16, 1), ez('speedEase', 'Ease', 'power3.in'), num('blur', 'Motion blur', 1, 0, 3)],
      },
      { id: 'fade', label: 'Dissolvenza sfocata', icon: 'droplet', params: [num('fadeFrom', 'Inizio', 0.45, 0, 0.95), num('fadeBlur', 'Sfocatura', 1, 0, 3)] },
    ],
  },
  headline: {
    label: 'Titolo',
    effects: [
      {
        id: 'copy',
        label: 'Testo',
        icon: 'text',
        params: [
          text('text', 'Titolo', 'La forza delle nostre campagne in numeri'),
          bool('caps', 'Tutto maiuscolo', true),
          weight('weight', 'Peso (600 = semibold)', 600),
          num('size', 'Scala', 1, 0.5, 1.6),
          num('tracking', 'Spaziatura', 0.01, -0.05, 0.15, 0.005),
        ],
      },
      {
        id: 'in',
        label: 'Ingresso',
        icon: 'arrow-up',
        params: [
          select('split', 'Dividi per', 'words', [['words', 'Parole'], ['chars', 'Lettere'], ['lines', 'Righe']]),
          num('lead', 'Anticipo sul tuffo', 0.3, 0, 0.8, 0.01, 's'),
          num('tilt', 'Tilt X', 70, 0, 110, 1, '°'),
          num('rise', 'Salita', 0.9, 0, 3),
          num('stagger', 'Stagger', 0.06, 0, 0.3, 0.005, 's'),
          num('inDur', 'Durata', 0.85, 0.2, 1.6, 0.01, 's'),
          ez('inEase', 'Ease', 'power3.out'),
          color('fromColor', 'Colore di partenza', 'violet'),
          color('toColor', 'Colore finale', 'ink'),
        ],
      },
      {
        id: 'out',
        label: 'Uscita in righe',
        icon: 'arrow-up',
        params: [num('outDur', 'Durata', 0.55, 0.15, 1.2, 0.01, 's'), num('outStagger', 'Stagger righe', 0.07, 0, 0.3, 0.005, 's'), ez('outEase', 'Ease', 'power3.in')],
      },
    ],
  },
  campaigns: {
    label: 'Campagne',
    effects: [
      {
        id: 'data',
        label: 'Dati',
        icon: 'hashtag',
        params: [
          text('v1', 'Valore 1', '47M'), text('n1', 'Campagna 1', 'ARIA'),
          text('v2', 'Valore 2', '17.9M'), text('n2', 'Campagna 2', 'GIOIA'),
          text('v3', 'Valore 3', '5.16M'), text('n3', 'Campagna 3', 'NUDE LOOK'),
          color('color', 'Colore valori', 'violet'), color('nameColor', 'Colore nomi', 'ink'), weight('weight', 'Peso valori', 400),
        ],
      },
      {
        id: 'count',
        label: 'Contatore',
        icon: 'gauge',
        params: [
          num('countDur', 'Durata conteggio', 1.25, 0.3, 2.5, 0.01, 's'),
          ez('countEase', 'Ease conteggio', 'expo.out'),
          num('stagger', 'Stagger righe', 0.14, 0, 0.5, 0.01, 's'),
          num('riseDur', 'Ingresso', 0.75, 0.2, 1.4, 0.01, 's'),
          ez('riseEase', 'Ease ingresso', 'power3.out'),
        ],
      },
      { id: 'out', label: 'Uscita verso sinistra', icon: 'arrow-left', params: [num('outDur', 'Durata', 0.6, 0.2, 1.2, 0.01, 's'), num('outStagger', 'Stagger', 0.06, 0, 0.3, 0.005, 's'), ez('outEase', 'Ease', 'power3.in')] },
    ],
  },
  pin: { label: 'Tappa', effects: pinFx('ARIA', '153 contenuti', 'May 2026') },
  signoff: {
    label: 'Logotipo',
    effects: [
      { id: 'undraw', label: 'Linea e cerchi che si ritirano', icon: 'pen', params: [num('undrawDur', 'Durata', 0.6, 0.2, 1.4, 0.01, 's'), ez('undrawEase', 'Ease', 'power3.inOut')] },
      {
        id: 'letters',
        label: 'Lettere in stagger',
        icon: 'signature',
        params: [
          num('riseAt', 'Inizio', 0.42, 0, 1.5, 0.01, 's'),
          num('riseStagger', 'Stagger', 0.045, 0, 0.2, 0.005, 's'),
          num('riseDur', 'Durata', 0.62, 0.15, 1.4, 0.01, 's'),
          ez('riseEase', 'Ease', 'power4.out'),
          num('wordSize', 'Scala', 1, 0.5, 1.4),
          color('wordColor', 'Colore', 'ink'),
        ],
      },
      {
        id: 'star',
        label: '“?” che diventa “*”',
        icon: 'asterisk',
        params: [num('dockAt', 'Parte a', 0.55, 0, 2, 0.01, 's'), num('dockDur', 'Durata', 0.95, 0.3, 1.8, 0.01, 's'), ez('dockEase', 'Ease', 'power3.inOut'), num('starSpin', 'Giri', 1, 0, 3, 0.25), color('starColor', 'Colore', 'ink')],
      },
      { id: 'bg', label: 'Ritorno al bianco', icon: 'droplet', params: [num('bgFrom', 'Inizio', 0.12, 0, 1.5, 0.01, 's'), num('bgDur', 'Durata', 0.85, 0.2, 1.6, 0.01, 's'), ez('bgEase', 'Ease', 'power3.inOut')] },
    ],
  },
}

// ------------------------------------------------------------------ scenes

export const SCENE_TYPES = {
  wall: {
    label: 'Apertura · video',
    hue: '#8174f2',
    effects: [
      {
        id: 'sphere',
        label: 'Sfera di video',
        icon: 'globe',
        params: [
          num('rows', 'Righe', 7, 3, 9, 2),
          num('radius', 'Raggio sfera', 1, 0.6, 1.8),
          num('gap', 'Spazio tra i video', 0.07, 0.01, 0.3, 0.005),
          num('speed', 'Velocità righe', 0.55, 0, 2),
          bool('alternate', 'Righe alternate', true),
          num('corner', 'Raggio angoli', 0.07, 0, 0.3, 0.005),
        ],
      },
      {
        id: 'layout',
        label: 'Composizione',
        icon: 'grid',
        params: [num('numberSize', 'Scala numeri', 1, 0.6, 1.4), num('overlap', 'Numero sopra i video', 0.45, 0, 1), num('bottom', 'Margine in basso', 0.085, 0.03, 0.2, 0.005)],
      },
    ],
  },
  phone: {
    label: 'iPhone + views',
    hue: '#b19aff',
    effects: [
      {
        id: 'rays',
        label: 'God rays · due fasci di luce',
        icon: 'sun',
        on: 'raysOn',
        params: [
          bool('raysOn', 'Attivo', true),
          num('rays', 'Intensità', 1, 0, 2),
          color('raysColor', 'Colore della luce', '#ffe2b8'),
          num('raysSway', 'Movimento', 1, 0, 3),
          num('raysWidth', 'Apertura', 1, 0.4, 2.5),
          num('raysShade', 'Ombra della stanza', 0.8, 0, 2),
        ],
      },
      {
        id: 'dust',
        label: 'Pulviscolo',
        icon: 'sparkles',
        on: 'dustOn',
        params: [bool('dustOn', 'Attivo', true), num('dust', 'Quantità', 1, 0, 3), num('dustSize', 'Dimensione', 1, 0.3, 3), num('dustDrift', 'Movimento', 1, 0, 3)],
      },
      {
        id: 'feed',
        label: 'Feed che scorre',
        icon: 'mobile',
        params: [num('swipeEvery', 'Swipe ogni', 1.15, 0.4, 3, 0.05, 's'), num('swipeDur', 'Durata swipe', 0.5, 0.15, 1, 0.01, 's'), ez('swipeEase', 'Ease', 'power3.inOut'), bool('feedUi', 'Interfaccia social', true)],
      },
      { id: 'layout', label: 'Layout', icon: 'grid', params: [num('phoneSize', 'Scala iPhone', 1, 0.6, 1.4), num('numbersSize', 'Scala numeri', 1, 0.6, 1.5), num('rowGap', 'Distanza righe', 1, 0.6, 1.8)] },
      { id: 'exit', label: 'Uscita numeri verso l’alto', icon: 'arrow-up', params: [num('exitDur', 'Durata', 0.55, 0.15, 1, 0.01, 's'), num('exitStagger', 'Stagger', 0.07, 0, 0.3, 0.005, 's'), ez('exitEase', 'Ease', 'power3.in')] },
    ],
  },
  comments: { label: 'Commenti', hue: '#f64414', effects: [] },
  numbers: { label: 'I numeri', hue: '#8174f2', effects: [] },
  roadmap: {
    label: 'Roadmap',
    hue: '#b19aff',
    effects: [
      {
        id: 'road',
        label: 'Linea e tappe',
        icon: 'circle',
        params: [
          color('bgColor', 'Sfondo', 'lavender'),
          num('wipeDur', 'Cambio colore', 0.8, 0.2, 1.6, 0.01, 's'),
          ez('wipeEase', 'Ease cambio colore', 'power3.inOut'),
          num('lineWeight', 'Spessore linea', 1, 0.3, 3),
          color('lineColor', 'Colore linea', 'white'),
          num('pinSize', 'Scala cerchi', 1, 0.6, 1.5),
          color('textColor', 'Colore testi', 'ink'),
          num('spacing', 'Distanza tappe', 1, 0.6, 1.6),
        ],
      },
    ],
  },
  outro: { label: 'Chiusura', hue: '#ffffff', effects: [] },
}

// ------------------------------------------------------------------ default film (30.0 s)

const shot = (id, type, name, dur, params = {}) => ({ id, type, name, dur, params })

export function defaultProject() {
  return {
    version: 5,
    aspect: '9:16',
    fps: 30,
    look: { grain: 0, vignette: 0 },
    scenes: [
      {
        id: 'wall',
        type: 'wall',
        params: {},
        shots: [
          shot('open', 'open', 'Nicole Pieretto', 1.2),
          shot('stat-2', 'stat', '2', 1.5, { value: '2', label: 'piattaforme' }),
          shot('stat-3', 'stat', '3', 1.2, { value: '3', label: 'campagne lanciate' }),
          shot('stat-175', 'stat', '175', 1.2, { value: '175', label: 'attivazioni creator' }),
          shot('stat-394', 'stat', '394', 1.4, { value: '394', label: 'contenuti complessivi' }),
        ],
      },
      {
        id: 'phone',
        type: 'phone',
        params: {},
        shots: [
          shot('stack', 'stack', 'Pila', 1.7),
          shot('phone', 'phone', 'made for', 2.1),
          shot('view-70m', 'view', '70M', 1.5, { value: '70M', label: 'views complessive' }),
          shot('view-9m', 'view', '9M', 1.3, { value: '9M', label: 'views organiche Aria' }),
          shot('view-985k', 'view', '985.6K', 1.4, { value: '985.6K', label: 'interazioni' }),
        ],
      },
      { id: 'comments', type: 'comments', params: {}, shots: [shot('notifs', 'notifs', 'Notifiche', 2.4), shot('dive', 'dive', 'Tuffo', 0.9)] },
      { id: 'numbers', type: 'numbers', params: {}, shots: [shot('headline', 'headline', 'La forza…', 1.4), shot('campaigns', 'campaigns', 'ARIA · GIOIA · NUDE LOOK', 2.1)] },
      {
        id: 'roadmap',
        type: 'roadmap',
        params: {},
        shots: [
          shot('pin-aria', 'pin', 'ARIA', 1.4, { name: 'ARIA', count: '153 contenuti', date: 'May 2026' }),
          shot('pin-gioia', 'pin', 'GIOIA', 1.25, { name: 'GIOIA', count: '30 contenuti', date: 'June 2026' }),
          shot('pin-nude', 'pin', 'NUDE LOOK', 1.25, { name: 'NUDE LOOK', count: '211 contenuti', date: 'September 2026' }),
          shot('pin-uwc', 'pin', 'UWC', 1.2, { name: 'UWC (ITA/US)', count: '', date: 'October / November 2026', logoColor: 'lime', discColor: 'ink' }),
          shot('pin-natale', 'pin', 'NATALE', 1.5, { name: 'NATALE', count: 'TBD', date: 'November / December 2026', logoColor: 'white', discColor: 'violet' }),
        ],
      },
      { id: 'outro', type: 'outro', params: {}, shots: [shot('signoff', 'signoff', 'cooltura*', 2.1)] },
    ],
  }
}

/** Extra effects only some shots have (the first number, the 3D logo pins). */
export function effectsOf(sh) {
  const base = SHOT_TYPES[sh.type]?.effects || []
  if (sh.type === 'stat' && sh.id === 'stat-2') return [...firstStatFx, ...base]
  if (sh.type === 'pin' && (sh.id === 'pin-uwc' || sh.id === 'pin-natale')) return [...base, logoFx(sh.id === 'pin-uwc' ? 'lime' : 'white', sh.id === 'pin-uwc' ? 'ink' : 'violet')]
  return base
}
export const sceneEffects = (sc) => SCENE_TYPES[sc.type]?.effects || []

const defaultsOf = (effects) => {
  const o = {}
  for (const fx of effects) for (const p of fx.params) o[p.k] = p.d
  return o
}

export const MIN_DUR = 0.2

/**
 * Absolute times + parameters merged over their defaults.
 * → { duration, scenes: [{ id, type, start, end, p, shots }], shots: [...], shot(id), scene(id) }
 */
export function resolve(project) {
  let t = 0
  const shots = []
  const scenes = []
  const byId = new Map()
  const sceneById = new Map()
  for (const sc of project.scenes) {
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
    scenes,
    shots,
    shot: (id) => byId.get(id),
    scene: (id) => sceneById.get(id),
    at: (time) => shots.find((s) => time >= s.start && time < s.end) || shots[shots.length - 1],
  }
}
