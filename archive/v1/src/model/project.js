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

export const PALETTE = {
  paper: '#f3f1ec',
  white: '#ffffff',
  ink: '#0b0b0c',
  lime: '#c0ff33',
  lavender: '#b19aff',
  violet: '#8174f2',
  orange: '#f64414',
}
export const SWATCHES = ['lime', 'lavender', 'violet', 'orange', 'white', 'paper', 'ink']

const num = (k, label, d, min, max, step = 0.01, unit = '') => ({ k, label, t: 'num', d, min, max, step, unit })
const bool = (k, label, d) => ({ k, label, t: 'bool', d })
const color = (k, label, d) => ({ k, label, t: 'color', d })
const select = (k, label, d, opts) => ({ k, label, t: 'select', d, opts })
const text = (k, label, d) => ({ k, label, t: 'text', d })
const ez = (k, label, d) => ({ k, label, t: 'ease', d })

// ------------------------------------------------------------------ shot types

const statFx = (value, label, extra = []) => [
  {
    id: 'number',
    label: 'Numero 3D',
    icon: 'cube',
    params: [
      text('value', 'Valore', value),
      color('color', 'Colore fronte', 'lime'),
      color('side', 'Colore spessore', 'violet'),
      num('size', 'Scala', 1, 0.4, 1.6),
      num('depth', 'Spessore', 0.3, 0.02, 0.8),
      num('sway', 'Oscillazione', 1, 0, 3),
    ],
  },
  {
    id: 'roll',
    label: 'Ruota (ingresso)',
    icon: 'rotate',
    params: [
      select('axis', 'Asse', 'x', [['x', 'X · dal basso'], ['y', 'Y · di lato']]),
      num('angle', 'Angolo', 96, 30, 180, 1, '°'),
      num('rollDur', 'Durata', 0.62, 0.15, 1.5, 0.01, 's'),
      num('digitStagger', 'Stagger cifre', 0.05, 0, 0.2, 0.005, 's'),
      ez('rollEase', 'Ease', 'back.out(1.4)'),
    ],
  },
  {
    id: 'label',
    label: 'Sottotitolo',
    icon: 'text',
    params: [text('label', 'Testo', label), color('labelColor', 'Colore', 'white'), num('labelSize', 'Scala', 1, 0.5, 1.8)],
  },
  ...extra,
]

const viewFx = (value, label) => [
  {
    id: 'value',
    label: 'Valore',
    icon: 'hashtag',
    params: [
      text('value', 'Valore', value),
      text('label', 'Sottotitolo', label),
      color('color', 'Colore', 'lime'),
      color('labelColor', 'Colore sottotitolo', 'white'),
    ],
  },
  {
    id: 'enter',
    label: 'Ingresso dal basso',
    icon: 'arrow-up',
    params: [
      num('enterDur', 'Durata', 0.7, 0.2, 1.5, 0.01, 's'),
      ez('enterEase', 'Ease', 'expo.out'),
      bool('odometer', 'Cifre a rullo', true),
      num('charStagger', 'Stagger cifre', 0.045, 0, 0.15, 0.005, 's'),
    ],
  },
]

const pinFx = (name, count, date, extra = []) => [
  {
    id: 'pin',
    label: 'Tappa',
    icon: 'location',
    params: [text('name', 'Nome', name), text('count', 'Contenuti', count), text('date', 'Data', date)],
  },
  {
    id: 'arrive',
    label: 'Arrivo camera',
    icon: 'camera',
    params: [num('travel', 'Quota di viaggio', 0.62, 0.3, 0.95), ez('travelEase', 'Ease', 'power3.inOut'), ez('popEase', 'Ease cerchio', 'back.out(1.4)')],
  },
  ...extra,
]

