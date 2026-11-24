// Font Awesome Pro (Sharp Regular) as inline SVG strings.

import {
  faCube, faRotate, faText, faHashtag, faArrowUp, faLocationDot, faVideo, faSignature, faXmark, faArrowRight, faExpand, faMobile,
  faGrid2, faLayerGroup, faPenNib, faWandMagicSparkles, faBell, faGaugeHigh, faDroplet, faArrowLeft, faAsterisk, faGlobe, faMoon,
  faIcons, faSunBright, faSparkles, faCircleDashed, faPlay, faPause, faBackwardStep, faForwardStep, faRotateLeft, faRotateRight, faRepeat,
  faMagnet, faMagnifyingGlassPlus, faMagnifyingGlassMinus, faArrowDownToLine, faChevronDown, faCopy, faPaste, faSliders,
  faArrowsLeftRight, faCheck, faStopwatch, faFilm, faArrowsToLine, faCircleInfo, faTrashCan, faGripDotsVertical, faLock,
  faKeyboard, faEllipsis, faVolumeHigh, faVolumeXmark, faMusic, faComment, faWaveformLines, faHeart,
  faFontCase, faBezierCurve, faSlidersSimple, faMagnifyingGlass, faArrowUpFromBracket, faScissors, faChevronsDown, faChevronsUp,
  faFolder, faMicrophone, faCircleExclamation, faPlus, faStop, faMicrophoneSlash,
} from '@fortawesome/sharp-regular-svg-icons'

const MAP = {
  cube: faCube, rotate: faRotate, text: faText, hashtag: faHashtag, 'arrow-up': faArrowUp, location: faLocationDot, camera: faVideo,
  signature: faSignature, xmark: faXmark, 'arrow-right': faArrowRight, expand: faExpand, mobile: faMobile, grid: faGrid2, layer: faLayerGroup,
  pen: faPenNib, wand: faWandMagicSparkles, bell: faBell, gauge: faGaugeHigh, droplet: faDroplet, 'arrow-left': faArrowLeft,
  asterisk: faAsterisk, globe: faGlobe, moon: faMoon, icons: faIcons, sun: faSunBright, sparkles: faSparkles, circle: faCircleDashed, play: faPlay, pause: faPause,
  prev: faBackwardStep, next: faForwardStep, undo: faRotateLeft, redo: faRotateRight, loop: faRepeat, magnet: faMagnet,
  'zoom-in': faMagnifyingGlassPlus, 'zoom-out': faMagnifyingGlassMinus, export: faArrowDownToLine, chevron: faChevronDown, copy: faCopy,
  paste: faPaste, sliders: faSliders, fit: faArrowsLeftRight, check: faCheck, stopwatch: faStopwatch, film: faFilm, 'fit-time': faArrowsToLine,
  info: faCircleInfo, trash: faTrashCan, grip: faGripDotsVertical, lock: faLock, keyboard: faKeyboard, more: faEllipsis, volume: faVolumeHigh, mute: faVolumeXmark, music: faMusic, comment: faComment, wave: faWaveformLines, heart: faHeart,
  // the three headings of the panel: what it shows, how it moves, how it looks
  'cat-content': faFontCase, 'cat-motion': faBezierCurve, 'cat-look': faSlidersSimple,
  search: faMagnifyingGlass, upload: faArrowUpFromBracket, scissors: faScissors, 'open-all': faChevronsDown, 'close-all': faChevronsUp,
  folder: faFolder, mic: faMicrophone, warn: faCircleExclamation,
  // the videos of the panel: add one, stop a sentence, a clip without its voice
  plus: faPlus, stop: faStop, 'mic-off': faMicrophoneSlash,
}

export function icon(name, cls = '') {
  const def = MAP[name]
  if (!def) return ''
  const [w, h, , , d] = def.icon
  return `<svg class="ico ${cls}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path fill="currentColor" d="${Array.isArray(d) ? d.join(' ') : d}"/></svg>`
}

export const h = (tag, attrs = {}, html = '') => {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v
    else if (k === 'style') el.style.cssText = v
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v)
  }
  if (html) el.innerHTML = html
  return el
}

/** Text for innerHTML (labels and names come from the model and from the user). */
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
