import { Header } from '../components/Header'
import { appTiles, localTiles, useLibrary } from '../lib/library'
import { StoreTile } from './Home'
import { TileRow } from './shared'

export function Apps() {
  const lib = useLibrary()
  return (
    <>
      <Header title="Apps" />
      <TileRow first title="Installed" tiles={appTiles(lib.flatpaks)} extra={<StoreTile row="Installed" />} />
      {localTiles(lib.local, 'app').length > 0 && <TileRow title="Your apps" tiles={localTiles(lib.local, 'app')} />}
    </>
  )
}
