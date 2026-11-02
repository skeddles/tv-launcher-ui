// Games: continue where you left off, Steam, then suggestion rows from the ROMs
// folder (a fresh mix each visit, leaning toward the systems you play). Every
// game, including ROMs Extra, is under All games.

import { useMemo, useState } from 'react'
import { Header } from '../components/Header'
import { Tile } from '../components/Tile'
import { emulatorSettingsTile, recentlyPlayed, suggestedRows } from '../lib/games'
import { gameTiles, romTiles, useLibrary } from '../lib/library'
import { goTo } from '../lib/place'
import { TileRow } from './shared'

/** Games started recently, the ones with a save state to resume first. */
export function ContinueRow({ first }: { first?: boolean }) {
  const lib = useLibrary()
  const recent = recentlyPlayed(lib.roms.games).slice(0, 12)
  if (recent.length === 0) return null
  const tiles = romTiles(lib, recent)
  return <TileRow first={first} carousel title="Continue playing" tiles={tiles} />
}

const newSeed = () => Math.floor(Math.random() * 2147483646) + 1

function AllGamesTile({ row }: { row: string }) {
  return <Tile id={`${row}:all-games`} title="All games" color="var(--tile-bg)" onSelect={() => goTo('allgames')} />
}

export function Games() {
  const lib = useLibrary()
  // A new mix each time the page opens, kept while you're on it
  const [seed] = useState(newSeed)
  const romsLoaded = lib.roms.games.length > 0
  const rows = useMemo(() => suggestedRows(lib.roms, seed), [lib.roms, seed])
  const hasRecent = lib.roms.games.some((g) => g.playedAt)

  return (
    <>
      <Header title="Games" />
      <ContinueRow first />
      {rows.slice(0, 1).map((r) => (
        <TileRow
          key={r.key}
          first={!hasRecent}
          carousel
          title={r.title}
          tiles={romTiles(lib, r.games)}
        />
      ))}
      <TileRow first={!hasRecent && !romsLoaded} title="Steam" tiles={gameTiles(lib.games)} />
      {rows.slice(1).map((r) => (
        <TileRow
          key={r.key}
          carousel
          title={r.title}
          tiles={romTiles(lib, r.games)}
        />
      ))}
      {romsLoaded && <TileRow title="More" tiles={[emulatorSettingsTile]} extra={<AllGamesTile row="More" />} />}
    </>
  )
}
