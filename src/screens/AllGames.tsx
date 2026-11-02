// All games: every ROM on the TV, the extras too: one row per system, A–Z, that
// scrolls sideways (a few lines tall when the system has many games).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Header } from '../components/Header'
import { romTiles, useLibrary } from '../lib/library'
import type { RomGame } from '../lib/games'
import { TileRow } from './shared'

const FIRST_ROWS = 6
const MORE_ROWS = 6

interface Section {
  key: string
  title: string
  games: RomGame[]
}

const sortKey = (g: RomGame) => g.title.toLowerCase().replace(/^the /, '')
function sections(games: RomGame[], systems: Array<{ id: string; name: string }>): Section[] {
  const out: Section[] = []
  for (const sys of systems) {
    const list = games.filter((g) => g.system === sys.id).sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    if (list.length) out.push({ key: sys.id, title: `${sys.name} (${list.length.toLocaleString()})`, games: list })
  }
  return out
}

export function AllGames() {
  const lib = useLibrary()
  const all = useMemo(() => sections(lib.roms.games, lib.roms.systems), [lib.roms])
  const [shown, setShown] = useState(FIRST_ROWS)
  const sentinel = useRef<HTMLDivElement>(null)
  const count = lib.roms.games.length

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => Math.min(all.length, n + MORE_ROWS))
      },
      { root: el.closest('[data-scroll]'), rootMargin: '0px 0px 900px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [all, shown])

  return (
    <>
      <Header title={count ? `All games (${count.toLocaleString()})` : 'All games'} />
      {all.length === 0 && <p className="muted">No games yet. ROMs go in the Games folder on the TV.</p>}
      {all.slice(0, shown).map((s, i) => (
        <TileRow
          key={s.key}
          first={i === 0}
          title={s.title}
          tiles={romTiles(lib, s.games)}
        />
      ))}
      <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} />
    </>
  )
}
