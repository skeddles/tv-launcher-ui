// itch.io store: games for Linux that support a gamepad, from itch.io's own lists
// (popular, top rated, free, by genre...). Rows load more as you scroll right.
// Picking a game offers to get it in the itch app, which signs in, buys and
// downloads; games it installed show at the top and on the Games page.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dialog } from '../components/Dialog'
import { Header } from '../components/Header'
import { Row } from '../components/Row'
import { Tile } from '../components/Tile'
import { currentElement, focusContent } from '../lib/focus'
import { hiddenSets, itemHidden, rowHidden, useHidden } from '../lib/hidden'
import { install, isInstalled, notify, useLibrary } from '../lib/library'
import {
  browseItch,
  installedItchGames,
  ITCH_APP,
  ITCH_ROWS,
  itchGameId,
  itchInstall,
  itchPage,
  itchPlay,
  openInItch,
  type InstalledItchGame,
  type ItchGame,
} from '../lib/itch'

function priceBadge(g: ItchGame): string {
  if (g.free) return 'Free'
  return g.sale ? `${g.price} (−${g.sale}%)` : g.price
}

function ItchRow({ title, sort, genre, first, onPick }: { title: string; sort?: string; genre?: string; first?: boolean; onPick: (g: ItchGame) => void }) {
  const [games, setGames] = useState<ItchGame[] | null>(null)
  const page = useRef(1)
  const busy = useRef(false)
  const done = useRef(false)
  useEffect(() => {
    let live = true
    browseItch(sort, genre, 1)
      .then((g) => live && setGames(g))
      .catch(() => live && setGames([]))
    return () => {
      live = false
    }
  }, [sort, genre])
  const more = useCallback(() => {
    if (busy.current || done.current) return
    busy.current = true
    page.current += 1
    browseItch(sort, genre, page.current)
      .then((next) => {
        if (next.length === 0 && page.current > 6) done.current = true
        setGames((cur) => {
          const have = new Set((cur ?? []).map((g) => g.url))
          return [...(cur ?? []), ...next.filter((g) => !have.has(g.url))]
        })
      })
      .catch(() => (done.current = true))
      .finally(() => (busy.current = false))
  }, [sort, genre])
  // The page opens before any list has arrived: move onto the first game once it's here
  const loaded = Boolean(games?.length)
  useEffect(() => {
    if (first && loaded && currentElement()?.dataset.focusGroup === 'rail') focusContent()
  }, [first, loaded])
  const rules = useHidden()
  const h = useMemo(() => hiddenSets(rules), [rules])
  const shown = (games ?? []).filter((g) => !itemHidden(h, `itch:${g.url}`, g.genre))
  if ((games && shown.length === 0) || rowHidden(h, title)) return null
  return (
    <Row carousel first={first} title={title} count={shown.length} empty="Loading…" onNearEnd={more}>
      {shown.map((g, i) => (
        <Tile
          key={g.url}
          id={`itch:${title}:${g.url}`}
          optionsKey={`itch:${g.url}`}
          rowTitle={title}
          genre={g.genre ?? undefined}
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

/** Games the itch app has installed: play them (through the itch app). */
export function ItchInstalledRow({ first }: { first?: boolean }) {
  const [games, setGames] = useState<InstalledItchGame[]>([])
  useEffect(() => {
    void installedItchGames().then(setGames)
  }, [])
  if (games.length === 0) return null
  return (
    <Row carousel first={first} title="itch.io games" count={games.length}>
      {games.map((g) => (
        <Tile
          key={g.id}
          id={`itch-installed:${g.id}`}
          title={g.title}
          color="var(--tile-bg)"
          image={g.image ?? undefined}
          onSelect={() => void openInItch(itchPlay(g.id), g.title)}
        />
      ))}
    </Row>
  )
}

export function Itch() {
  const lib = useLibrary()
  const [picked, setPicked] = useState<ItchGame | null>(null)
  const close = useCallback(() => setPicked(null), [])
  const appReady = isInstalled(ITCH_APP)

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
      {ITCH_ROWS.map((r, i) => (
        <ItchRow key={r.title} title={r.title} sort={r.sort} genre={r.genre} first={i === 0} onPick={setPicked} />
      ))}
      <p className="muted attribution">Games for Linux with gamepad support, from itch.io's browse lists.</p>
      {picked && (
        <Dialog
          title={picked.title}
          message={[picked.genre, picked.free ? 'Free' : picked.sale ? `${picked.price}, ${picked.sale}% off` : picked.price, picked.summary]
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
