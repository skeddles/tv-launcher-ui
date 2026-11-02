// All games: every ROM on the TV, the extras too, one system after another in
// A–Z rows. Rows are added as you scroll down (there can be thousands of games).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Header } from '../components/Header'
import { romTiles, useLibrary } from '../lib/library'
import type { RomGame } from '../lib/games'
import { TileRow } from './shared'

const ROW_SIZE = 40 // games per row; bigger systems get several A–Z rows
const FIRST_ROWS = 6
const MORE_ROWS = 6

interface Section {
  key: string
  title: string
  games: RomGame[]
}

const sortKey = (g: RomGame) => g.title.toLowerCase().replace(/^the /, '')
const letter = (g: RomGame) => {
  const c = sortKey(g).charAt(0).toUpperCase()
  return /[A-Z]/.test(c) ? c : '#'
}

function sections(games: RomGame[], systems: Array<{ id: string; name: string }>): Section[] {
  const out: Section[] = []
  for (const sys of systems) {
    for (const extra of [false, true]) {
      const list = games.filter((g) => g.system === sys.id && g.extra === extra).sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
      if (list.length === 0) continue
      const name = extra ? `${sys.name} · more` : sys.name
      if (list.length <= ROW_SIZE * 1.5) {
        out.push({ key: `${sys.id}:${extra}`, title: name, games: list })
        continue
      }
      for (let i = 0; i < list.length; i += ROW_SIZE) {
        const part = list.slice(i, i + ROW_SIZE)
        const a = letter(part[0])
        const b = letter(part[part.length - 1])
        out.push({ key: `${sys.id}:${extra}:${i}`, title: `${name}: ${a === b ? a : `${a}–${b}`}`, games: part })
      }
    }
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
          carousel
          title={s.title}
          tiles={romTiles(lib, s.games)}
        />
      ))}
      <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} />
    </>
  )
}
