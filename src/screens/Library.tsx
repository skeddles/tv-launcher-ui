import { Header } from '../components/Header'
import { appTiles, gameTiles, useLibrary } from '../lib/library'
import { StoreTile } from './Home'
import { TileRow } from './shared'

export function Library() {
  const lib = useLibrary()
  return (
    <>
      <Header title="Library" />
      <TileRow first title="Games" tiles={gameTiles(lib.games)} />
      <TileRow
        title="Apps"
        tiles={appTiles(lib.flatpaks)}
        extra={<StoreTile row="Apps" />}
      />
    </>
  )
}