const logoFx = (logoCol, discCol) => ({
  id: 'logo3d',
  label: 'Logo 3D “c?”',
  icon: 'cube',
  params: [color('logoColor', 'Colore logo', logoCol), color('discColor', 'Colore cerchio', discCol), num('spin', 'Giri in ingresso', 1, 0, 3, 0.25), num('logoDepth', 'Spessore', 0.26, 0.04, 0.6)],
})

export const SHOT_TYPES = {
  lockup: {
    label: 'Lockup',
    effects: [
      {
        id: 'logos',
        label: 'Loghi',
        icon: 'signature',
        params: [
          num('logoSize', 'Scala loghi', 1, 0.5, 1.6),
          num('gap', 'Distanza', 1, 0.5, 2),
          color('logoColor', 'Colore', 'ink'),
          num('letterStagger', 'Stagger lettere', 0.028, 0, 0.1, 0.002, 's'),
          ez('inEase', 'Ease ingresso', 'expo.out'),
        ],
      },
      {
        id: 'cross',
        label: '× larga e sottile',
        icon: 'xmark',
        params: [
          num('crossSize', 'Ampiezza', 1.35, 0.4, 2.2),
          num('crossWeight', 'Spessore linea', 1, 0.3, 4),
          num('crossSpin', 'Rotazione in ingresso', 90, 0, 360, 1, '°'),
          color('crossColor', 'Colore', 'ink'),
        ],
      },
      { id: 'out', label: 'Uscita', icon: 'arrow-right', params: [num('outDur', 'Durata', 0.5, 0.2, 1, 0.01, 's'), ez('outEase', 'Ease', 'power3.inOut')] },
    ],
  },
  hero: {
    label: 'Video hero',
    effects: [
      {
        id: 'open',
        label: 'Apertura dalla ×',
        icon: 'expand',
        params: [num('openDur', 'Durata', 0.62, 0.2, 1.2, 0.01, 's'), ez('openEase', 'Ease', 'expo.out'), num('punch', 'Zoom di assestamento', 0.14, 0, 0.5)],
      },
      {
        id: 'card',
        label: 'Card',
        icon: 'mobile',
        params: [num('margin', 'Margine bianco', 0.055, 0, 0.2, 0.005), num('radius', 'Raggio angoli', 0.06, 0, 0.2, 0.005)],
      },
    ],
  },
  reveal: {
    label: 'Zoom out sulla griglia',
    effects: [
      { id: 'dolly', label: 'Camera · zoom out', icon: 'camera', params: [ez('dollyEase', 'Ease', 'coolWhip'), num('dollyEnd', 'Fine zoom', 0.86, 0.4, 1)] },
      {
        id: 'stagger',
        label: 'Stagger dal centro',
        icon: 'grid',
        params: [
          num('staggerFrom', 'Inizio', 0.16, 0, 0.8),
          num('staggerSpan', 'Durata onda', 0.5, 0.05, 0.9),
          num('popDur', 'Durata pop', 0.5, 0.1, 1, 0.01, 's'),
          ez('popEase', 'Ease pop', 'back.out(1.4)'),
        ],
      },
      { id: 'spinUp', label: 'Avvio rotazione righe', icon: 'rotate', params: [num('spinFrom', 'Inizio', 0.45, 0, 1)] },
    ],
  },
  stat: { label: 'Numero', effects: statFx('2', 'piattaforme') },
  stack: {
    label: 'Video sovrapposti',
    effects: [
      {
        id: 'collapse',
        label: 'Raccolta in pila',
        icon: 'layer',
        params: [
          ez('stackEase', 'Ease', 'expo.inOut'),
          num('stackStagger', 'Stagger', 0.45, 0, 0.8),
          num('fan', 'Disordine pila', 9, 0, 30, 0.5, '°'),
          num('swirl', 'Vortice', 0.5, 0, 2),
        ],
      },
    ],
  },
  build: {
    label: 'iPhone',
    effects: [
      {
        id: 'outline',
        label: 'Outline che si compone',
        icon: 'pen',
        params: [num('drawDur', 'Durata tratto', 0.42, 0.1, 1, 0.01, 's'), num('lineWeight', 'Spessore', 1, 0.3, 3), color('lineColor', 'Colore', 'white')],
      },
      {
        id: 'shader',
        label: 'Shader 3D dal basso',
        icon: 'wand',
        params: [num('fillFrom', 'Inizio', 0.3, 0, 0.8), num('fillDur', 'Durata', 0.45, 0.1, 1, 0.01, 's'), color('scanColor', 'Colore scansione', 'lime'), num('scanGlow', 'Intensità', 0.55, 0, 3)],
      },
      {
        id: 'pose',
        label: 'Posa a destra',
        icon: 'cube',
        params: [
          num('poseFrom', 'Inizio', 0.6, 0.2, 0.95),
          num('tiltX', 'Tilt X', -9, -40, 40, 0.5, '°'),
          num('tiltY', 'Tilt Y', -24, -60, 60, 0.5, '°'),
          num('tiltZ', 'Tilt Z', 3, -20, 20, 0.5, '°'),
          ez('poseEase', 'Ease', 'expo.inOut'),
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
        label: 'iPhone davanti alla camera',
        icon: 'mobile',
        params: [num('frontDur', 'Durata movimento', 0.75, 0.2, 1.5, 0.01, 's'), ez('frontEase', 'Ease', 'expo.inOut'), num('phoneFill', 'Larghezza a schermo', 0.9, 0.5, 1.2)],
      },
      {
        id: 'pop',
        label: 'Notifiche pop-up',
        icon: 'bell',
        params: [
          num('count', 'Quante', 7, 2, 12, 1),
          num('every', 'Ogni', 0.27, 0.08, 0.8, 0.01, 's'),
          num('popDur', 'Durata pop', 0.5, 0.15, 1, 0.01, 's'),
          ez('popEase', 'Ease', 'back.out(1.7)'),
        ],
      },
      { id: 'follow', label: 'Camera che scende', icon: 'camera', params: [num('followLag', 'Morbidezza', 0.5, 0.1, 1.2, 0.01, 's'), num('anchor', 'Altezza ultimo commento', -0.16, -0.45, 0.3)] },
    ],
  },
  dive: {
    label: 'Tuffo nel feed',
    effects: [
      { id: 'zoom', label: 'Zoom in', icon: 'expand', params: [num('zoom', 'Zoom', 1.5, 1, 2.5), ez('zoomEase', 'Ease', 'power3.inOut')] },
      {
        id: 'speed',
        label: 'Velocità + motion blur',
        icon: 'gauge',
        params: [num('extra', 'Commenti in corsa', 9, 2, 16, 1), ez('speedEase', 'Ease', 'power3.in'), num('blur', 'Motion blur', 1, 0, 3)],
      },
      { id: 'fade', label: 'Dissolvenza sfocata', icon: 'droplet', params: [num('fadeFrom', 'Inizio', 0.5, 0, 0.95), num('fadeBlur', 'Sfocatura', 1, 0, 3)] },
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
          select('weight', 'Peso', 400, [[300, 'Light'], [400, 'Regular'], [800, 'Ultrabold']]),
          num('size', 'Scala', 1, 0.5, 1.6),
        ],
      },
      {
        id: 'in',
        label: 'Ingresso',
        icon: 'arrow-up',
        params: [
          select('split', 'Dividi per', 'words', [['words', 'Parole'], ['chars', 'Lettere'], ['lines', 'Righe']]),
          num('lead', 'Anticipo sul tuffo', 0.3, 0, 0.8, 0.01, 's'),
          num('tilt', 'Tilt X', 72, 0, 110, 1, '°'),
          num('rise', 'Salita', 1.1, 0, 3),
          num('stagger', 'Stagger', 0.07, 0, 0.3, 0.005, 's'),
          num('inDur', 'Durata', 0.75, 0.2, 1.6, 0.01, 's'),
          ez('inEase', 'Ease', 'expo.out'),
          color('fromColor', 'Colore di partenza', 'violet'),
          color('toColor', 'Colore finale', 'white'),
        ],
      },
      {
        id: 'out',
        label: 'Uscita in righe',
        icon: 'arrow-up',
        params: [num('outDur', 'Durata', 0.5, 0.15, 1.2, 0.01, 's'), num('outStagger', 'Stagger righe', 0.07, 0, 0.3, 0.005, 's'), ez('outEase', 'Ease', 'power3.in')],
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
          color('color', 'Colore valori', 'lime'), color('side', 'Colore spessore', 'violet'), color('nameColor', 'Colore nomi', 'white'),
        ],
      },
      {
        id: 'flip',
        label: 'Scale up + rotazione Y',
        icon: 'rotate',
        params: [
          num('turns', 'Rotazione', 200, 0, 720, 5, '°'),
          num('flipDur', 'Durata', 1.05, 0.3, 2, 0.01, 's'),
          num('stagger', 'Stagger', 0.16, 0, 0.5, 0.01, 's'),
          ez('flipEase', 'Ease (elastic bounce)', 'coolBounce'),
          num('depth', 'Spessore 3D', 0.16, 0.01, 0.5),
        ],
      },
      { id: 'out', label: 'Uscita verso sinistra', icon: 'arrow-left', params: [num('outDur', 'Durata', 0.55, 0.2, 1.2, 0.01, 's'), num('outStagger', 'Stagger', 0.06, 0, 0.3, 0.005, 's'), ez('outEase', 'Ease', 'power3.in')] },
    ],
  },
  proud: {
    label: 'Proud Moments',
    effects: [
      {
        id: 'title',
        label: 'Titolo',
        icon: 'text',
        params: [text('line1', 'Riga 1', 'Proud'), text('line2', 'Riga 2', 'Moments'), color('titleColor', 'Colore', 'ink'), num('size', 'Scala', 1, 0.5, 1.5)],
      },
      { id: 'wipe', label: 'Cambio colore dinamico', icon: 'droplet', params: [num('wipeDur', 'Durata', 0.75, 0.2, 1.2, 0.01, 's'), ez('wipeEase', 'Ease', 'power3.inOut')] },
      { id: 'cut', label: 'Linea che taglia', icon: 'pen', params: [num('cutFrom', 'Inizio', 0.04, 0, 0.8), num('cutDur', 'Durata', 0.6, 0.2, 1.2, 0.01, 's'), ez('cutEase', 'Ease', 'power3.inOut')] },
    ],
  },
  pin: { label: 'Tappa', effects: pinFx('ARIA', '153 contenuti', 'May 2026') },
  signoff: {
    label: 'Logotipo',
    effects: [
      { id: 'undraw', label: 'Linea e cerchio che si ritirano', icon: 'pen', params: [num('undrawDur', 'Durata', 0.6, 0.2, 1.4, 0.01, 's'), ez('undrawEase', 'Ease', 'power3.inOut')] },
      {
        id: 'write',
        label: 'Scrittura del logotipo',
        icon: 'signature',
        params: [
          num('writeFrom', 'Inizio', 0.24, 0, 0.7),
          num('writeDur', 'Durata tratto', 0.55, 0.2, 1.2, 0.01, 's'),
          num('writeStagger', 'Stagger lettere', 0.07, 0, 0.2, 0.005, 's'),
          num('wordSize', 'Scala', 1, 0.5, 1.4),
          color('wordColor', 'Colore', 'ink'),
        ],
      },
      { id: 'star', label: '“?” che diventa “*”', icon: 'asterisk', params: [num('starSpin', 'Giri', 1.5, 0.5, 4, 0.5), color('starColor', 'Colore', 'ink')] },
      { id: 'bg', label: 'Ritorno al bianco', icon: 'droplet', params: [num('bgFrom', 'Inizio', 0.18, 0, 0.7), num('bgDur', 'Durata', 0.7, 0.2, 1.4, 0.01, 's')] },
    ],
  },
}

