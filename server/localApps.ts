// Your own small apps and games: plain web pages in folders on the TV, outside
// the launcher and the system image.
//
//   ~/.local/share/tvlauncher/apps/<name>/index.html   (required)
//   ~/.local/share/tvlauncher/apps/<name>/manifest.json (optional)
//     { "name": "Pong", "type": "game" | "app", "icon": "icon.png", "color": "#123456" }
//
// The launcher lists them from /local-apps.json and opens one full screen in a
// frame. Each is served at the root of its own address, http://<name>.localhost:5174/
// (only reachable on the TV), so:
//   - it's its own site: it can't reach into the launcher or the other apps, and
//     its saved data (localStorage, IndexedDB) is its own;
//   - paths starting with "/" work, as on any web host;
//   - any address without a file (an app's own routes, like /settings) gets its
//     index.html, so single-page apps can use real paths.
// Files are sent uncached, so an edit shows the next time you open it.

import { createServer, type Server } from 'node:http'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import type { Plugin } from 'vite'

export const APPS_DIR = process.env.TVLAUNCHER_APPS_DIR || join(homedir(), '.local/share/tvlauncher/apps')
const HOSTS = ['127.0.0.1', '::1'] // never reachable from the network
const PORT = 5174
const ID = /^[A-Za-z0-9][\w.-]*$/

/** The address label for a folder: "My_Game.v2" -> "my-game-v2". */
export function hostLabel(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

const originFor = (label: string) => `http://${label}.localhost:${PORT}`

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
  const labels = new Set<string>()
  for (const id of names.sort()) {
    if (!ID.test(id) || !existsSync(join(dir, id, 'index.html'))) continue
    const label = hostLabel(id)
    if (!label || labels.has(label)) continue // two folders that would share an address: the first wins
    labels.add(label)
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
      url: `${originFor(label)}/`,
      icon: icon ? `${originFor(label)}/${icon.split('/').map(encodeURIComponent).join('/')}` : null,
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

/** The app folder a Host header points at ("pong.localhost:5174" -> "pong"). */
export function folderFor(host: string | undefined, dir = APPS_DIR): string | null {
  const m = /^([a-z0-9-]+)\.localhost(?::\d+)?$/i.exec(host || '')
  if (!m) return null
  const label = m[1].toLowerCase()
  const app = listLocalApps(dir).find((a) => new URL(a.url).hostname === `${label}.localhost`)
  return app ? resolve(dir, app.id) : null
}

/** The file for a path inside an app folder. Paths without a file get the
 *  app's index.html (single-page apps' own routes); missing files with an
 *  extension (like /missing.png) get null. */
export function fileFor(root: string, urlPath: string): string | null {
  let p: string
  try {
    p = decodeURIComponent(urlPath.split('?')[0].split('#')[0])
  } catch {
    return null
  }
  const rel = p.replace(/^\/+/, '')
  const file = safePath(root, rel.endsWith('/') || rel === '' ? `${rel}index.html` : rel)
  if (file) return file
  if (extname(rel)) return null
  return safePath(root, 'index.html')
}

function startFileServer(host: string): Server {
  const server = createServer((req, res) => {
    const root = req.method === 'GET' || req.method === 'HEAD' ? folderFor(req.headers.host) : null
    const file = root ? fileFor(root, req.url || '/') : null
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
  server.on('error', (e) => console.warn(`[local-apps] file server on ${host}: ${e.message}`))
  server.listen(PORT, host)
  return server
}

// When this config changes Vite restarts in the same process: close the file
// servers the previous config started (they hold the port), then start fresh
// ones with the new code.
const g = globalThis as { __tvLocalApps?: Server | Server[]; __tvLocalAppsStarting?: Promise<void> }

function restartFileServers(): Promise<void> {
  const old = g.__tvLocalApps
  g.__tvLocalApps = undefined
  const olds = old ? (Array.isArray(old) ? old : [old]) : []
  return Promise.all(
    olds.map(
      (s) =>
        new Promise<void>((done) => {
          s.close(() => done())
          s.closeAllConnections?.()
        }),
    ),
  ).then(() => {
    g.__tvLocalApps = HOSTS.map(startFileServer)
  })
}

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
  let started = false
  const start = () => {
    if (started) return // once per config load (dev and preview both call this)
    started = true
    g.__tvLocalAppsStarting = (g.__tvLocalAppsStarting ?? Promise.resolve()).then(restartFileServers)
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
