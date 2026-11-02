// itch.io store: games for Linux that support a gamepad, from itch.io's own lists
// (popular, top rated, by tag...), at least half of the rows free games only.
// Rows load more as you scroll right; more rows appear as you scroll down.
// Picking a game offers to get it in the itch app, which signs in, buys and
// downloads; games it installed show at the top and on the Games page.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dialog } from '../components/Dialog'
import { Header } from '../components/Header'
import { Row } from '../components/Row'
import { Tile } from '../components/Tile'
import { currentElement, focusContent } from '../lib/focus'
import { hiddenSets, itemHidden, rowHidden, useHidden } from '../lib/hidden'
import { install, isInstalled, itchTiles, notify, refreshItch, useLibrary } from '../lib/library'
import { TileRow } from './shared'
import { browseItch, ITCH_APP, itchRows, itchGameId, itchInstall, itchPage, openInItch, type ItchGame, type ItchRowDef } from '../lib/itch'

const FIRST_ROWS = 6
const MORE_ROWS = 4

function priceBadge(g: ItchGame): string {
  if (g.free) return 'Free'
  return g.sale ? `${g.price} (−${g.sale}%)` : g.price
}

function ItchRow({ row, first, onPick }: { row: ItchRowDef; first?: boolean; onPick: (g: ItchGame) => void }) {
  const { title } = row
  const [games, setGames] = useState<ItchGame[] | null>(null)
  const page = useRef(1)
  const busy = useRef(false)
  const done = useRef(false)
  useEffect(() => {
    let live = true
    browseItch(row, 1)
      .then((g) => live && setGames(g))
      .catch(() => live && setGames([]))
    return () => {
      live = false
    }
  }, [row])
  const more = useCallback(() => {
    if (busy.current || done.current) return
    busy.current = true
    page.current += 1
    browseItch(row, page.current)
      .then((next) => {
        if (next.length === 0 && page.current > 6) done.current = true
        setGames((cur) => {
          const have = new Set((cur ?? []).map((g) => g.url))
          return [...(cur ?? []), ...next.filter((g) => !have.has(g.url))]
        })
      })
      .catch(() => (done.current = true))
      .finally(() => (busy.current = false))
  }, [row])
  // The page opens before any list has arrived: move onto the first game once it's here
  const loaded = Boolean(games?.length)
  useEffect(() => {
    if (first && loaded && currentElement()?.dataset.focusGroup === 'rail') focusContent()
  }, [first, loaded])
  const rules = useHidden()
  const h = useMemo(() => hiddenSets(rules), [rules])
  const shown = (games ?? []).filter((g) => !itemHidden(h, `itch:${g.url}`, g.genre))
  if ((games && shown.length === 0) || rowHidden(h, title, 'games')) return null
  return (
    <Row carousel first={first} title={title} count={shown.length} empty="Loading…" onNearEnd={more}>
      {shown.map((g, i) => (
        <Tile
          key={g.url}
          id={`itch:${title}:${g.url}`}
          optionsKey={`itch:${g.url}`}
          rowTitle={title}
          genre={g.genre ?? undefined}
          rowDomain="games"
          title={g.title}
          subtitle={g.genre ?? undefined}
          color="var(--tile-bg)"
          image={g.image ?? undefined}
          badge={priceBadge(g)}
          isDefault={first && i === 0}
          onSelect={() => onPick(g)}
        />
      ))}
    </Row>
  )
}

/** Games the itch app has installed: started directly, without the itch app's window. */
export function ItchInstalledRow({ first }: { first?: boolean }) {
  const lib = useLibrary()
  useEffect(() => void refreshItch(), [])
  if (lib.itch.length === 0) return null
  return <TileRow carousel first={first} title="itch.io games" tiles={itchTiles(lib.itch)} />
}

export function Itch() {
  const lib = useLibrary()
  const [picked, setPicked] = useState<ItchGame | null>(null)
  const close = useCallback(() => setPicked(null), [])
  const appReady = isInstalled(ITCH_APP)
  // A new order of rows each visit; a few at a time as you scroll down (itch.io
  // refuses many lists at once)
  const [rows] = useState(() => itchRows())
  const [shown, setShown] = useState(FIRST_ROWS)
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => Math.min(rows.length, n + MORE_ROWS))
      },
      { root: el.closest('[data-scroll]'), rootMargin: '0px 0px 900px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [rows, shown])

  const go = async (g: ItchGame, what: 'install' | 'page') => {
    setPicked(null)
    if (!appReady && !(await install(ITCH_APP, 'itch'))) return
    try {
      const id = await itchGameId(g.url)
      await openInItch(what === 'install' ? itchInstall(id) : itchPage(id), g.title)
    } catch {
      notify(`Couldn't open ${g.title} in the itch app`)
    }
  }

  return (
    <>
      <Header title="itch.io" />
      {lib.loaded && !appReady && (
        <p className="muted">Games install through the itch app; picking one installs the app first. Sign in to itch.io in it once.</p>
      )}
      <ItchInstalledRow first />
      {rows.slice(0, shown).map((r, i) => (
        <ItchRow key={r.title} row={r} first={i === 0} onPick={setPicked} />
      ))}
      <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} />
      <p className="muted attribution">Games for Linux with gamepad support, from itch.io's browse lists.</p>
      {picked && (
        <Dialog
          title={picked.title}
          message={[
            picked.genre,
            picked.free ? 'Free' : picked.sale ? `${picked.price}, ${picked.sale}% off` : picked.price,
            picked.summary,
          ]
            .filter(Boolean)
            .join(' · ')}
          onClose={close}
          options={[
            { label: picked.free ? 'Get it (itch app)' : 'Buy or get it (itch app)', onSelect: () => void go(picked, 'install') },
            { label: 'See its page in the itch app', onSelect: () => void go(picked, 'page') },
            { label: 'Close', onSelect: close },
          ]}
        />
      )}
    </>
  )
}
