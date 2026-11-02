import { Header } from '../components/Header'
import { Tile } from '../components/Tile'
import { allTiles, appTiles, gameTiles, plexTiles, serviceTiles, useLibrary } from '../lib/library'
import { goTo } from '../lib/place'
import { usePrefs } from '../lib/prefs'
import { TileRow } from './shared'

export function StoreTile({ row }: { row: string }) {
  return <Tile id={`${row}:store`} title="App Store" color="var(--tile-bg)" onSelect={() => goTo('store')} />
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
      {lib.plex && lib.plex.continueWatching.length > 0 && (
        <TileRow carousel title="Continue watching" tiles={plexTiles(lib.plex.continueWatching)} />
      )}
      <TileRow first={recent.length === 0} title="Streaming" tiles={serviceTiles()} />
      {lib.plex && lib.plex.recentlyAdded.length > 0 && (
        <TileRow carousel title="Recently added on Plex" tiles={plexTiles(lib.plex.recentlyAdded)} />
      )}
      <TileRow title="Games" tiles={gameTiles(lib.games)} />
      <TileRow title="Apps" tiles={appTiles(lib.flatpaks)} extra={<StoreTile row="Apps" />} />
    </>
  )
}
