// Which Steam games are still downloading (or waiting to), read from Steam's own
// library files (steamapps/appmanifest_<id>.acf; read only). The shell lists
// every game Steam has started installing; this tells the launcher which of
// them can't be played yet, so they don't get started half-downloaded.
//
//   GET /steam-api/state -> { "<appId>": { "ready": false, "percent": 75 }, ... }
//
// StateFlags is a set of bits (names from Lutris' notes on Steam's AppState):
// 4 = fully installed, 2 = update required, 1024 = update started.

import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const ROOTS = [join(homedir(), '.local/share/Steam'), join(homedir(), '.steam/steam')]
const FULLY_INSTALLED = 4

export interface SteamState {
  ready: boolean // fully installed: Steam can start it now
  percent: number | null // download progress when it isn't
}

/** Values of top-level and library "path" keys we need, without a full KeyValues parser. */
function field(text: string, key: string): string | null {
  const m = new RegExp(`"${key}"\\s+"([^"]*)"`, 'i').exec(text)
  return m ? m[1] : null
}

function libraryDirs(root: string): string[] {
  const dirs = new Set([join(root, 'steamapps')])
  try {
    const vdf = readFileSync(join(root, 'steamapps/libraryfolders.vdf'), 'utf8')
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) dirs.add(join(m[1].replace(/\\\\/g, '\\'), 'steamapps'))
  } catch {
    /* no extra libraries */
  }
  return [...dirs]
}

export function steamStates(roots = ROOTS): Record<string, SteamState> {
  const root = roots.find((r) => existsSync(join(r, 'steamapps')))
  if (!root) return {}
  const out: Record<string, SteamState> = {}
  for (const dir of libraryDirs(realpathSync(root))) {
    let files: string[] = []
    try {
      files = readdirSync(dir).filter((f) => /^appmanifest_\d+\.acf$/.test(f))
    } catch {
      continue
    }
    for (const f of files) {
      let text: string
      try {
        text = readFileSync(join(dir, f), 'utf8')
      } catch {
        continue
      }
      const appId = field(text, 'appid')
      if (!appId) continue
      const flags = Number(field(text, 'StateFlags') ?? 0)
      const total = Number(field(text, 'BytesToDownload') ?? 0)
      const done = Number(field(text, 'BytesDownloaded') ?? 0)
      const ready = (flags & FULLY_INSTALLED) !== 0
      out[appId] = { ready, percent: ready ? null : total > 0 ? Math.min(99, Math.floor((done / total) * 100)) : 0 }
    }
  }
  return out
}

export function steamApi(): Plugin {
  const handle = (
    req: { url?: string },
    res: { setHeader: (k: string, v: string) => void; end: (b: string) => void },
    next: () => void,
  ) => {
    if (req.url !== '/steam-api/state') return next()
    res.setHeader('content-type', 'application/json')
    res.setHeader('cache-control', 'no-store')
    res.end(JSON.stringify(steamStates()))
  }
  return {
    name: 'steam-api',
    configureServer: (server) => void server.middlewares.use(handle),
    configurePreviewServer: (server) => void server.middlewares.use(handle),
  }
}
