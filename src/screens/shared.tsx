import { commonsImage } from '../data/catalog'
import { Row } from '../components/Row'
import { Tile } from '../components/Tile'
import { activate, useLibrary, type TileModel } from '../lib/library'

export function TileRow({
  title,
  tiles,
  first,
  empty,
  extra,
  carousel,
}: {
  title: string
  tiles: TileModel[]
  first?: boolean
  empty?: string
  extra?: React.ReactNode
  carousel?: boolean
}) {
  const lib = useLibrary()
  const installed = new Set(lib.flatpaks.map((f) => f.appId))
  const count = tiles.length + (extra ? 1 : 0)
  return (
    <Row title={title} first={first} count={count} empty={empty} carousel={carousel}>
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
            logo={t.logo ? commonsImage(t.logo) : undefined}
            logoTone={t.logoTone}
            art={t.art}
            optionsKey={t.id}
            badge={progress != null ? 'Installing' : missing ? 'Install' : undefined}
            progress={progress ?? t.progress ?? undefined}
            subtitle={t.subtitle}
            isDefault={first && i === 0}
            onSelect={() => void activate(t)}
          />
        )
      })}
      {extra}
    </Row>
  )
}
