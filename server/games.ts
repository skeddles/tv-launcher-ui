// The ROM library behind the Games page. Runs inside the Vite dev server on the
// TV (see vite.config.ts), because a web page can't read the disk.
//
//   GET  /games-api/list          every game, its system, launch arguments, last played
//   GET  /games-api/art/<id>      box art (found on thumbnails.libretro.com, cached on disk)
//   POST /games-api/played/<id>   remember that a game was just started
//
// Games are files in ~/Games/ROMs/<system>/ and ~/Games/ROMs Extra/<system>/;
// see systems.ts. They run in RetroArch (Flatpak), one emulator with one
// settings menu for every system, started straight into the game.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, extname, join, relative } from 'node:path'
import type { Plugin } from 'vite'
import { genres } from './genres.ts'
import { SYSTEMS, type SystemDef } from './systems.ts'

const HOME = homedir()
const GAMES = join(HOME, 'Games')
const FOLDERS = [
  { dir: join(GAMES, 'ROMs'), extra: false },
  { dir: join(GAMES, 'ROMs Extra'), extra: true },
]
const BIOS = join(GAMES, 'BIOS')
const STATES = join(GAMES, 'States')
const RA_CONFIG = join(HOME, '.var/app/org.libretro.RetroArch/config/retroarch')
const CORES = join(RA_CONFIG, 'cores')
const HISTORY = join(HOME, '.local/share/tvlauncher/games-played.json')
const ART_CACHE = join(HOME, '.cache/tvlauncher/game-art')
const ART_HOST = 'https://thumbnails.libretro.com'

export interface Game {
  id: string
  system: string
  title: string
  file: string // name on disk, for search and sorting
  extra: boolean
  args: string[] | null // RetroArch arguments; null when no emulator for it is installed yet
  playedAt: number | null // ms
  plays: number
  resumable: boolean // RetroArch has an automatic save state to continue from
  genre: string | null // row title, e.g. "Platformers" (genres.ts); null while unknown
}

interface Found {
  id: string
  sys: SystemDef
  path: string
  extra: boolean
}

// ---------- finding games ----------

/** Files in a folder and its subfolders (multi-file games live in their own folder). */
function walk(dir: string, depth = 0): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  const out: string[] = []
  for (const n of names) {
    if (n.startsWith('.')) continue
    const p = join(dir, n)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (depth < 2) out.push(...walk(p, depth + 1))
    } else if (st.size > 0) out.push(p)
  }
  return out
}

/** Files a playlist or cue sheet points at, so only the playlist shows. */
function referenced(file: string): string[] {
  const ext = extname(file).toLowerCase()
  if (!['.m3u', '.cue', '.gdi', '.ccd'].includes(ext)) return []
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return []
  }
  const names: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const m = /^FILE\s+"([^"]+)"/i.exec(t) ?? /^FILE\s+(\S+)/i.exec(t)
    if (m) names.push(m[1])
    else if (ext === '.m3u') names.push(t)
    else if (ext === '.gdi') {
      const g = /"([^"]+)"|\s(\S+\.(?:bin|raw))\s/i.exec(t)
      if (g) names.push(g[1] ?? g[2])
    }
  }
  return names.map((n) => join(dirname(file), n))
}

function gameId(path: string) {
  return createHash('sha1').update(relative(GAMES, path)).digest('hex').slice(0, 16)
}

let scanCache: { at: number; games: Found[] } | null = null

