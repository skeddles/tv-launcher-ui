import { useCallback } from 'react'
import { forgetRecent, usePrefs } from '../lib/prefs'
import { closeTileMenu, setTileOptions, titleShown, useTileMenu, useTileOptions } from '../lib/tileMenu'
import { Dialog, type DialogOption } from './Dialog'
import { openGameInfo } from '../lib/gameInfo'

/** Options for one tile: Menu ☰ on the controller, or right-click. */
export function TileOptionsDialog() {
  const menu = useTileMenu()
  const options = useTileOptions(menu?.key ?? '')
  const recent = usePrefs((p) => p.recent)
  const close = useCallback(() => closeTileMenu(), [])
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
  items.push({ label: 'Done', onSelect: close })
  return <Dialog title={menu.title} options={items} onClose={close} />
}
