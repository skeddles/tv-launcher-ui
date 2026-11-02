// Rows of Plex movies or shows for the Movies and TV Shows pages, built from
// the library's genres, collections and decades plus a few fixed rows. The
// order is shuffled on every visit, weighted toward the rows you pick from most.
// Lists are kept for 30 minutes so going back to a page is instant.

import { tv, type PlexItem } from './bridge'
import type { TileModel } from './library'
import { getPrefs, setPrefs } from './prefs'

export type PlexKind = 'movie' | 'show'

export interface RowDef {
  key: string // what your picks are counted against, e.g. "genre:Comedy"
  title: string
  path: string // a Plex list path (without paging)
  shuffle: boolean // show the items in a fresh random order each visit
  baseWeight: number // how often it comes up near the top before you've picked anything
  load?: () => Promise<TileModel[]> // rows from elsewhere (Netflix) bring their own loader
}

const TTL = 30 * 60_000
const POOL = 40 // items fetched per row
const SHOWN = 20 // items shown per row
const MIN_ITEMS = 4 // rows with fewer are skipped

interface Dir {
  key: string
  title: string
  childCount?: number
}

const catalogs = new Map<PlexKind, { at: number; rows: Promise<RowDef[]> }>()
const pools = new Map<string, { at: number; items: Promise<PlexItem[]> }>()

async function get(path: string): Promise<{ Directory?: Dir[]; Metadata?: Array<Dir & { tile: PlexItem }> } | null> {
  if (!tv.plexGet) return null
  return (await tv.plexGet(path)) as never
}

async function buildCatalog(kind: PlexKind): Promise<RowDef[]> {
  const sections = ((await get('/library/sections'))?.Directory ?? []).filter((d) => (d as Dir & { type?: string }).type === kind)
  const noun = kind === 'movie' ? 'movies' : 'shows'
  const rows: RowDef[] = []
  for (const s of sections) {
    const base = `/library/sections/${s.key}/all`
    rows.push(
      { key: 'recent', title: 'Recently added', path: `${base}?sort=addedAt:desc`, shuffle: false, baseWeight: 4 },
      { key: 'unwatched', title: `Unwatched ${noun}`, path: `${base}?unwatched=1&sort=random`, shuffle: true, baseWeight: 2 },
      { key: 'top', title: 'Highly rated', path: `${base}?sort=audienceRating:desc`, shuffle: true, baseWeight: 2 },
    )
    if (kind === 'show') {
      rows.push({ key: 'rewatch', title: 'Watch again', path: `${base}?sort=viewCount:desc`, shuffle: true, baseWeight: 1 })
    }
    const [genres, collections, decades] = await Promise.all([
      get(`/library/sections/${s.key}/genre`),
      get(`/library/sections/${s.key}/collections`),
      get(`/library/sections/${s.key}/decade`),
    ])
    const genreTitles = new Set<string>()
    for (const g of genres?.Directory ?? []) {
      genreTitles.add(g.title.toLowerCase())
      rows.push({ key: `genre:${g.title}`, title: g.title, path: `${base}?genre=${g.key}&sort=random`, shuffle: true, baseWeight: 1 })
    }
    for (const c of collections?.Metadata ?? []) {
      if ((c.childCount ?? 0) < MIN_ITEMS) continue
      const title = genreTitles.has(c.title.toLowerCase()) ? `${c.title} collection` : c.title
      rows.push({ key: `collection:${c.title}`, title, path: c.key, shuffle: true, baseWeight: 1.5 })
    }
    for (const d of decades?.Directory ?? []) {
      rows.push({
        key: `decade:${d.title}`,
        title: `${d.title} ${noun}`,
        path: `${base}?decade=${d.key}&sort=random`,
        shuffle: true,
        baseWeight: 0.6,
      })
    }
  }
  // One row per title (several sections of one kind could repeat genres)
  const seen = new Set<string>()
  return rows.filter((r) => (seen.has(r.title) ? false : (seen.add(r.title), true)))
}

/** All the rows a page could show (cached for 30 minutes). */
export function catalog(kind: PlexKind): Promise<RowDef[]> {
  const c = catalogs.get(kind)
  if (c && Date.now() - c.at < TTL) return c.rows
  const rows = buildCatalog(kind)
  rows.catch(() => catalogs.delete(kind))
  catalogs.set(kind, { at: Date.now(), rows })
  return rows
}

function shuffled<T>(list: T[]): T[] {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** A row's items: a pool fetched at most every 30 minutes, shuffled per visit. */
export async function rowItems(row: RowDef): Promise<PlexItem[]> {
  let p = pools.get(row.path)
  if (!p || Date.now() - p.at > TTL) {
    const sep = row.path.includes('?') ? '&' : '?'
    const items = get(`${row.path}${sep}X-Plex-Container-Start=0&X-Plex-Container-Size=${POOL}`).then((d) =>
      (d?.Metadata ?? []).map((m) => m.tile).filter((t) => t && t.image),
    )
    items.catch(() => pools.delete(row.path))
    p = { at: Date.now(), items }
    pools.set(row.path, p)
  }
  const items = await p.items
  if (items.length < MIN_ITEMS) return []
  return (row.shuffle ? shuffled(items) : items).slice(0, SHOWN)
}

/** Row order for one visit: random, weighted toward rows you pick from often. */
export function orderRows(rows: RowDef[]): RowDef[] {
  const picks = getPrefs().plexRowPicks
  // Weighted random order (each row's key is random^(1/weight)).
  return rows
    .map((r) => ({ r, k: Math.random() ** (1 / (r.baseWeight + 3 * (picks[r.key] ?? 0))) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.r)
}

/** You picked something from this row: count it (older picks slowly count less). */
export function recordRowPick(key: string) {
  const picks: Record<string, number> = {}
  for (const [k, v] of Object.entries(getPrefs().plexRowPicks)) if (v * 0.97 > 0.05) picks[k] = v * 0.97
  picks[key] = (picks[key] ?? 0) + 1
  setPrefs({ plexRowPicks: picks })
}