function scan(): Found[] {
  if (scanCache && Date.now() - scanCache.at < 30_000) return scanCache.games
  const games: Found[] = []
  for (const { dir, extra } of FOLDERS) {
    for (const sys of SYSTEMS) {
      const files = walk(join(dir, sys.id))
      const hidden = new Set<string>()
      const broken = new Set<string>() // a cue sheet whose tracks aren't all there (yet)
      for (const f of files) {
        const refs = referenced(f)
        refs.forEach((r) => hidden.add(r))
        if (refs.some((r) => !existsSync(r))) broken.add(f)
      }
      // One entry per game: the most preferred file type among same-named files
      const best = new Map<string, string>()
      for (const f of files) {
        const ext = extname(f).slice(1).toLowerCase()
        const rank = sys.exts.indexOf(ext)
        if (rank < 0 || hidden.has(f) || broken.has(f)) continue
        const key = join(dirname(f), basename(f, extname(f))).toLowerCase()
        const prev = best.get(key)
        if (!prev || rank < sys.exts.indexOf(extname(prev).slice(1).toLowerCase())) best.set(key, f)
      }
      for (const path of best.values()) games.push({ id: gameId(path), sys, path, extra })
    }
  }
  scanCache = { at: Date.now(), games }
  return games
}

/** "Legend of Zelda, The - A Link to the Past (U) [!]" -> "The Legend of Zelda - A Link to the Past" */
export function cleanTitle(file: string): string {
  let t = basename(file, extname(file)).replace(/\.nkit$/i, '')
  t = t.replace(/^\d{3,5}\s+-\s+/, '') // "0907 - Pokemon Ruby" release numbers
  t = t.replace(/\s*(\([^)]*\)|\[[^\]]*\])/g, '') // (USA) [!] (Rev 1)
  // "Smash_Remix_1.5.2" -> "Smash Remix 1.5.2", "Breath.Of.Fire.4" -> "Breath Of Fire 4"
  if (!t.includes(' ')) t = t.includes('_') ? t.replace(/_/g, ' ') : t.replace(/\./g, ' ')
  t = t.replace(/\s+/g, ' ').trim()
  t = t.replace(/^(.*), (The|A|An)( - .*)?$/i, (_m, a: string, b: string, rest = '') => `${b} ${a}${rest}`)
  return t || basename(file)
}

// ---------- running ----------

function coreFor(sys: SystemDef): string | null {
  for (const c of sys.cores) {
    const so = join(CORES, `${c.core}_libretro.so`)
    if (!existsSync(so)) continue
    if (c.bios && !c.bios.some((b) => existsSync(join(BIOS, b)))) continue
    return so
  }
  return null
}

function launchArgs(g: Found): string[] | null {
  const core = coreFor(g.sys)
  return core ? ['-L', core, g.path] : null
}

/** RetroArch saves a state when a game closes (savestate_auto_save), named after the file. */
function hasAutoState(g: Found): boolean {
  const name = `${basename(g.path, extname(g.path))}.state.auto`
  // States are sorted into a folder named after the game's folder (sort_savestates_by_content_enable)
  return existsSync(join(STATES, basename(dirname(g.path)), name)) || existsSync(join(STATES, name))
}

type History = Record<string, { at: number; plays: number }>

function readHistory(): History {
  try {
    return JSON.parse(readFileSync(HISTORY, 'utf8')) as History
  } catch {
    return {}
  }
}

function markPlayed(id: string) {
  const h = readHistory()
  h[id] = { at: Date.now(), plays: (h[id]?.plays ?? 0) + 1 }
  mkdirSync(dirname(HISTORY), { recursive: true })
  writeFileSync(HISTORY, JSON.stringify(h))
}

function list() {
  const history = readHistory()
  const found = scan()
  const genreOf = genres(found.map((g) => ({ id: g.id, systemId: g.sys.id, artSystems: g.sys.art, path: g.path, file: basename(g.path), extra: g.extra })))
  const coreCache = new Map<string, string | null>()
  const games: Game[] = found.map((g) => {
    if (!coreCache.has(g.sys.id)) coreCache.set(g.sys.id, coreFor(g.sys))
    const core = coreCache.get(g.sys.id)
    const h = history[g.id]
    return {
      id: g.id,
      system: g.sys.id,
      title: cleanTitle(g.path),
      file: basename(g.path),
      extra: g.extra,
      args: core ? ['-L', core, g.path] : null,
      playedAt: h?.at ?? null,
      plays: h?.plays ?? 0,
      resumable: h ? hasAutoState(g) : false,
      genre: genreOf[g.id] ?? null,
    }
  })
  const systems = SYSTEMS.filter((s) => games.some((g) => g.system === s.id)).map((s) => ({ id: s.id, name: s.name }))
  return { systems, games }
}

