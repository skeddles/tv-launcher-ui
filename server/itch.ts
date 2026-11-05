// itch.io for the launcher's itch.io store page: browse lists of games that run
// on Linux and support a gamepad, and look up a game's itch.io id (to hand to the
// itch app). itch.io's browse pages have RSS versions (append .xml), which is
// what this reads; its pages don't allow requests from another site, hence the
// dev server in between.
//
//   GET /itch-api/browse?sort=top-rated&free=1&tag=pixel-art&page=1  -> games
//   GET /itch-api/game?url=https://author.itch.io/game             -> { id, ... }
//   GET /itch-api/installed                                         -> games installed by the itch app

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const UA = 'Mozilla/5.0 (X11; Linux x86_64) tvlauncher/0.1'
const SORTS = new Set(['', 'top-rated', 'new-and-popular', 'newest', 'top-sellers', 'on-sale'])
// Any itch.io tag (tag-<name>, e.g. "pixel-art", "roguelike", "racing")
const TAG = /^[a-z0-9][a-z0-9-]{0,40}$/

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

/** The list's title says which tag itch.io applied: "Top Racing games for Linux…" or
 *  "Top free games for Linux… tagged Pixel Art". A tag it doesn't know gives the
 *  unfiltered list ("Top games for…"): treat that as empty. */
function tagApplied(xml: string): boolean {
  const title = (/<title>([^<]*)<\/title>/.exec(xml)?.[1] ?? '').replace(/&amp;/g, '&')
  if (/ tagged /i.test(title)) return true
  const before = title.split(/ games for /i)[0] ?? ''
  const rest = before
    .replace(/^(Top rated|Top selling|New & popular|New and popular|Newest|On sale|Top)\b/i, '')
    .replace(/\bfree\b/i, '')
    .trim()
  return rest.length > 0
}

function browse(sort: string, free: boolean, tag: string, page: number): Promise<ItchGame[]> {
  const parts = ['games', sort, free && 'price-free', tag && `tag-${tag}`, 'platform-linux', 'input-gamepad'].filter(Boolean)
  const url = `https://itch.io/${parts.join('/')}.xml${page > 1 ? `?page=${page}` : ''}`
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.data
  const data = itchFetch(url).then((xml) => (tag && !tagApplied(xml) ? [] : parse(xml)))
  data.catch(() => cache.delete(url))
  cache.set(url, { at: Date.now(), data })
  return data
}

async function gameInfo(url: string) {
  const u = new URL(url)
  if (u.protocol !== 'https:' || !/^[a-z0-9-]+\.itch\.io$/i.test(u.hostname)) throw new Error('not an itch.io game page')
  const res = await fetch(`${u.origin}${u.pathname.replace(/\/$/, '')}/data.json`, { headers: { 'user-agent': UA } })
  if (!res.ok) throw new Error(`itch.io ${res.status}`)
  const d = (await res.json()) as {
    id: number
    title: string
    cover_image?: string
    screenshots?: string[]
    authors?: Array<{ name: string }>
    tags?: string[]
  }
  return {
    id: d.id,
    title: d.title,
    image: d.cover_image ?? null,
    screenshots: d.screenshots ?? [],
    authors: (d.authors ?? []).map((a) => a.name),
    tags: d.tags ?? [],
  }
}

// Whether a newer build of an installed game is out: the itch app checks this
// when it runs, but games now start without it. Asked of itch.io with the
// sign-in the itch app keeps (its key never leaves this server), at most every
// 30 minutes per upload.
const BUILD_TTL = 30 * 60_000
const latestBuilds = new Map<number, { at: number; build: Promise<number | null> }>()

function latestBuild(uploadId: number, key: string): Promise<number | null> {
  const c = latestBuilds.get(uploadId)
  if (c && Date.now() - c.at < BUILD_TTL) return c.build
  const build = fetch(`https://api.itch.io/uploads/${uploadId}`, {
    headers: { authorization: key, 'user-agent': UA },
    signal: AbortSignal.timeout(10_000),
  })
    .then((r) => (r.ok ? (r.json() as Promise<{ upload?: { build_id?: number | null } }>) : null))
    .then((d) => d?.upload?.build_id ?? null)
    .catch(() => null)
  latestBuilds.set(uploadId, { at: Date.now(), build })
  return build
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
          `SELECT g.id AS id, g.title AS title, g.cover_url AS image, g.url AS url, c.last_touched_at AS touched,
                  c.install_folder_name AS folder, c.upload_id AS uploadId, c.build_id AS buildId
           FROM caves c JOIN games g ON g.id = c.game_id ORDER BY c.last_touched_at DESC`,
        )
        .all() as Array<{
        id: number
        title: string
        image: string | null
        url: string | null
        touched: string | null
        folder: string | null // in ~/.var/app/io.itch.itch/config/itch/apps/ (started from there directly)
        uploadId: number | null
        buildId: number | null
      }>
      const profile = conn.prepare('SELECT api_key AS key FROM profiles ORDER BY last_connected DESC LIMIT 1').get() as
        { key?: string } | undefined
      return Promise.all(
        rows.map(async ({ uploadId, buildId, ...g }) => {
          // Only games installed from a build (butler/wharf) have build numbers to compare
          const latest = profile?.key && uploadId && buildId ? await latestBuild(uploadId, profile.key) : null
          return { ...g, updateAvailable: latest != null && buildId != null && latest !== buildId }
        }),
      )
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
      let sort = u.searchParams.get('sort') ?? ''
      let free = u.searchParams.get('free') === '1'
      if (sort === 'free') [sort, free] = ['', true] // older pages
      const tag = u.searchParams.get('tag') ?? u.searchParams.get('genre') ?? ''
      const page = Math.max(1, Math.min(50, Number(u.searchParams.get('page')) || 1))
      if (!SORTS.has(sort) || (tag && !TAG.test(tag))) return json(res, 400, { error: 'unknown list' })
      return json(res, 200, await browse(sort, free, tag, page))
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
