// The cuts inside every feed video (hard edits in the creators' own videos), for
// the actors that show a video only for a moment (the Externability cards): they
// start each clip where it does not cut while it is on screen.
//   node tools/cuts.mjs        → public/media/cuts.json  { "v3/feed/x.mp4": [0.3, 2.27, …] }
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DIR = path.join(ROOT, 'public/media/v3/feed')
const out = {}
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.mp4')).sort()) {
  // ffmpeg writes showinfo to stderr
  const log = spawnSync('ffmpeg', ['-hide_banner', '-i', path.join(DIR, f), '-vf', "select='gt(scene,0.25)',showinfo", '-an', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 << 20 }).stderr
  out['v3/feed/' + f] = [...log.matchAll(/pts_time:([0-9.]+)/g)].map((m) => Math.round(Number(m[1]) * 1000) / 1000)
}
fs.writeFileSync(path.join(ROOT, 'public/media/cuts.json'), JSON.stringify(out, null, 0))
console.log(Object.entries(out).map(([k, v]) => `${k.replace('v3/feed/', '')}: ${v.join(' ')}`).join('\n'))
