import { Header } from '../components/Header'
import { gameTiles, useLibrary } from '../lib/library'
import { TileRow } from './shared'

export function Games() {
  const lib = useLibrary()
  return (
    <>
      <Header title="Games" />
      <TileRow first title="Steam" tiles={gameTiles(lib.games)} />
    </>
  )
}
