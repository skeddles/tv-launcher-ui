import { useCallback, useState } from 'react'
import { activate, allTiles, checkItchUpdate, deleteRom, favoriteRom, updateItchGame, useLibrary } from '../lib/library'
import { ITCH_APP, itchPlay } from '../lib/itch'
import { forgetRecent, usePrefs } from '../lib/prefs'
import { closeTileMenu, setTileOptions, titleShown, useTileMenu, useTileOptions } from '../lib/tileMenu'
import { Dialog, type DialogOption } from './Dialog'
import { openGameInfo } from '../lib/gameInfo'
import { DOMAIN_NAME, hide, type Domain } from '../lib/hidden'

/** Options for one tile: Menu ☰ on the controller, or right-click. */
export function TileOptionsDialog() {
  const menu = useTileMenu()
  const options = useTileOptions(menu?.key ?? '')
  const recent = usePrefs((p) => p.recent)
  const lib = useLibrary()
  // The tile whose "Delete game" was picked, waiting for a yes
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string; file: string } | null>(null)
  const close = useCallback(() => closeTileMenu(), [])
  const closeConfirm = useCallback(() => setConfirmDelete(null), [])
  if (confirmDelete) {
    return (
      <Dialog
        title={`Delete ${confirmDelete.title}?`}
        message={`This deletes ${confirmDelete.file} from the TV for good. Your saved game stays, and the copy on your desktop isn't touched.`}
        onClose={closeConfirm}
        options={[
          { label: 'Keep it', onSelect: closeConfirm },
          {
            label: 'Delete',
            onSelect: () => {
              const { id, title } = confirmDelete
              setConfirmDelete(null)
              void deleteRom(id, title)
            },
          },
        ]}
      />
    )
  }
  if (!menu) return null
  const shown = titleShown(options, menu.hasLogo)
  const items: DialogOption[] = []
  // An itch game: start it, update it, or open it in the itch app
  const itchGame = menu.key.startsWith('itch:') ? lib.itch.find((g) => `itch:${g.id}` === menu.key) : undefined
  if (itchGame) {
    const tile = allTiles(lib).find((t) => t.id === menu.key)
    if (itchGame.caveId) {
      const cave = itchGame.caveId
      items.push(
        itchGame.updateAvailable
          ? {
              label: 'Update now',
              onSelect: () => {
                close()
                void updateItchGame(cave, menu.title)
              },
            }
          : {
              label: `Check for updates${itchGame.version ? ` (v${itchGame.version})` : ''}`,
              onSelect: () => {
                close()
                void checkItchUpdate(itchGame.id, menu.title)
              },
            },
      )
    }
    if (tile && itchGame.updateAvailable) {
      items.push({
        label: 'Play without updating',
        onSelect: () => {
          close()
          void activate({ ...tile, updateAvailable: false })
        },
      })
    }
    items.push({
      label: 'Open in the itch app',
      onSelect: () => {
        close()
        void activate({
          id: 'flatpak:io.itch.itch',
          title: 'itch',
          color: 'var(--tile-bg)',
          tags: [],
          kind: 'app',
          launch: { kind: 'flatpak', appId: ITCH_APP, args: [itchPlay(itchGame.id)] },
        })
      },
    })
  }
  // A Steam game: Big Picture has its updates, launch options and properties
  if (menu.key.startsWith('steam:')) {
    const bp = allTiles(lib).find((t) => t.id === 'steam-bigpicture')
    if (bp) {
      items.push({
        label: 'Open Steam Big Picture (updates, launch options)',
        onSelect: () => {
          close()
          void activate(bp)
        },
      })
    }
  }
  if (menu.key.startsWith('rom:')) {
    items.push({
      label: 'Game info',
      onSelect: () => {
        close()
        openGameInfo(menu.key.slice(4))
      },
    })
    const id = menu.key.slice(4)
    const game = lib.roms.games.find((g) => g.id === id)
    const fav = (lib.roms.favorites ?? []).includes(id)
    items.push({
      label: fav ? 'Remove from Favorites' : 'Add to Favorites',
      onSelect: () => {
        close()
        void favoriteRom(id, !fav, menu.title)
      },
    })
    if (game) {
      items.push({
        label: 'Delete game…',
        onSelect: () => {
          close()
          setConfirmDelete({ id, title: menu.title, file: game.file })
        },
      })
    }
  }
  items.push({
    label: `Name on tile: ${shown ? 'Shown' : 'Hidden'}`,
    onSelect: () => setTileOptions(menu.key, { showTitle: !shown }),
  })
  if (recent.includes(menu.key)) {
    items.push({
      label: 'Remove from Recently Opened',
      onSelect: () => {
        forgetRecent(menu.key)
        close()
      },
    })
  }
  // Hiding: this tile, its genre, or the row it's in (undo in Settings > Hidden)
  items.push({
    label: 'Hide this',
    onSelect: () => {
      hide({ kind: 'item', value: menu.key, label: menu.title })
      close()
    },
  })
  // A genre: the game's own, else the one the row is about. Games and movies & TV keep separate genres.
  const genre = menu.genre ?? menu.rowGenre
  const domain: Domain | undefined = menu.genre ? 'games' : menu.rowDomain
  if (genre && domain) {
    items.push({
      label: `Hide all ${genre} ${domain === 'games' ? 'games' : '(movies & TV)'}`,
      onSelect: () => {
        hide({ kind: 'genre', value: genre, label: `${genre} (${DOMAIN_NAME[domain]})`, domain })
        close()
      },
    })
  }
  if (menu.row) {
    const row = menu.row
    items.push({
      label: `Hide the row “${row}”`,
      onSelect: () => {
        hide({ kind: 'row', value: row, label: row })
        close()
      },
    })
  }
  items.push({ label: 'Done', onSelect: close })
  return <Dialog title={menu.title} options={items} onClose={close} />
}
