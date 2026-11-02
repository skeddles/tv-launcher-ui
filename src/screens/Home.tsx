import { useEffect, useMemo, useRef, useState } from 'react'
import { Header } from '../components/Header'
import { suggestedRows } from '../lib/games'
import { netflixCatalog } from '../lib/netflixRows'
import { catalog, orderRows, type PlexKind, type RowDef } from '../lib/plexRows'
import { MediaRow } from './Browse'
import { Tile } from '../components/Tile'
import { allTiles, appTiles, gameTiles, plexTiles, romTiles, serviceTiles, useLibrary } from '../lib/library'
import { goTo } from '../lib/place'
import { usePrefs } from '../lib/prefs'
import { ContinueRow, FavoritesRow } from './Games'
import { TileRow } from './shared'

export function StoreTile({ row }: { row: string }) {
  return <Tile id={`${row}:store`} title="App Store" color="var(--tile-bg)" onSelect={() => goTo('store')} />
}

// Below the fixed rows: rows from the other tabs (Movies, TV Shows, Games),
// mixed in a fresh random order each visit, added as you scroll down.
const FIRST_MIX = 3
const MORE_MIX = 3

type MixRow = { key: string; title: string; media?: RowDef; games?: string } // games: suggested row key

const noun = (k: PlexKind) => (k === 'movie' ? 'Movies' : 'TV')

/** A media row's name on Home, saying which tab it's from when the name alone doesn't. */
function mediaTitle(r: RowDef, kind: PlexKind): string {
  if (/\b(movies|shows)\b/i.test(r.title)) return r.title // "1990s movies", "Unwatched shows"
  return `${r.title} · ${noun(kind)}`
}

/** Take rows from several lists in turn, picking the list at random each time (bigger lists more often). */
function interleave(lists: MixRow[][]): MixRow[] {
  const pools = lists.map((l) => [...l]).filter((l) => l.length)
  const out: MixRow[] = []
  while (pools.length) {
    const total = pools.reduce((t, l) => t + l.length, 0)
    let r = Math.random() * total
    const i = Math.max(
      0,
      pools.findIndex((l) => (r -= l.length) < 0),
    )
    out.push(pools[i].shift()!)
    if (!pools[i].length) pools.splice(i, 1)
  }
  return out
}

function HomeMix() {
  const lib = useLibrary()
  const [media, setMedia] = useState<MixRow[][] | null>(null)
  const [seed] = useState(() => Math.floor(Math.random() * 2147483646) + 1)
  const [shown, setShown] = useState(FIRST_MIX)
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    const kinds: PlexKind[] = ['movie', 'show']
    Promise.all(
      kinds.map((k) =>
        Promise.all([catalog(k).catch(() => [] as RowDef[]), netflixCatalog(k).catch(() => [] as RowDef[])]).then(([plex, netflix]) =>
          orderRows([...plex, ...netflix]).map((r) => ({ key: `${k}:${r.key}`, title: mediaTitle(r, k), media: r })),
        ),
      ),
    ).then((lists) => live && setMedia(lists))
    return () => {
      live = false
    }
  }, [])

  const gameRows = useMemo(() => suggestedRows(lib.roms, seed), [lib.roms, seed])
  // One order for the visit: it changes only when the set of game rows does
  // (the games inside a row can still update)
  const gameKeys = gameRows.map((r) => `${r.key}\t${r.title}`).join('\n')
  const mix = useMemo(() => {
    if (!media) return []
    const games: MixRow[] = (gameKeys ? gameKeys.split('\n') : []).map((line) => {
      const [key, title] = line.split('\t')
      const label = key === 'picked' ? `${title} · Games` : key.startsWith('sys:') ? `${title} games` : `${title} · Games`
      return { key: `games:${key}`, title: label, games: key }
    })
    return interleave([...media, games])
  }, [media, gameKeys])

  useEffect(() => {
    const el = sentinel.current
    if (!el || !mix.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => Math.min(mix.length, n + MORE_MIX))
      },
      { root: el.closest('[data-scroll]'), rootMargin: '0px 0px 900px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [mix, shown])

  return (
    <>
      {mix.slice(0, shown).map((m) => {
        if (m.media) return <MediaRow key={m.key} row={m.media} title={m.title} />
        const g = gameRows.find((r) => r.key === m.games)
        return g ? <TileRow key={m.key} carousel title={m.title} tiles={romTiles(lib, g.games)} /> : null
      })}
      <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} />
    </>
  )
}

export function Home() {
  const lib = useLibrary()
  const recentIds = usePrefs((p) => p.recent)
  const everything = allTiles(lib)
  const recent = recentIds.map((id) => everything.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => Boolean(t))

  return (
    <>
      <Header title="Home" />
      {recent.length > 0 && <TileRow first carousel title="Recently Opened" tiles={recent} />}
      <ContinueRow first={recent.length === 0} />
      <FavoritesRow />
      {lib.plex && lib.plex.continueWatching.length > 0 && (
        <TileRow carousel title="Continue watching" tiles={plexTiles(lib.plex.continueWatching)} />
      )}
      <TileRow first={recent.length === 0} title="Streaming" tiles={serviceTiles()} />
      {lib.plex && lib.plex.recentlyAdded.length > 0 && (
        <TileRow carousel title="Recently added on Plex" tiles={plexTiles(lib.plex.recentlyAdded)} />
      )}
      <TileRow title="Games" tiles={gameTiles(lib.games)} />
      <TileRow title="Apps" tiles={appTiles(lib.flatpaks)} extra={<StoreTile row="Apps" />} />
      <HomeMix />
    </>
  )
}
