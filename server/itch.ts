// itch.io for the launcher's itch.io store page: browse lists of games that run
// on Linux and support a gamepad, and look up a game's itch.io id (to hand to the
// itch app). itch.io's browse pages have RSS versions (append .xml), which is
// what this reads; its pages don't allow requests from another site, hence the
// dev server in between.
//
//   GET /itch-api/browse?sort=top-rated&genre=platformer&page=1   -> games
//   GET /itch-api/game?url=https://author.itch.io/game             -> { id, ... }
//   GET /itch-api/installed                                         -> games installed by the itch app

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const UA = 'Mozilla/5.0 (X11; Linux x86_64) tvlauncher/0.1'
const SORTS = new Set(['', 'top-rated', 'new-and-popular', 'newest', 'free', 'top-sellers', 'on-sale'])
// itch.io tags (tag-<name>); its genre- filters only cover some genres and
// quietly fall back to the unfiltered list for the rest
const GENRES = new Set(['action', 'adventure', 'platformer', 'puzzle', 'rpg', 'racing', 'fighting', 'shooter', 'rhythm', 'strategy', 'simulation', 'sports', 'survival', 'horror', 'visual-novel', 'card-game'])

export interface ItchGame {
  url: string
  title: string
  image: string | null
  price: string // "$6.00", "$0.00"
  free: boolean
  sale: number | null // percent off
  summary: string
  genre: string | null
}

const cache = new Map<string, { at: number; data: Promise<ItchGame[]> }>()

const decode = (s: string) =>
  s
    .replace(/&#0*39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

function tag(item: string, name: string): string | null {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(item)
  return m ? m[1] : null
}

function parse(xml: string): ItchGame[] {
  const out: ItchGame[] = []
  for (const item of xml.split('<item>').slice(1)) {
    // Only games with a Linux download (not browser-only or Windows-only ones)
    if (!/<linux>yes<\/linux>/.test(item)) continue
    const url = tag(item, 'link')
    const title = tag(item, 'plainTitle')
    if (!url || !title) continue
    const fullTitle = decode(tag(item, 'title') ?? '')
    // "Hot Wax [25% Off] [$6.00] [Puzzle] [Windows] [macOS] [Linux]": the genre is the bracket after the price
    const brackets = [...fullTitle.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1])
    const genre = brackets.find((b) => !/^(Free|\$|€|£|\d+% Off|Windows|macOS|Linux|Android|HTML5|Demo)/i.test(b)) ?? null
    const price = tag(item, 'price') ?? '$0.00'
    const desc = decode((tag(item, 'description') ?? '').replace(/<!\[CDATA\[|\]\]>/g, ''))
      .replace(/<[^>]+>/g, '')
      .trim()
    out.push({
      url,
      title: decode(title),
      image: tag(item, 'imageurl'),
      price,
      free: /^\D*0(\.00)?$/.test(price),
      sale: Number(tag(item, 'discountpercent')) || null,
      summary: desc,
      genre,
    })
  }
  return out
}

// itch.io answers "429 Too Many Requests" when a page asks for many lists at
// once: fetch them two at a time, and wait and try again once on a 429.
let active = 0
const waiting: Array<() => void> = []
async function itchFetch(url: string): Promise<string> {
  if (active >= 2) await new Promise<void>((r) => waiting.push(r))
  active++
  try {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { headers: { 'user-agent': UA } })
      if (res.status === 429 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)))
        continue
      }
      if (!res.ok) throw new Error(`itch.io ${res.status}`)
      return await res.text()
    }
  } finally {
    active--
    waiting.shift()?.()
  }
}

/** The list's title says which filter itch.io applied: "Top Racing games for Linux…". A
 *  filter it didn't know gives the unfiltered list ("Top games for…"): treat that as empty. */
function filterApplied(xml: string): boolean {
  const title = /<title>([^<]*)<\/title>/.exec(xml)?.[1] ?? ''
  const before = title.split(/ games for /i)[0] ?? ''
  const rest = before.replace(/^(Top rated|Top free|Top selling|New and popular|Newest|On sale|Top|Free)\b/i, '').trim()
  return rest.length > 0
}

function browse(sort: string, genre: string, page: number): Promise<ItchGame[]> {
  const parts = ['games', sort, genre && `tag-${genre}`, 'platform-linux', 'input-gamepad'].filter(Boolean)
  const url = `https://itch.io/${parts.join('/')}.xml${page > 1 ? `?page=${page}` : ''}`
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.data
  const data = itchFetch(url).then((xml) => (genre && !filterApplied(xml) ? [] : parse(xml)))
  data.catch(() => cache.delete(url))
  cache.set(url, { at: Date.now(), data })
  return data
}

async function gameInfo(url: string) {
  const u = new URL(url)
  if (u.protocol !== 'https:' || !/^[a-z0-9-]+\.itch\.io$/i.test(u.hostname)) throw new Error('not an itch.io game page')
  const res = await fetch(`${u.origin}${u.pathname.replace(/\/$/, '')}/data.json`, { headers: { 'user-agent': UA } })
  if (!res.ok) throw new Error(`itch.io ${res.status}`)
  const d = (await res.json()) as { id: number; title: string; cover_image?: string; screenshots?: string[]; authors?: Array<{ name: string }>; tags?: string[] }
  return { id: d.id, title: d.title, image: d.cover_image ?? null, screenshots: d.screenshots ?? [], authors: (d.authors ?? []).map((a) => a.name), tags: d.tags ?? [] }
}

/** Games the itch app has installed (its local database; read only). */
async function installed() {
  const db = join(homedir(), '.var/app/io.itch.itch/config/itch/db/butler.db')
  if (!existsSync(db)) return []
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const conn = new DatabaseSync(db, { readOnly: true })
    try {
      const rows = conn
        .prepare(
          `SELECT g.id AS id, g.title AS title, g.cover_url AS image, g.url AS url, c.last_touched_at AS touched
           FROM caves c JOIN games g ON g.id = c.game_id ORDER BY c.last_touched_at DESC`,
        )
        .all() as Array<{ id: number; title: string; image: string | null; url: string | null; touched: string | null }>
      return rows
    } finally {
      conn.close()
    }
  } catch {
    return []
  }
}

type Req = { url?: string }
type Res = { statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: string) => void }

function json(res: Res, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

async function handle(req: Req, res: Res, next: () => void) {
  const url = req.url ?? ''
  if (!url.startsWith('/itch-api/')) return next()
  const u = new URL(url, 'http://localhost')
  try {
    if (u.pathname === '/itch-api/browse') {
      const sort = u.searchParams.get('sort') ?? ''
      const genre = u.searchParams.get('genre') ?? ''
      const page = Math.max(1, Math.min(50, Number(u.searchParams.get('page')) || 1))
      if (!SORTS.has(sort) || (genre && !GENRES.has(genre))) return json(res, 400, { error: 'unknown list' })
      return json(res, 200, await browse(sort, genre, page))
    }
    if (u.pathname === '/itch-api/game') return json(res, 200, await gameInfo(u.searchParams.get('url') ?? ''))
    if (u.pathname === '/itch-api/installed') return json(res, 200, await installed())
    return json(res, 404, { error: 'unknown' })
  } catch (e) {
    return json(res, 502, { error: String(e) })
  }
}

export function itchApi(): Plugin {
  return {
    name: 'itch-api',
    configureServer: (server) => void server.middlewares.use((req, res, next) => void handle(req, res as unknown as Res, next)),
    configurePreviewServer: (server) => void server.middlewares.use((req, res, next) => void handle(req, res as unknown as Res, next)),
  }
}
