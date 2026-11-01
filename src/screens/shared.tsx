import { Row } from '../components/Row'
import { Tile } from '../components/Tile'
import { activate, useLibrary, type TileModel } from '../lib/library'

export function TileRow({
  title,
  tiles,
  first,
  empty,
  extra,
}: {
  title: string
  tiles: TileModel[]
  first?: boolean
  empty?: string
  extra?: React.ReactNode
}) {
  const lib = useLibrary()
  const installed = new Set(lib.flatpaks.map((f) => f.appId))
  const count = tiles.length + (extra ? 1 : 0)
  return (
    <Row title={title} first={first} count={count} empty={empty}>
      {tiles.map((t, i) => {
        const progress = t.needs != null ? lib.installing[t.needs] : undefined
        const missing = lib.loaded && t.needs != null && !installed.has(t.needs)
        return (
          <Tile
            key={t.id}
            id={`${title}:${t.id}`}
            title={t.title}
            color={t.color}
            image={t.image}
            icon={t.icon}
            badge={progress != null ? 'Installing' : missing ? 'Install' : undefined}
            progress={progress}
            isDefault={first && i === 0}
            onSelect={() => void activate(t)}
          />
        )
      })}
      {extra}
    </Row>
  )
}
