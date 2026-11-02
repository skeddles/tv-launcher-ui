// Settings > Hidden: what you've hidden, to show again, and hiding a genre
// before it shows up (genres from games, itch.io, Plex and Netflix).

import { useCallback, useEffect, useState } from 'react'
import { hide, unhide, useHidden, type HiddenRule } from '../lib/hidden'
import { ITCH_ROWS } from '../lib/itch'
import { useLibrary } from '../lib/library'
import { netflixCatalog } from '../lib/netflixRows'
import { catalog } from '../lib/plexRows'
import { Dialog } from './Dialog'

const KIND: Record<HiddenRule['kind'], string> = { item: '', row: 'Row: ', genre: 'Genre: ' }

/** Every genre the launcher knows of, by name. */
function useGenres(open: boolean): string[] {
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
  const all = new Map<string, string>()
  for (const g of [...games, ...itch, ...media]) if (!all.has(g.toLowerCase())) all.set(g.toLowerCase(), g)
  return [...all.values()].sort((a, b) => a.localeCompare(b))
}

export function HiddenSettings({ onClose }: { onClose: () => void }) {
  const rules = useHidden()
  const [picking, setPicking] = useState(false)
  const genres = useGenres(picking)
  const closePicker = useCallback(() => setPicking(false), [])

  if (picking) {
    const hiddenGenres = new Set(rules.filter((r) => r.kind === 'genre').map((r) => r.value.toLowerCase()))
    return (
      <Dialog
        title="Hide a genre"
        message="Its rows, and games of that genre, disappear from every page."
        onClose={closePicker}
        options={[
          ...genres
            .filter((g) => !hiddenGenres.has(g.toLowerCase()))
            .map((g) => ({
              label: g,
              onSelect: () => {
                hide({ kind: 'genre', value: g, label: g })
                setPicking(false)
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
        { label: 'Hide a genre…', onSelect: () => setPicking(true) },
        ...rules.map((r) => ({ label: `Show again: ${KIND[r.kind]}${r.label}`, onSelect: () => unhide(r) })),
        { label: 'Done', onSelect: onClose },
      ]}
    />
  )
}
