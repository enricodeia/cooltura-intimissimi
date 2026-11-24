import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = import.meta.dirname
const EXPORTS = path.join(ROOT, 'exports')

// Dev-only: POST /__save?name=file.mp4 writes the body into exports/ (the Export
// button also downloads it in the browser; this keeps a copy next to the project).
function saveExports() {
  return {
    name: 'ci-save-exports',
    configureServer(server) {
      fs.mkdirSync(EXPORTS, { recursive: true })
      server.middlewares.use((req, res, next) => {
        if (!req.url.startsWith('/__save')) return next()
        const name = path.basename(new URL(req.url, 'http://x').searchParams.get('name') || 'export.mp4')
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          const file = path.join(EXPORTS, name)
          fs.writeFileSync(file, Buffer.concat(chunks))
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ok: true, file }))
        })
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [saveExports()],
  server: { port: 5410, strictPort: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    rollupOptions: { input: { main: path.join(ROOT, 'index.html'), machina: path.join(ROOT, 'machina.html'), storyboard: path.join(ROOT, 'storyboard.html') } },
  },
})
