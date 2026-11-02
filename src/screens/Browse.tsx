// Movies and TV Shows: Plex continue watching, the streaming services that carry
// each, then rows from the Plex library (genres, collections, decades...) in a
// fresh order each visit, weighted toward rows you pick from. More rows load as
// you scroll down.
import { useEffect, useRef, useState } from 'react'
import { Header } from '../components/Header'
import type { Tag } from '../data/catalog'
import { appTiles, plexTiles, serviceTiles, useLibrary } from '../lib/library'
import { catalog, orderRows, rowItems, type PlexKind, type RowDef } from '../lib/plexRows'
import type { PlexItem } from '../lib/bridge'
import { TileRow } from './shared'

const mediaApps = new Set(['tv.kodi.Kodi', 'org.jellyfin.JellyfinDesktop'])
const FIRST_ROWS = 5 // rows shown straight away
const MORE_ROWS = 4 // added each time you scroll near the bottom

function PlexRow({ row }: { row: RowDef }) {
  const [items, setItems] = useState<PlexItem[] | null>(null)
  useEffect(() => {
    let live = true
    rowItems(row)
      .then((i) => live && setItems(i))
      .catch(() => live && setItems([]))
    return () => {
      live = false
    }
  }, [row])
  if (!items || items.length === 0) return null
  return <TileRow carousel title={row.title} tiles={plexTiles(items, row.key)} />
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
    catalog(kind)
      .then((c) => live && setRows(orderRows(c)))
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
        <PlexRow key={r.key} row={r} />
      ))}
      {media.length > 0 && rows && shown >= rows.length && <TileRow title="Media Apps" tiles={media} />}
      <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} />
    </>
  )
}
