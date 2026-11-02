// Settings > Hidden: what you've hidden, to show again, and hiding a genre
// before it shows up (genres from games, itch.io, Plex and Netflix).

import { useCallback, useEffect, useState } from 'react'
import { DOMAIN_NAME, hide, unhide, useHidden, type Domain, type HiddenRule } from '../lib/hidden'
import { ITCH_ROWS } from '../lib/itch'
import { useLibrary } from '../lib/library'
import { netflixCatalog } from '../lib/netflixRows'
import { catalog } from '../lib/plexRows'
import { Dialog } from './Dialog'

const KIND: Record<HiddenRule['kind'], string> = { item: '', row: 'Row: ', genre: 'Genre: ' }

/** Every genre the launcher knows of, by name: games (yours and itch.io) and movies & TV (Plex, Netflix). */
function useGenres(open: boolean): Record<Domain, string[]> {
  const lib = useLibrary()
  const [media, setMedia] = useState<string[]>([])
  useEffect(() => {
    if (!open) return
    let live = true
    Promise.all(
      (['movie', 'show'] as const).flatMap((k) => [catalog(k).catch(() => []), netflixCatalog(k).catch(() => [])]),
    ).then((lists) => {
      if (!live) return
      const names = lists
        .flat()
        .filter((r) => r.key.startsWith('genre:') || r.key.startsWith('netflix:genre:'))
        .map((r) => r.key.replace(/^(netflix:)?genre:/, ''))
      setMedia(names)
    })
    return () => {
      live = false
    }
  }, [open])
  const games = lib.roms.games.map((g) => g.genre).filter((g): g is string => Boolean(g))
  const itch = ITCH_ROWS.filter((r) => r.genre).map((r) => r.title)
  const unique = (names: string[]) => {
    const all = new Map<string, string>()
    for (const g of names) if (!all.has(g.toLowerCase())) all.set(g.toLowerCase(), g)
    return [...all.values()].sort((a, b) => a.localeCompare(b))
  }
  return { games: unique([...games, ...itch]), video: unique(media) }
}

export function HiddenSettings({ onClose }: { onClose: () => void }) {
  const rules = useHidden()
  const [picking, setPicking] = useState<Domain | null>(null)
  const genres = useGenres(picking !== null)
  const closePicker = useCallback(() => setPicking(null), [])

  if (picking) {
    const domain = picking
    const hiddenGenres = new Set(
      rules.filter((r) => r.kind === 'genre' && (r.domain ?? 'games') === domain).map((r) => r.value.toLowerCase()),
    )
    return (
      <Dialog
        title={`Hide a genre of ${DOMAIN_NAME[domain]}`}
        message={
          domain === 'games'
            ? 'Games of that genre, and its game rows, disappear from every page. Movies and TV are not affected.'
            : 'Its movie and TV rows disappear from every page. Games are not affected.'
        }
        onClose={closePicker}
        options={[
          ...genres[domain]
            .filter((g) => !hiddenGenres.has(g.toLowerCase()))
            .map((g) => ({
              label: g,
              onSelect: () => {
                hide({ kind: 'genre', value: g, label: `${g} (${DOMAIN_NAME[domain]})`, domain })
                setPicking(null)
              },
            })),
          { label: 'Cancel', onSelect: closePicker },
        ]}
      />
    )
  }

  return (
    <Dialog
      title="Hidden"
      message={
        rules.length
          ? 'Pick something to show it again. To hide more, use a tile’s Menu ☰ button (Hide this, its genre, or its row).'
          : 'Nothing is hidden. Use a tile’s Menu ☰ button to hide it, its genre, or its row.'
      }
      onClose={onClose}
      options={[
        { label: 'Hide a game genre…', onSelect: () => setPicking('games') },
        { label: 'Hide a movie & TV genre…', onSelect: () => setPicking('video') },
        ...rules.map((r) => ({
          label: `Show again: ${KIND[r.kind]}${r.kind === 'genre' && !r.domain ? `${r.label} (games)` : r.label}`,
          onSelect: () => unhide(r),
        })),
        { label: 'Done', onSelect: onClose },
      ]}
    />
  )
}
