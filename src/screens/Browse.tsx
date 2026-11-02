// Movies and TV Shows: Plex continue watching, the streaming services that carry
// each, then rows from the Plex library (genres, collections, decades...) in a
// fresh order each visit, weighted toward rows you pick from. More rows load as
// you scroll down.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Header } from '../components/Header'
import type { Tag } from '../data/catalog'
import { appTiles, plexTiles, serviceTiles, useLibrary, type TileModel } from '../lib/library'
import { netflixCatalog } from '../lib/netflixRows'
import { catalog, orderRows, rowItems, type PlexKind, type RowDef } from '../lib/plexRows'
import type { PlexItem } from '../lib/bridge'
import { TileRow } from './shared'

const mediaApps = new Set(['tv.kodi.Kodi', 'org.jellyfin.JellyfinDesktop'])
const FIRST_ROWS = 5 // rows shown straight away
const MORE_ROWS = 4 // added each time you scroll near the bottom

/** One row: Plex items, or tiles from the row's own loader (Netflix), which
 *  fetches another page each time you scroll near the end. */
function MediaRow({ row }: { row: RowDef }) {
  const [tiles, setTiles] = useState<TileModel[] | null>(null)
  const page = useRef(0)
  const busy = useRef(false)
  const done = useRef(false)
  useEffect(() => {
    let live = true
    page.current = 0
    done.current = !row.load
    const load = row.load ? row.load(0) : rowItems(row).then((items: PlexItem[]) => plexTiles(items, row.key))
    load.then((t) => live && setTiles(t)).catch(() => live && setTiles([]))
    return () => {
      live = false
    }
  }, [row])
  const more = useCallback(() => {
    if (!row.load || busy.current || done.current) return
    busy.current = true
    page.current += 1
    row
      .load(page.current)
      .then((next) => {
        if (next.length === 0) done.current = true
        setTiles((cur) => {
          const have = new Set((cur ?? []).map((t) => t.id))
          return [...(cur ?? []), ...next.filter((t) => !have.has(t.id))]
        })
      })
      .catch(() => (done.current = true))
      .finally(() => (busy.current = false))
  }, [row])
  if (!tiles || tiles.length === 0) return null
  return <TileRow carousel title={row.title} tiles={tiles} onNearEnd={more} />
}

export function Browse({ title, tag }: { title: string; tag: Tag }) {
  const lib = useLibrary()
  const kind: PlexKind = tag === 'movies' ? 'movie' : 'show'
  const [rows, setRows] = useState<RowDef[] | null>(null)
  const [shown, setShown] = useState(FIRST_ROWS)
  const sentinel = useRef<HTMLDivElement>(null)

  // A new random order each time the page opens (catalog is cached, so this is quick).
  useEffect(() => {
    let live = true
    // Plex rows, plus Netflix rows when TMDB is set up on this TV
    Promise.all([catalog(kind).catch(() => [] as RowDef[]), netflixCatalog(kind).catch(() => [] as RowDef[])])
      .then(([plex, netflix]) => live && setRows(orderRows([...plex, ...netflix])))
      .catch(() => live && setRows([]))
    return () => {
      live = false
    }
  }, [kind])

  // Near the bottom: show more rows.
  useEffect(() => {
    const el = sentinel.current
    if (!el || !rows) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => Math.min(rows.length, n + MORE_ROWS))
      },
      { root: el.closest('[data-scroll]'), rootMargin: '0px 0px 900px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [rows, shown])

  const services = serviceTiles().filter((s) => s.tags.includes(tag))
  const media = appTiles(lib.flatpaks).filter((a) => a.launch.kind === 'flatpak' && mediaApps.has(a.launch.appId))
  const cw = (lib.plex?.continueWatching ?? []).filter((m) => (kind === 'movie' ? m.type === 'movie' : m.type === 'episode'))

  return (
    <>
      <Header title={title} />
      {cw.length > 0 && <TileRow first carousel title="Continue watching" tiles={plexTiles(cw)} />}
      <TileRow first={cw.length === 0} title="Streaming Services" tiles={services} />
      {(rows ?? []).slice(0, shown).map((r) => (
        <MediaRow key={r.key} row={r} />
      ))}
      {media.length > 0 && rows && shown >= rows.length && <TileRow title="Media Apps" tiles={media} />}
      {rows?.some((r) => r.key.startsWith('netflix:')) && (
        <p className="muted attribution">
          Netflix titles: what's available from JustWatch, via TMDB. This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </p>
      )}
      <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} />
    </>
  )
}
