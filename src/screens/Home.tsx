import { Header } from '../components/Header'
import { Tile } from '../components/Tile'
import { allTiles, appTiles, gameTiles, serviceTiles, useLibrary } from '../lib/library'
import { goTo } from '../lib/place'
import { usePrefs } from '../lib/prefs'
import { TileRow } from './shared'

export function StoreTile({ row }: { row: string }) {
  return <Tile id={`${row}:store`} title="App Store" color="#1C2A44" onSelect={() => goTo('store')} />
}

export function Home() {
  const lib = useLibrary()
  const recentIds = usePrefs((p) => p.recent)
  const everything = allTiles(lib)
  const recent = recentIds
    .map((id) => everything.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .slice(0, 6)

  return (
    <>
      <Header title="Home" />
      {recent.length > 0 && <TileRow first title="Recently Opened" tiles={recent} />}
      <TileRow first={recent.length === 0} title="Streaming" tiles={serviceTiles()} />
      <TileRow title="Games" tiles={gameTiles(lib.games)} />
      <TileRow title="Apps" tiles={appTiles(lib.flatpaks)} extra={<StoreTile row="Apps" />} />
    </>
  )
}
