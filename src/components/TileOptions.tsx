import { useCallback, useState } from 'react'
import { deleteRom, favoriteRom, useLibrary } from '../lib/library'
import { forgetRecent, usePrefs } from '../lib/prefs'
import { closeTileMenu, setTileOptions, titleShown, useTileMenu, useTileOptions } from '../lib/tileMenu'
import { Dialog, type DialogOption } from './Dialog'
import { openGameInfo } from '../lib/gameInfo'
import { hide } from '../lib/hidden'

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
  items.push(
    {
      label: `Name on tile: ${shown ? 'Shown' : 'Hidden'}`,
      onSelect: () => setTileOptions(menu.key, { showTitle: !shown }),
    },
  )
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
  if (menu.genre) {
    const genre = menu.genre
    items.push({
      label: `Hide all ${genre}`,
      onSelect: () => {
        hide({ kind: 'genre', value: genre, label: genre })
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
