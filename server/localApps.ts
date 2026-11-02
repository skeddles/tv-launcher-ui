// Your own small apps and games: plain web pages in folders on the TV, outside
// the launcher and the system image.
//
//   ~/.local/share/tvlauncher/apps/<name>/index.html   (required)
//   ~/.local/share/tvlauncher/apps/<name>/manifest.json (optional)
//     { "name": "Pong", "type": "game" | "app", "icon": "icon.png", "color": "#123456" }
//
// The launcher lists them from /local-apps.json and opens one full screen in a
// frame. Their files are served from a second address (127.0.0.1:5174), so a
// page is a separate site: it can't reach into the launcher, and it keeps its
// own saved data (localStorage). Files are sent uncached, so an edit shows the
// next time you open it.

import { createServer, type Server } from 'node:http'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import type { Plugin } from 'vite'

export const APPS_DIR = process.env.TVLAUNCHER_APPS_DIR || join(homedir(), '.local/share/tvlauncher/apps')
const HOST = '127.0.0.1' // never reachable from the network
const PORT = 5174
const ORIGIN = `http://${HOST}:${PORT}`
const ID = /^[A-Za-z0-9][\w.-]*$/

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
}

export interface LocalApp {
  id: string
  name: string
  type: 'game' | 'app'
  url: string
  icon: string | null
  color: string | null
}

interface Manifest {
  name?: unknown
  type?: unknown
  icon?: unknown
  color?: unknown
}

/** The folders that have an index.html, with their manifest settings. */
export function listLocalApps(dir = APPS_DIR): LocalApp[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return [] // no folder yet
  }
  const apps: LocalApp[] = []
  for (const id of names.sort()) {
    if (!ID.test(id) || !existsSync(join(dir, id, 'index.html'))) continue
    let m: Manifest = {}
    try {
      m = JSON.parse(readFileSync(join(dir, id, 'manifest.json'), 'utf8')) as Manifest
    } catch {
      /* no manifest, or a broken one: use the folder name */
    }
    const icon = typeof m.icon === 'string' && safePath(join(dir, id), m.icon) ? m.icon : null
    apps.push({
      id,
      name: typeof m.name === 'string' && m.name.trim() ? m.name.trim().slice(0, 60) : id,
      type: m.type === 'app' ? 'app' : 'game',
      url: `${ORIGIN}/${encodeURIComponent(id)}/index.html`,
      icon: icon ? `${ORIGIN}/${encodeURIComponent(id)}/${icon.split('/').map(encodeURIComponent).join('/')}` : null,
      color: typeof m.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(m.color) ? m.color : null,
    })
  }
  return apps
}

/** root/rel when it stays inside root and is a file; otherwise null. */
function safePath(root: string, rel: string): string | null {
  const full = resolve(root, rel)
  if (full !== root && !full.startsWith(root + sep)) return null
  try {
    return statSync(full).isFile() ? full : null
  } catch {
    return null
  }
}

/** The file for a request path like /pong/index.html (or /pong/ -> index.html). */
export function fileFor(urlPath: string, dir = APPS_DIR): string | null {
  let p: string
  try {
    p = decodeURIComponent(urlPath.split('?')[0])
  } catch {
    return null
  }
  const [, id, ...rest] = p.split('/')
  if (!id || !ID.test(id)) return null
  const rel = rest.join('/') || 'index.html'
  return safePath(resolve(dir, id), rel.endsWith('/') ? `${rel}index.html` : rel)
}

function startFileServer(): Server {
  const server = createServer((req, res) => {
    const file = req.method === 'GET' || req.method === 'HEAD' ? fileFor(req.url || '/') : null
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('not found')
      return
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    })
    res.end(req.method === 'HEAD' ? undefined : readFileSync(file))
  })
  server.on('error', (e) => console.warn(`[local-apps] file server: ${e.message}`))
  server.listen(PORT, HOST)
  return server
}

// One file server for the life of the process (Vite restarts its own server
// when this config changes, which would otherwise try to listen twice).
const g = globalThis as { __tvLocalApps?: Server }

export function localApps(): Plugin {
  const list = (
    req: { url?: string },
    res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void },
    next: () => void,
  ) => {
    if (req.url !== '/local-apps.json') return next()
    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.setHeader('cache-control', 'no-store')
    res.end(JSON.stringify(listLocalApps()))
  }
  const start = () => {
    g.__tvLocalApps ??= startFileServer()
  }
  return {
    name: 'local-apps',
    configureServer: (server) => {
      start()
      server.middlewares.use(list)
    },
    configurePreviewServer: (server) => {
      start()
      server.middlewares.use(list)
    },
  }
}
