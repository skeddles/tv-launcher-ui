// Genres for emulated games, for the genre rows on the Games page.
//
// 1. The libretro database's genre lists (metadat/genre/<system>.dat), matched by
//    the ROM's CRC32 (exact), else by name. Cartridge systems only.
// 2. Wikidata (genre, P136, of games on the system's platform, P400), matched by
//    name. Fills in the disc systems the libretro lists don't cover.
// Results are cached per game in ~/.cache/tvlauncher/game-genres.json and filled
// in the background, so the game list never waits for them.

import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, extname, join } from 'node:path'
import { crc32 } from 'node:zlib'

const CACHE_DIR = join(homedir(), '.cache/tvlauncher/genres')
const RESULTS = join(homedir(), '.cache/tvlauncher/game-genres.json')
const DAT_URL = 'https://raw.githubusercontent.com/libretro/libretro-database/master/metadat/genre/'
const UA = 'tvlauncher/0.1 (home TV launcher; https://github.com/skeddles/tv-launcher-ui)'

/** Wikidata items of the platforms (checked Nov 2026). */
const WIKIDATA_PLATFORM: Record<string, string> = {
  gamecube: 'Q182172',
  wii: 'Q8079',
  ps2: 'Q10680',
  psx: 'Q10677',
  nds: 'Q170323',
  saturn: 'Q200912',
  dreamcast: 'Q184198',
  '3ds': 'Q203597',
}

/** The rows: libretro genre names (and words in Wikidata genre names) -> row title. Order = priority. */
const BUCKETS: Array<{ row: string; libretro: string[]; words: RegExp }> = [
  { row: 'Fighting', libretro: ['Fighting'], words: /fighting/ },
  { row: "Beat 'em ups", libretro: ["Beat'em Up"], words: /beat 'em up|beat-'em-up|hack and slash/ },
  { row: 'Racing', libretro: ['Racing'], words: /racing|racer|kart/ },
  { row: 'Sports', libretro: ['Sports', 'Sports with Animals', 'Hunting and Fishing'], words: /sports|football|soccer|golf|tennis|basketball|baseball|skateboard|snowboard|bmx|wrestling|boxing|fishing/ },
  { row: 'RPGs', libretro: ['Role-playing (RPG)'], words: /role-playing|rpg/ },
  { row: 'Platformers', libretro: ['Platform'], words: /platform/ },
  { row: 'Shooters', libretro: ["Shoot'em Up", 'Shooter', 'Lightgun Shooter'], words: /shoot|shmup|gun game/ },
  { row: 'Puzzle', libretro: ['Puzzle', 'Thinking'], words: /puzzle/ },
  { row: 'Party & board games', libretro: ['Board', 'Card', 'Gambling', 'Quiz', 'Casual Game', 'Pinball'], words: /party|board|card game|pinball|quiz|minigame/ },
  { row: 'Strategy', libretro: ['Strategy'], words: /strategy|tactic/ },
  { row: 'Music & rhythm', libretro: ['Music / Dancing', 'Music'], words: /rhythm|music|dance/ },
  { row: 'Simulation', libretro: ['Simulation'], words: /simulat|life sim|pet/ },
  { row: 'Adventure', libretro: ['Adventure'], words: /adventure/ },
  { row: 'Action', libretro: ['Action'], words: /action/ },
]

function fromLibretro(genre: string): string | null {
  return BUCKETS.find((b) => b.libretro.includes(genre))?.row ?? null
}

function fromWords(genres: string[]): string | null {
  const text = genres.join('|').toLowerCase()
  return BUCKETS.find((b) => b.words.test(text))?.row ?? null
}

// ---------- names ----------

export function normTitle(name: string): string {
  let t = name.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/\.nkit$/i, '')
  t = t.replace(/^\d{3,5}\s+-\s+/, '')
  t = t.replace(/\s*(\([^)]*\)|\[[^\]]*\])/g, '')
  t = t.replace(/^(.*), (the|a|an)( - .*)?$/i, (_m, a: string, b: string, rest = '') => `${b} ${a}${rest}`)
  t = t.toLowerCase().replace(/&/g, ' and ').replace(/[éè]/g, 'e').replace(/brothers/g, 'bros').replace(/[^a-z0-9]+/g, ' ')
  return t.trim()
}
const ROMAN: Record<string, string> = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9' }
/** "breath of fire iv" and "Breath.Of.Fire.4" -> "breathoffire4" */
const squash = (s: string) =>
  s
    .replace(/\b(ii|iii|iv|v|vi|vii|viii|ix)\b/g, (m) => ROMAN[m])
    .replace(/ version$/, '')
    .replace(/^the /, '')
    .replace(/ /g, '')

// ---------- sources (cached on disk for 30 days) ----------

async function cached(file: string, fetchText: () => Promise<string>): Promise<string> {
  const path = join(CACHE_DIR, file)
  try {
    if (Date.now() - statSync(path).mtimeMs < 30 * 864e5) return readFileSync(path, 'utf8')
  } catch {
    /* not cached */
  }
  const text = await fetchText()
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(path, text)
  return text
}

interface Lookup {
  byCrc: Map<string, string>
  byName: Map<string, string> // squashed normalized name -> row
}

const lookups = new Map<string, Promise<Lookup>>()

