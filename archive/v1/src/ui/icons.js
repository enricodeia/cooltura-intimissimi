// Font Awesome Pro (Sharp Regular) as inline SVG strings.

import {
  faCube, faRotate, faText, faHashtag, faArrowUp, faLocationDot, faVideo, faSignature, faXmark, faArrowRight, faExpand, faMobile,
  faGrid2, faLayerGroup, faPenNib, faWandMagicSparkles, faBell, faGaugeHigh, faDroplet, faArrowLeft, faAsterisk, faGlobe, faMoon,
  faIcons, faSunBright, faCircleDashed, faPlay, faPause, faBackwardStep, faForwardStep, faRotateLeft, faRotateRight, faRepeat,
  faMagnet, faMagnifyingGlassPlus, faMagnifyingGlassMinus, faArrowDownToLine, faChevronDown, faCopy, faPaste, faSliders,
  faArrowsLeftRight, faCheck, faStopwatch, faFilm, faArrowsToLine, faCircleInfo,
} from '@fortawesome/sharp-regular-svg-icons'

const MAP = {
  cube: faCube, rotate: faRotate, text: faText, hashtag: faHashtag, 'arrow-up': faArrowUp, location: faLocationDot, camera: faVideo,
  signature: faSignature, xmark: faXmark, 'arrow-right': faArrowRight, expand: faExpand, mobile: faMobile, grid: faGrid2, layer: faLayerGroup,
  pen: faPenNib, wand: faWandMagicSparkles, bell: faBell, gauge: faGaugeHigh, droplet: faDroplet, 'arrow-left': faArrowLeft,
  asterisk: faAsterisk, globe: faGlobe, moon: faMoon, icons: faIcons, sun: faSunBright, circle: faCircleDashed, play: faPlay, pause: faPause,
  prev: faBackwardStep, next: faForwardStep, undo: faRotateLeft, redo: faRotateRight, loop: faRepeat, magnet: faMagnet,
  'zoom-in': faMagnifyingGlassPlus, 'zoom-out': faMagnifyingGlassMinus, export: faArrowDownToLine, chevron: faChevronDown, copy: faCopy,
  paste: faPaste, sliders: faSliders, fit: faArrowsLeftRight, check: faCheck, stopwatch: faStopwatch, film: faFilm, 'fit-time': faArrowsToLine,
  info: faCircleInfo,
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
