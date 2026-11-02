import { commonsImage } from '../data/catalog'
import { Row } from '../components/Row'
import { Tile } from '../components/Tile'
import { activate, useLibrary, type TileModel } from '../lib/library'
import { useCallback, useState } from 'react'

const FIRST_TILES = 60 // tiles drawn at first; more are added as you scroll right
const MORE_TILES = 60

export function TileRow({
  title,
  tiles,
  first,
  empty,
  extra,
  carousel,
  onNearEnd,
}: {
  title: string
  tiles: TileModel[]
  first?: boolean
  empty?: string
  extra?: React.ReactNode
  carousel?: boolean
  onNearEnd?: () => void // the row's source can fetch more (Plex, Netflix)
}) {
  const lib = useLibrary()
  const installed = new Set(lib.flatpaks.map((f) => f.appId))
  // Long rows (thousands of games) are drawn a screenful at a time
  const [limit, setLimit] = useState(FIRST_TILES)
  const shown = tiles.length > limit ? tiles.slice(0, limit) : tiles
  const more = tiles.length > limit
  const nearEnd = useCallback(() => {
    if (more) setLimit((n) => n + MORE_TILES)
    else onNearEnd?.()
  }, [more, onNearEnd])
  const count = tiles.length + (extra ? 1 : 0)
  return (
    <Row title={title} first={first} count={count} empty={empty} carousel={carousel} onNearEnd={nearEnd}>
      {shown.map((t, i) => {
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
            tag={t.tag}
            optionsKey={t.id}
            badge={progress != null ? 'Installing' : missing ? 'Install' : undefined}
            progress={progress ?? t.progress ?? undefined}
            subtitle={t.subtitle}
            isDefault={first && i === 0}
            onSelect={() => void activate(t)}
          />
        )
      })}
      {!more && extra}
    </Row>
  )
}
