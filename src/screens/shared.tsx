import { commonsImage } from '../data/catalog'
import { Row } from '../components/Row'
import { Tile } from '../components/Tile'
import { activate, useLibrary, type TileModel } from '../lib/library'
import { useCallback, useMemo, useState } from 'react'
import { hiddenSets, itemHidden, rowHidden, useHidden, type Domain } from '../lib/hidden'

const FIRST_TILES = 60 // tiles drawn at first; more are added as you scroll right
const MORE_TILES = 60

export function TileRow({
  title,
  tiles: allTiles,
  first,
  empty,
  extra,
  carousel,
  onNearEnd,
  domain,
  rowGenre,
}: {
  title: string
  tiles: TileModel[]
  first?: boolean
  empty?: string
  extra?: React.ReactNode
  carousel?: boolean
  onNearEnd?: () => void // the row's source can fetch more (Plex, Netflix)
  domain?: Domain // games or movies & TV: which hidden genres apply to the row
  rowGenre?: string // the genre the row is about (offered in tile options)
}) {
  const lib = useLibrary()
  const installed = new Set(lib.flatpaks.map((f) => f.appId))
  // Hidden things (Settings > Hidden): the whole row, or items in it
  const rules = useHidden()
  const h = useMemo(() => hiddenSets(rules), [rules])
  const rowIsHidden = rowHidden(h, title, domain)
  const visible = useMemo(
    () => (rules.length ? allTiles.filter((t) => !itemHidden(h, t.id, t.genre)) : allTiles),
    [allTiles, h, rules.length],
  )
  const tiles = visible
  // Long rows (thousands of games) are drawn a screenful at a time
  const [limit, setLimit] = useState(FIRST_TILES)
  const shown = tiles.length > limit ? tiles.slice(0, limit) : tiles
  const more = tiles.length > limit
  const nearEnd = useCallback(() => {
    if (more) setLimit((n) => n + MORE_TILES)
    else onNearEnd?.()
  }, [more, onNearEnd])
  const count = tiles.length + (extra ? 1 : 0)
  if (rowIsHidden || (tiles.length === 0 && !extra && !empty && allTiles.length > 0)) return null
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
            rowTitle={title}
            genre={t.genre}
            rowGenre={rowGenre}
            rowDomain={domain}
            badge={progress != null ? 'Installing' : missing ? 'Install' : t.badge}
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