// ---------- box art ----------

/** How thumbnails.libretro.com names files: these characters become "_". */
const artName = (s: string) => s.replace(/[&*/:`<>?\\|"]/g, '_')

/** Comparable form of a title: lower case, no tags, no punctuation, "The" moved to the front. */
function norm(name: string): string {
  let t = name.replace(/\.png$/i, '')
  t = t.replace(/^\d{3,5}\s+-\s+/, '')
  t = t.replace(/\s*(\([^)]*\)|\[[^\]]*\])/g, '')
  t = t.replace(/^(.*), (the|a|an)( - .*)?$/i, (_m, a: string, b: string, rest = '') => `${b} ${a}${rest}`)
  t = t
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/é/g, 'e')
    .replace(/[^a-z0-9]+/g, ' ')
  return t.trim()
}

const REGION_ORDER = ['(USA', '(World', '(USA, Europe', '(Europe', '(Japan']
function regionRank(file: string) {
  const i = REGION_ORDER.findIndex((r) => file.includes(r))
  return (i < 0 ? REGION_ORDER.length : i) + (/\((Beta|Proto|Demo|Sample|Kiosk)/.test(file) ? 10 : 0)
}

const indexes = new Map<string, Promise<string[]>>()

/** File names in one system's Named_Boxarts folder (cached on disk for two weeks). */
function artIndex(system: string): Promise<string[]> {
  let p = indexes.get(system)
  if (p) return p
  p = (async () => {
    const cache = join(ART_CACHE, 'index', `${artName(system)}.json`)
    try {
      if (Date.now() - statSync(cache).mtimeMs < 14 * 864e5) return JSON.parse(readFileSync(cache, 'utf8')) as string[]
    } catch {
      /* not cached yet */
    }
    const res = await fetch(`${ART_HOST}/${encodeURIComponent(system)}/Named_Boxarts/`)
    if (!res.ok) throw new Error(`thumbnail index ${res.status}`)
    const html = await res.text()
    const names = [...html.matchAll(/href="([^"?/][^"]*\.png)"/g)].map((m) => decodeURIComponent(m[1]))
    mkdirSync(dirname(cache), { recursive: true })
    writeFileSync(cache, JSON.stringify(names))
    return names
  })()
  p.catch(() => indexes.delete(system))
  indexes.set(system, p)
  return p
}

/** The best box art file for a ROM: the exact name, else the same title, preferring USA. */
async function findArt(g: Found): Promise<{ system: string; file: string } | null> {
  const stem = basename(g.path, extname(g.path))
  const want = norm(stem)
  for (const system of g.sys.art) {
    let names: string[]
    try {
      names = await artIndex(system)
    } catch {
      continue
    }
    const exact = `${artName(stem)}.png`
    if (names.includes(exact)) return { system, file: exact }
    const same = names.filter((n) => norm(n) === want).sort((a, b) => regionRank(a) - regionRank(b))
    if (same.length) return { system, file: same[0] }
    // "Pokemon Heart Gold" vs "Pokemon - HeartGold Version": ignore spaces and a trailing "version"
    const squash = (s: string) => s.replace(/ version$/, '').replace(/ /g, '')
    const loose = names.filter((n) => squash(norm(n)) === squash(want)).sort((a, b) => regionRank(a) - regionRank(b))
    if (loose.length) return { system, file: loose[0] }
    const close = closest(want, names)
    if (close) return { system, file: close }
  }
  return null
}

const SYNONYMS: Record<string, string> = { brothers: 'bros', bros: 'bros', ii: '2', iii: '3', iv: '4', pokémon: 'pokemon' }
const tokens = (s: string) => s.split(' ').filter(Boolean).map((w) => SYNONYMS[w] ?? w)

/** Most words in common (Dice score ≥ 0.75), with the same numbers ("Stadium" ≠ "Stadium 2"). */
function closest(want: string, names: string[]): string | null {
  const a = tokens(want)
  if (a.length === 0) return null
  const nums = a.filter((w) => /^\d+$/.test(w)).sort().join()
  let best: { file: string; score: number } | null = null
  for (const n of names) {
    const b = tokens(norm(n))
    if (b.filter((w) => /^\d+$/.test(w)).sort().join() !== nums) continue
    const common = a.filter((w) => b.includes(w)).length
    const score = (2 * common) / (a.length + b.length) - regionRank(n) / 1000
    if (score >= 0.75 && (!best || score > best.score)) best = { file: n, score }
  }
  return best?.file ?? null
}

const artJobs = new Map<string, Promise<string | null>>()
let artActive = 0
const artQueue: Array<() => void> = []
const slot = () =>
  new Promise<void>((r) => {
    if (artActive < 4) {
      artActive++
      r()
    } else artQueue.push(() => (artActive++, r()))
  })
const release = () => {
  artActive--
  artQueue.shift()?.()
}

/** Path of the cached box art for a game, downloading it the first time. */
function art(g: Found): Promise<string | null> {
  const file = join(ART_CACHE, g.sys.id, `${g.id}.png`)
  const none = `${file}.none`
  if (existsSync(file)) return Promise.resolve(file)
  // Not found earlier: look again after a week (the thumbnail project keeps adding art)
  try {
    if (Date.now() - statSync(none).mtimeMs < 7 * 864e5) return Promise.resolve(null)
  } catch {
    /* not looked yet */
  }
  let job = artJobs.get(g.id)
  if (job) return job
  job = (async () => {
    await slot()
    try {
      const found = await findArt(g)
      mkdirSync(dirname(file), { recursive: true })
      if (!found) {
        writeFileSync(none, '')
        return null
      }
      const res = await fetch(`${ART_HOST}/${encodeURIComponent(found.system)}/Named_Boxarts/${encodeURIComponent(found.file)}`)
      if (!res.ok) return null
      writeFileSync(file, Buffer.from(await res.arrayBuffer()))
      return file
    } catch {
      return null
    } finally {
      release()
      artJobs.delete(g.id)
    }
  })()
  artJobs.set(g.id, job)
  return job
}

// ---------- the server side ----------

type Req = { url?: string; method?: string }
type Res = {
  statusCode: number
  setHeader: (k: string, v: string) => void
  end: (b?: string | Buffer) => void
}

function json(res: Res, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

async function handle(req: Req, res: Res, next: () => void) {
  const url = req.url ?? ''
  if (!url.startsWith('/games-api/')) return next()
  try {
    const [, , what, id] = url.split('?')[0].split('/')
    if (what === 'list') return json(res, 200, list())
    const game = id ? scan().find((g) => g.id === id) : undefined
    if (what === 'played' && req.method === 'POST') {
      if (!game) return json(res, 404, { error: 'no such game' })
      markPlayed(game.id)
      return json(res, 200, { ok: true, args: launchArgs(game) })
    }
    if (what === 'art') {
      const file = game ? await art(game) : null
      if (!file) return json(res, 404, { error: 'no art' })
      res.statusCode = 200
      res.setHeader('content-type', 'image/png')
      res.setHeader('cache-control', 'max-age=604800')
      return res.end(readFileSync(file))
    }
    return json(res, 404, { error: 'unknown' })
  } catch (e) {
    return json(res, 500, { error: String(e) })
  }
}

export function gamesApi(): Plugin {
  return {
    name: 'games-api',
    configureServer: (server) => void server.middlewares.use((req, res, next) => void handle(req, res as unknown as Res, next)),
    configurePreviewServer: (server) => void server.middlewares.use((req, res, next) => void handle(req, res as unknown as Res, next)),
  }
}
