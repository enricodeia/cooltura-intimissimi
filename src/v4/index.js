// V4 · La nota on the studio: the asterisk's line (machina/) between V4's own
// actors, in drawing order, and the sound.

import { createLook } from './look.js'
import { createFlip } from './flip.js'
import { createResults } from './results.js'
import { createWheel } from './wheel.js'
import { createCommunity } from './community.js'
import { createDeck } from './deck.js'
import { soundPlan, voiceStatus } from './sound.js'
import { createTexts } from '../actors/texts.js'
import { createLockup } from '../actors/lockup.js'
import { createMachina } from '../machina/actor.js'
import { Soundtrack } from '../engine/audio.js'

export async function mountV4(engine) {
  const T = () => engine.store.timeline
  engine.add(createLook(engine))
  // the line: the asterisk rolls in from the left, 2 platforms, 5 campaigns, 311 creators, its exit
  const line = engine.add(await createMachina(engine))
  engine.add(createFlip(engine))
  engine.add(createResults(engine))
  const wheel = engine.add(createWheel(engine))
  const comm = engine.add(createCommunity(engine))
  const deck = engine.add(createDeck(engine))
  engine.add(createTexts(engine))
  // the logos (opening and closing): the asterisk's line has none of its own here
  engine.add(await createLockup(engine, { types: ['hudlogo'] }))

  // the music: Dreambound (Ziv Moran, Roie Shpigler), 115 BPM. The film starts on its bar at 2.174 s, so its first
  // drop (8.435) lands on AT SCALE, as the line shoots in under it; the third bar of the drop (12.609 → 14.696) is
  // played twice (its start is the start of the next one: a seamless splice, under the voice of the creator on the
  // 5 campaigns, where the music is ducked), so the line and the numbers have one more bar; its breakdown
  // (20.957 → 25.130) is played twice (a false drop: "Let's go beyond numbers" and the wheel's voice sit in the
  // calm, the second drop arrives with "We created content"); one bar of the second drop (35.565 → 37.652, under
  // the Venice voices, ducked) is played twice too; its last beat lands on the final logos (film 48.52). Another
  // song can be loaded, or the original score chosen, in Musica e voci
  const audio = new Soundtrack({
    engine,
    plan: (TT, project) => soundPlan(TT, project, engine.videos),
    defaultTrack: { url: 'media/v4/music/dreambound.mp3', name: 'Ziv Moran, Roie Shpigler · Dreambound', title: 'Dreambound', offset: 2.17396, repeat: [ { from: 12.60874, to: 14.6957 }, { from: 20.95656, to: 25.13047 }, { from: 35.56526, to: 37.65222 } ] },
  })
  engine.audio = audio
  // the panel's voice warnings (a sentence past its clip, or longer than its block's moment)
  engine.voiceStatus = (id, keys) => voiceStatus(engine.store.timeline, id, keys, engine.videos)
  engine.store.on((what) => {
    if (what === 'project' || what === 'history') audio.invalidate()
  })
  const need = [...line.keysFor(T()), ...wheel.keysFor(T()), ...comm.keysFor(T()), ...deck.keysFor(T())]
  return { need: [...new Set(need)], audio }
}