// ------------------------------------------------------------------ scenes

export const SCENE_TYPES = {
  intro: { label: 'Intro', hue: '#b19aff', effects: [] },
  wall: {
    label: 'Video wall',
    hue: '#c0ff33',
    effects: [
      {
        id: 'sphere',
        label: 'Griglia bombata',
        icon: 'globe',
        params: [
          num('tile', 'Dimensione video', 1, 0.6, 1.6),
          num('gap', 'Spazio', 0.13, 0.02, 0.5),
          num('bulge', 'Raggio sfera', 15, 5, 40, 0.5),
          num('speed', 'Velocità righe', 0.62, 0, 3),
          bool('alternate', 'Righe alternate', true),
          num('corner', 'Raggio angoli', 0.075, 0, 0.3, 0.005),
        ],
      },
      {
        id: 'dim',
        label: 'Luci giù sui numeri',
        icon: 'moon',
        on: 'dimOn',
        params: [bool('dimOn', 'Attivo', true), num('dim', 'Oscuramento', 0.56, 0, 0.95), num('blur', 'Sfocatura', 1.1, 0, 4), num('dimDur', 'Durata', 0.6, 0.1, 1.5, 0.01, 's')],
      },
      {
        id: 'icons',
        label: 'Icone 3D Instagram + TikTok',
        icon: 'icons',
        on: 'iconsOn',
        params: [bool('iconsOn', 'Attivo', true), num('iconSize', 'Scala', 1, 0.4, 2), num('iconSpin', 'Rotazione', 1, 0, 3), bool('brandColors', 'Colori originali', true)],
      },
    ],
  },
  phone: {
    label: 'iPhone + views',
    hue: '#8174f2',
    effects: [
      {
        id: 'rays',
        label: 'God rays · due fari',
        icon: 'sun',
        on: 'raysOn',
        params: [
          bool('raysOn', 'Attivo', true),
          num('rays', 'Intensità', 0.85, 0, 2),
          color('raysColor', 'Colore', 'lavender'),
          num('raysSway', 'Movimento', 1, 0, 3),
          num('raysWidth', 'Apertura', 1, 0.4, 2.5),
          num('raysHaze', 'Foschia', 0.6, 0, 1.5),
        ],
      },
      {
        id: 'feed',
        label: 'Feed che scorre',
        icon: 'mobile',
        params: [num('swipeEvery', 'Swipe ogni', 1.05, 0.4, 3, 0.05, 's'), num('swipeDur', 'Durata swipe', 0.42, 0.15, 1, 0.01, 's'), ez('swipeEase', 'Ease', 'power3.inOut'), bool('feedUi', 'Interfaccia social', true)],
      },
      { id: 'layout', label: 'Layout', icon: 'grid', params: [num('phoneSize', 'Scala iPhone', 1, 0.6, 1.4), num('numbersSize', 'Scala numeri', 1, 0.6, 1.5), num('rowGap', 'Distanza righe', 1, 0.6, 1.8)] },
      { id: 'exit', label: 'Uscita numeri verso l’alto', icon: 'arrow-up', params: [num('exitDur', 'Durata', 0.5, 0.15, 1, 0.01, 's'), num('exitStagger', 'Stagger', 0.07, 0, 0.3, 0.005, 's'), ez('exitEase', 'Ease', 'power3.in')] },
    ],
  },
  comments: { label: 'Commenti', hue: '#f64414', effects: [] },
  numbers: { label: 'I numeri', hue: '#c0ff33', effects: [] },
  proud: {
    label: 'Proud Moments',
    hue: '#b19aff',
    effects: [
      {
        id: 'orbit',
        label: 'Linea a ellisse',
        icon: 'circle',
        params: [
          num('ring', 'Raggio', 1, 0.6, 2),
          num('elev', 'Inclinazione camera', 17, 0, 40, 0.5, '°'),
          num('spacing', 'Distanza tappe', 50, 25, 70, 1, '°'),
          num('lineWeight', 'Spessore linea', 1, 0.3, 3),
          color('lineColor', 'Colore linea', 'white'),
          num('pinSize', 'Scala cerchi', 1, 0.6, 1.5),
          color('textColor', 'Colore testi', 'ink'),
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
    version: 4,
    aspect: '9:16',
    fps: 30,
    look: { grain: 0.03, vignette: 0 },
    scenes: [
      { id: 'intro', type: 'intro', params: {}, shots: [shot('lockup', 'lockup', 'cooltura × intimissimi', 1.7)] },
      {
        id: 'wall',
        type: 'wall',
        params: {},
        shots: [
          shot('hero', 'hero', 'Nicole Pieretto', 1.4),
          shot('reveal', 'reveal', 'Zoom out', 1.9),
          shot('stat-2', 'stat', '2', 1.4, { value: '2', label: 'piattaforme' }),
          shot('stat-3', 'stat', '3', 1.0, { value: '3', label: 'campagne lanciate' }),
          shot('stat-175', 'stat', '175', 1.0, { value: '175', label: 'attivazioni creator' }),
          shot('stat-394', 'stat', '394', 1.3, { value: '394', label: 'contenuti complessivi' }),
        ],
      },
      {
        id: 'phone',
        type: 'phone',
        params: {},
        shots: [
          shot('stack', 'stack', 'Pila', 0.9),
          shot('build', 'build', 'iPhone', 1.1),
          shot('view-70m', 'view', '70M', 1.1, { value: '70M', label: 'views complessive' }),
          shot('view-9m', 'view', '9M', 1.0, { value: '9M', label: 'views organiche Aria' }),
          shot('view-985k', 'view', '985.6K', 1.4, { value: '985.6K', label: 'interazioni' }),
        ],
      },
      { id: 'comments', type: 'comments', params: {}, shots: [shot('notifs', 'notifs', 'Notifiche', 2.8), shot('dive', 'dive', 'Tuffo', 0.9)] },
      { id: 'numbers', type: 'numbers', params: {}, shots: [shot('headline', 'headline', 'La forza…', 1.8), shot('campaigns', 'campaigns', 'ARIA · GIOIA · NUDE LOOK', 2.2)] },
      {
        id: 'proud',
        type: 'proud',
        params: {},
        shots: [
          shot('proud-title', 'proud', 'Proud Moments', 1.2),
          shot('pin-aria', 'pin', 'ARIA', 0.8, { name: 'ARIA', count: '153 contenuti', date: 'May 2026' }),
          shot('pin-gioia', 'pin', 'GIOIA', 0.7, { name: 'GIOIA', count: '30 contenuti', date: 'June 2026' }),
          shot('pin-nude', 'pin', 'NUDE LOOK', 0.7, { name: 'NUDE LOOK', count: '211 contenuti', date: 'September 2026' }),
          shot('pin-uwc', 'pin', 'UWC', 0.8, { name: 'UWC (ITA/US)', count: '', date: 'October / November 2026', logoColor: 'lime', discColor: 'ink' }),
          shot('pin-natale', 'pin', 'NATALE', 0.8, { name: 'NATALE', count: 'TBD', date: 'November / December 2026', logoColor: 'white', discColor: 'violet' }),
        ],
      },
      { id: 'outro', type: 'outro', params: {}, shots: [shot('signoff', 'signoff', 'cooltura*', 2.1)] },
    ],
  }
}

/** Extra effects only some shots have (the 3D logo pins). */
export function effectsOf(sh) {
  const base = SHOT_TYPES[sh.type]?.effects || []
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
