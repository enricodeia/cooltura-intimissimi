// Frame-exact MP4 export in the browser: WebCodecs H.264 muxed by Mediabunny.
// The clock is not real time: frame n is rendered at t = n / fps through the
// same renderAt() as the preview, with every video seeked to its exact frame.

import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, canEncodeVideo } from 'mediabunny'

export function exportName(engine, fps) {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  const intro = engine.store.project.intro === 'B' ? 'introB' : 'introA'
  return `cooltura-intimissimi-${engine.aspectKey.replace(':', 'x')}-${intro}-${engine.W}x${engine.H}-${fps}fps-${stamp}.mp4`
}

/**
 * @param {import('./engine.js').Engine} engine
 * @param {{ fps?: number, ssaa?: number, bitrate?: number, from?: number, to?: number, signal?: AbortSignal, onProgress?: Function, save?: boolean }} o
 */
export async function exportVideo(engine, o = {}) {
  const fps = Number(o.fps) || engine.store.project.fps || 30
  const ssaa = Number(o.ssaa) || 1
  const bitrate = (Number(o.bitrate) || 20) * 1e6
  const W = engine.W
  const H = engine.H
  const from = o.from ?? 0
  const to = o.to ?? engine.duration
  const frames = Math.max(1, Math.round((to - from) * fps))

  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const og = out.getContext('2d', { alpha: false })
  og.imageSmoothingEnabled = true
  og.imageSmoothingQuality = 'high'

  const wasPlaying = engine.playing
  engine.pause()
  const keep = [engine.canvas.width, engine.canvas.height]
  const keepFps = engine.store.project.fps
  engine.store.project.fps = fps
  engine.exporting = true
  engine.emit('export')
  engine.videos.pauseAll()
  engine.setBuffer(W * ssaa, H * ssaa)
  const name = o.name || exportName(engine, fps)
  const t0 = performance.now()

  try {
    let codec = null
    for (const c of ['avc', 'hevc', 'vp9', 'av1']) {
      if (await canEncodeVideo(c, { width: W, height: H, bitrate })) {
        codec = c
        break
      }
    }
    if (!codec) throw new Error(`Questo browser non riesce a codificare video a ${W}×${H}.`)
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
    const video = new CanvasSource(out, { codec, bitrate, keyFrameInterval: 1 })
    output.addVideoTrack(video, { frameRate: fps })
    await output.start()
    try {
      for (let n = 0; n < frames; n++) {
        if (o.signal?.aborted) throw new DOMException('Export annullato', 'AbortError')
        const t = from + n / fps
        await engine.prepare(t)
        engine.renderAt(t)
        og.drawImage(engine.canvas, 0, 0, W, H)
        await video.add(n / fps, 1 / fps)
        o.onProgress?.({ done: n + 1, total: frames, canvas: out, elapsed: (performance.now() - t0) / 1000 })
      }
      await output.finalize()
    } catch (err) {
      if (output.state !== 'finalized') await output.cancel().catch(() => {})
      throw err
    }
    const blob = new Blob([output.target.buffer], { type: 'video/mp4' })
    let saved = null
    if (o.save !== false) {
      try {
        const r = await fetch(`./__save?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob })
        if (r.ok) saved = (await r.json()).file
      } catch {}
    }
    return { blob, url: URL.createObjectURL(blob), name, frames, codec, W, H, fps, saved, seconds: (performance.now() - t0) / 1000 }
  } finally {
    engine.exporting = false
    engine.store.project.fps = keepFps
    engine.setBuffer(keep[0], keep[1])
    engine.dirty = true
    engine.emit('export')
    if (wasPlaying) engine.play()
  }
}

export function download(url, name) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}
