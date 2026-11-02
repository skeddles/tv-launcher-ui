// Netflix rows for Movies / TV Shows: what's on Netflix in your country now
// (TMDB's "watch providers" data, from JustWatch), each opening its own page on
// Netflix. TMDB doesn't give Netflix links, so a title is only shown when
// Wikidata knows its Netflix ID (property P1874); others are left out.
// Requests to TMDB go through the launcher's server, which adds the keys
// (vite.config.ts); the keys never reach this page.

import type { TileModel } from './library'
import type { PlexKind, RowDef } from './plexRows'

const NETFLIX = 8 // TMDB's provider id for Netflix (US list checked Nov 2026)
const MIN_ITEMS = 4
const ID_CACHE = 'tvlauncher.netflixIds.v1'
const ID_TTL = 30 * 24 * 3600_000

interface TmdbTitle {
  id: number
  title?: string
  name?: string
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
}

let regionP: Promise<string | null> | null = null
/** The country from the TV's tmdb.json, or null when TMDB isn't set up. */
function region(): Promise<string | null> {
  regionP ??= fetch('/tmdb-region')
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { region?: string } | null) => d?.region ?? null)
    .catch(() => null)
  return regionP
}

async function tmdb<T>(path: string): Promise<T> {
  const r = await fetch(`/tmdb-api${path}`)
  if (!r.ok) throw new Error(`TMDB ${r.status}`)
  return r.json() as Promise<T>
}

// tmdb "movie:123" -> Netflix id or "" (none), cached for 30 days on this TV
type IdCache = Record<string, { n: string; at: number }>
function loadIds(): IdCache {
  try {
    return JSON.parse(localStorage.getItem(ID_CACHE) || '{}') as IdCache
  } catch {
    return {}
  }
}
function saveIds(c: IdCache) {
  try {
    localStorage.setItem(ID_CACHE, JSON.stringify(c))
  } catch {
    /* full or unavailable */
  }
}

/** Netflix ids for these TMDB titles (via TMDB's Wikidata link, then Wikidata). */
async function netflixIds(kind: 'movie' | 'tv', ids: number[]): Promise<Map<number, string>> {
  const cache = loadIds()
  const now = Date.now()
  const missing = ids.filter((id) => !cache[`${kind}:${id}`] || now - cache[`${kind}:${id}`].at > ID_TTL)
  if (missing.length) {
    const qids = await Promise.all(
      missing.map((id) =>
        tmdb<{ wikidata_id?: string | null }>(`/${kind}/${id}/external_ids`)
          .then((e) => e.wikidata_id ?? null)
          .catch(() => null),
      ),
    )
    const wanted = qids.filter((q): q is string => Boolean(q))
    let claims: Record<string, { claims?: { P1874?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> } }> = {}
    if (wanted.length) {
      const r = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&origin=*&ids=${wanted.slice(0, 50).join('|')}`,
      )
      if (r.ok) claims = ((await r.json()) as { entities: typeof claims }).entities
    }
    missing.forEach((id, i) => {
      const q = qids[i]
      const n = (q && claims[q]?.claims?.P1874?.[0]?.mainsnak?.datavalue?.value) || ''
      cache[`${kind}:${id}`] = { n, at: now }
    })
    saveIds(cache)
  }
  const out = new Map<number, string>()
  for (const id of ids) {
    const n = cache[`${kind}:${id}`]?.n
    if (n && /^\d+$/.test(n)) out.set(id, n)
  }
  return out
}

function rowLoader(kind: PlexKind, rowKey: string, query: string, pages: number) {
  const t = kind === 'movie' ? 'movie' : 'tv'
  let start = 1
  return async (n: number): Promise<TileModel[]> => {
    const reg = await region()
    if (!reg) return []
    // The first page is a random one of the first few; more follow it as you scroll right
    if (n === 0) start = 1 + Math.floor(Math.random() * pages)
    const page = start + n
    const data = await tmdb<{ results: TmdbTitle[] }>(
      `/discover/${t}?watch_region=${reg}&with_watch_providers=${NETFLIX}&sort_by=popularity.desc&page=${page}${query}`,
    )
    const results = data.results.filter((r) => r.backdrop_path)
    const ids = await netflixIds(
      t,
      results.map((r) => r.id),
    )
    const tiles = results
      .filter((r) => ids.has(r.id))
      .map((r): TileModel => ({
        id: `netflix:${t}:${r.id}`,
        title: r.title ?? r.name ?? '',
        subtitle: `${(r.release_date ?? r.first_air_date ?? '').slice(0, 4)} · Netflix`.replace(/^ · /, ''),
        color: 'var(--tile-bg)',
        tags: [],
        image: `https://image.tmdb.org/t/p/w780${r.backdrop_path}`,
        launch: { kind: 'chrome', url: `https://www.netflix.com/title/${ids.get(r.id)}` },
        kind: 'media',
        rowKey,
      }))
    return n > 0 || tiles.length >= MIN_ITEMS ? tiles : []
  }
}

let catalogs = new Map<PlexKind, Promise<RowDef[]>>()

/** Netflix rows (popular, and one per genre) - empty when TMDB isn't set up. */
export function netflixCatalog(kind: PlexKind): Promise<RowDef[]> {
  if (!catalogs.has(kind)) {
    const t = kind === 'movie' ? 'movie' : 'tv'
    const p = region().then(async (reg) => {
      if (!reg) return []
      const genres = await tmdb<{ genres: Array<{ id: number; name: string }> }>(`/genre/${t}/list`)
      const rows: RowDef[] = [
        {
          key: 'netflix:popular',
          title: 'Popular on Netflix',
          path: '',
          shuffle: false,
          baseWeight: 1.5,
          load: rowLoader(kind, 'netflix:popular', '', 1),
        },
      ]
      for (const g of genres.genres) {
        rows.push({
          key: `netflix:genre:${g.name}`,
          title: `${g.name} on Netflix`,
          path: '',
          shuffle: false,
          baseWeight: 0.5, // Plex rows come first unless you pick these
          load: rowLoader(kind, `netflix:genre:${g.name}`, `&with_genres=${g.id}`, 3),
        })
      }
      return rows
    })
    p.catch(() => catalogs.delete(kind))
    catalogs.set(kind, p)
  }
  return catalogs.get(kind)!
}

/** For tests: forget cached catalogs. */
export function resetNetflixCatalogs() {
  catalogs = new Map()
}