function libretroLookup(system: string): Promise<Lookup> {
  const key = `dat:${system}`
  let p = lookups.get(key)
  if (p) return p
  p = (async () => {
    const text = await cached(`${system}.dat`, async () => {
      const res = await fetch(DAT_URL + encodeURIComponent(`${system}.dat`), { headers: { 'user-agent': UA } })
      if (res.status === 404) return '' // no genre list for this system
      if (!res.ok) throw new Error(`genre list ${res.status}`)
      return res.text()
    })
    const byCrc = new Map<string, string>()
    const byName = new Map<string, string>()
    for (const block of text.split(/\ngame \(/).slice(1)) {
      const name = /comment "([^"]*)"/.exec(block)?.[1]
      const genre = /genre "([^"]*)"/.exec(block)?.[1]
      const crc = /crc ([0-9A-Fa-f]{8})/.exec(block)?.[1]
      const row = genre ? fromLibretro(genre) : null
      if (!row) continue
      if (crc) byCrc.set(crc.toUpperCase(), row)
      if (name && !byName.has(squash(normTitle(name)))) byName.set(squash(normTitle(name)), row)
    }
    return { byCrc, byName }
  })()
  p.catch(() => lookups.delete(key))
  lookups.set(key, p)
  return p
}

function wikidataLookup(systemId: string): Promise<Lookup> | null {
  const qid = WIKIDATA_PLATFORM[systemId]
  if (!qid) return null
  const key = `wd:${systemId}`
  let p = lookups.get(key)
  if (p) return p
  p = (async () => {
    const query = `SELECT ?itemLabel (GROUP_CONCAT(DISTINCT ?gl; separator="|") AS ?genres) WHERE {
      ?item wdt:P400 wd:${qid}; wdt:P136 ?g. ?g rdfs:label ?gl. FILTER(LANG(?gl) = "en")
      ?item rdfs:label ?itemLabel. FILTER(LANG(?itemLabel) = "en") } GROUP BY ?item ?itemLabel`
    const text = await cached(`wikidata-${systemId}.json`, async () => {
      const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, {
        headers: { accept: 'application/sparql-results+json', 'user-agent': UA },
      })
      if (!res.ok) throw new Error(`wikidata ${res.status}`)
      return res.text()
    })
    const rows = (JSON.parse(text) as { results: { bindings: Array<Record<string, { value: string }>> } }).results.bindings
    const byName = new Map<string, string>()
    for (const b of rows) {
      const row = fromWords(b.genres.value.split('|'))
      if (row) byName.set(squash(normTitle(b.itemLabel.value)), row)
    }
    return { byCrc: new Map(), byName }
  })()
  p.catch(() => lookups.delete(key))
  lookups.set(key, p)
  return p
}

// ---------- matching one game ----------

/** CRC32 of a cartridge ROM as the No-Intro lists have it (without copier/iNES headers). */
async function romCrc(path: string, systemId: string): Promise<string | null> {
  const size = statSync(path).size
  if (size > 64 * 1024 * 1024) return null // discs: matched by name instead
  const ext = extname(path).toLowerCase()
  if (['.zip', '.7z', '.cue', '.m3u', '.iso', '.chd'].includes(ext)) return null
  let skip = 0
  if (systemId === 'snes' && size % 1024 === 512) skip = 512
  const buf = await new Promise<Buffer>((resolve, reject) => {
    const parts: Buffer[] = []
    createReadStream(path)
      .on('data', (d) => parts.push(d as Buffer))
      .on('end', () => resolve(Buffer.concat(parts)))
      .on('error', reject)
  })
  if (systemId === 'nes' && buf.subarray(0, 4).toString('latin1') === 'NES\x1a') skip = 16
  return (crc32(buf.subarray(skip)) >>> 0).toString(16).toUpperCase().padStart(8, '0')
}

export interface GenreInput {
  id: string
  systemId: string
  artSystems: string[] // libretro system names (same as the thumbnail folders)
  path: string
  file: string
  extra: boolean
}

async function findGenre(g: GenreInput): Promise<string | null> {
  const name = squash(normTitle(g.file))
  const lists: Lookup[] = []
  for (const s of g.artSystems) {
    lists.push(await libretroLookup(s)) // offline: throws, and the game is tried again later
  }
  if (lists.some((l) => l.byCrc.size)) {
    const crc = await romCrc(g.path, g.systemId).catch(() => null)
    for (const l of lists) if (crc && l.byCrc.has(crc)) return l.byCrc.get(crc)!
  }
  for (const l of lists) if (l.byName.has(name)) return l.byName.get(name)!
  const wd = wikidataLookup(g.systemId)
  if (wd) {
    const l = await wd
    if (l.byName.has(name)) return l.byName.get(name)!
  }
  return null
}

// ---------- the cache and the background fill ----------

type Results = Record<string, string | null> // game id -> row title (null: none found)

let results: Results | null = null
function load(): Results {
  if (!results) {
    try {
      results = JSON.parse(readFileSync(RESULTS, 'utf8')) as Results
    } catch {
      results = {}
    }
  }
  return results
}

let filling = false

/** Genre row titles known so far; starts finding the rest in the background. */
export function genres(games: GenreInput[]): Results {
  const r = load()
  // Main ROMs first: they're the ones on the Games page
  const missing = games.filter((g) => !(g.id in r)).sort((a, b) => Number(a.extra) - Number(b.extra))
  if (missing.length && !filling) {
    filling = true
    void (async () => {
      try {
        let n = 0
        for (const g of missing) {
          try {
            r[g.id] = await findGenre(g)
          } catch {
            continue // a list couldn't be fetched: try this game again next time
          }
          if (++n % 50 === 0) save()
        }
      } finally {
        save()
        filling = false
      }
    })()
  }
  return r
}

function save() {
  try {
    mkdirSync(dirname(RESULTS), { recursive: true })
    writeFileSync(RESULTS, JSON.stringify(results))
  } catch {
    /* try again next time */
  }
}
