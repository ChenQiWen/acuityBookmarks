// Simple ESM static server to serve the built extension from ../dist
// Usage: cd frontend && bun run serve:dist
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const PORT = Number(process.env.PORT || 5174)
const DIST_DIR = join(process.cwd(), '..', 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2'
}

function toFilePath(pathname) {
  const clean = normalize(pathname).replace(/\\\\/g, '/').replace(/\.\.+/g, '')
  if (clean === '/' || clean === '') return join(DIST_DIR, 'index.html')
  const full = join(DIST_DIR, clean)
  try {
    const st = statSync(full)
    if (st.isDirectory()) return join(full, 'index.html')
  } catch {
    // file may not exist yet; will be handled later
  }
  return full
}

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const filePath = toFilePath(url.pathname)
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Not Found')
    return
  }
  const type = MIME[extname(filePath)] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': type })
  createReadStream(filePath).pipe(res)
}).listen(PORT, () => {
  console.log(`➡️  Serving dist from ${DIST_DIR}`)
  console.log(`🌐 Open http://localhost:${PORT}/index.html`)
  console.log(
    '   Other pages: /popup.html /management.html /settings.html /side-panel.html /auth.html'
  )
})
