// Streaming service logos, kept on the TV.
//
// The tiles used to load them from Wikimedia Commons every time the launcher
// started, so they went missing whenever that request failed (at boot before
// the network is up, or when Wikimedia limits requests), and stayed missing
// until the screen was rebuilt. Now the launcher's server fetches each logo
// once, keeps it in ~/.cache/tvlauncher/logos, and serves it from there.
//
//   GET /logo?file=<Commons file name> -> the PNG (Commons renders SVGs; width 960,
//   one of Wikimedia's standard thumbnail sizes)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'

const DIR = join(homedir(), '.cache/tvlauncher/logos')
const WIDTH = 960
// Wikimedia asks automated clients to say who they are
const UA = 'tvlauncher/0.1 (home TV launcher; https://github.com/skeddles/tv-launcher-ui)'
const FILE = /^[\w .()+\-,']{1,120}\.(svg|png)$/i

const pending = new Map<string, Promise<Buffer | null>>()

function cachePath(file: string) {
  return join(DIR, `${createHash('sha1').update(`${file}@${WIDTH}`).digest('hex')}.png`)
}

async function download(file: string): Promise<Buffer | null> {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${WIDTH}`
  const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) })
  if (!r.ok) return null
  const buf = Buffer.from(await r.arrayBuffer())
  mkdirSync(DIR, { recursive: true })
  writeFileSync(cachePath(file), buf)
  return buf
}

export function logo(file: string): Promise<Buffer | null> {
  const p = cachePath(file)
  if (existsSync(p)) return Promise.resolve(readFileSync(p))
  if (!pending.has(file)) {
    const job = download(file).catch(() => null)
    pending.set(file, job)
    void job.finally(() => pending.delete(file))
  }
  return pending.get(file)!
}

export function logosApi(): Plugin {
  const handle = (
    req: { url?: string },
    res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: Buffer | string) => void },
    next: () => void,
  ) => {
    if (!req.url?.startsWith('/logo?')) return next()
    const file = new URL(req.url, 'http://x').searchParams.get('file') ?? ''
    if (!FILE.test(file)) {
      res.statusCode = 400
      return res.end('bad file')
    }
    void logo(file).then((buf) => {
      if (!buf) {
        // Not cached and Commons didn't answer: the tile shows the name and tries again later
        res.statusCode = 503
        res.setHeader('cache-control', 'no-store')
        return res.end('not available yet')
      }
      res.statusCode = 200
      res.setHeader('content-type', 'image/png')
      res.setHeader('cache-control', 'public, max-age=86400')
      res.end(buf)
    })
  }
  return {
    name: 'logos',
    configureServer: (server) => void server.middlewares.use(handle),
    configurePreviewServer: (server) => void server.middlewares.use(handle),
  }
}
