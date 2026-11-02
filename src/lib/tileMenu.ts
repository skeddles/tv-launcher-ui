// Options for one launcher tile (Menu ☰ on the controller, or right-click):
// per-tile settings kept in prefs, keyed by the tile's id.

import { useSyncExternalStore } from 'react'
import { currentElement } from './focus'
import { usePrefs, setPrefs, getPrefs, type TileOptions } from './prefs'

export interface OpenTileMenu {
  key: string // tile id, e.g. 'netflix' or 'flatpak:org.mozilla.firefox'
  title: string
  hasLogo: boolean
  row?: string // the row the tile is in
  genre?: string // the game's genre
  rowGenre?: string // the genre the row is about
  rowDomain?: 'games' | 'video'
}

let open: OpenTileMenu | null = null
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((l) => l())

export function openTileMenu(m: OpenTileMenu) {
  open = m
  changed()
}

export function closeTileMenu() {
  open = null
  changed()
}

/** Menu button: options for the highlighted tile, if a tile is highlighted. */
export function openMenuForFocused(): boolean {
  const el = currentElement()
  const key = el?.dataset.tileKey
  if (!el || !key) return false
  openTileMenu({
    key,
    title: el.getAttribute('aria-label') || key,
    hasLogo: el.dataset.tileLogo === 'true',
    row: el.dataset.tileRow,
    genre: el.dataset.tileGenre,
    rowGenre: el.dataset.rowGenre,
    rowDomain: el.dataset.rowDomain as 'games' | 'video' | undefined,
  })
  return true
}

export function useTileMenu(): OpenTileMenu | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => open,
  )
}

/** Whether the tile's name shows. Logo tiles hide it unless asked; others show it. */
export function titleShown(opts: TileOptions | undefined, hasLogo: boolean): boolean {
  return opts?.showTitle ?? !hasLogo
}

export function useTileOptions(key: string): TileOptions | undefined {
  return usePrefs((p) => p.tiles[key])
}

export function setTileOptions(key: string, patch: Partial<TileOptions>) {
  const tiles = getPrefs().tiles
  setPrefs({ tiles: { ...tiles, [key]: { ...tiles[key], ...patch } } })
}
