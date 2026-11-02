// Everything the launcher can open: built-in services, installed Flatpaks and
// Steam games, plus install progress. Module-level so it survives hot updates.

import { markAppOpened } from './appfront'
import { recordRowPick } from './plexRows'
import { currentElement } from './focus'
import { removeLaunchCover, showLaunchCover } from './launchCover'
import { useSyncExternalStore } from 'react'
import { tv, type InstalledFlatpak, type LaunchTarget, type PlexHome, type PlexItem, type SteamGame } from './bridge'
import { colorFor, hiddenApps, steamBigPicture, streaming, type Tag } from '../data/catalog'
import { markRecent } from './prefs'
import { romShortTags } from './romTags'
import { fetchRoms, markPlayed, romTile, type RomGame, type RomLibrary } from './games'

export interface TileModel {
  id: string
  title: string
  color: string
  tags: Tag[]
  launch: LaunchTarget
  needs?: string
  image?: string
  icon?: string
  logo?: string // Wikimedia Commons file name (see catalog.ts)
  logoTone?: 'white' | 'invert'
  art?: string // box art, shown whole on a blurred copy of itself (emulated games)
  romId?: string // an emulated game (games.ts)
  tag?: string // a short label on the art, telling copies of one game apart (region, version)
  unplayable?: string // why it can't start yet
  subtitle?: string
  progress?: number | null // percent watched (Plex)
  rowKey?: string // the Plex row it was picked from (for row ordering)
  kind: 'service' | 'app' | 'game' | 'media'
}

interface LibraryState {
  loaded: boolean
  flatpaks: InstalledFlatpak[]
  games: SteamGame[]
  installing: Record<string, number> // appId -> percent
  notice: string | null
  plex: PlexHome | null // null: not signed in to Plex, or not loaded yet
  roms: RomLibrary // emulated games on this TV
}

let state: LibraryState = { loaded: false, flatpaks: [], games: [], installing: {}, notice: null, plex: null, roms: { systems: [], games: [] } }
const listeners = new Set<() => void>()
let noticeTimer: ReturnType<typeof setTimeout> | undefined

function set(patch: Partial<LibraryState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function notify(message: string) {
  clearTimeout(noticeTimer)
  set({ notice: message })
  noticeTimer = setTimeout(() => set({ notice: null }), 4000)
}

export async function refreshLibrary() {
  const [flatpaks, games] = await Promise.all([
    tv.listFlatpaks().catch(() => [] as InstalledFlatpak[]),
    tv.listSteamGames().catch(() => [] as SteamGame[]),
  ])
  set({ loaded: true, flatpaks, games })
}

/** Emulated games: on start and after an app closes (Continue playing changes). */
export async function refreshRoms() {
  const roms = await fetchRoms().catch(() => null)
  if (roms) set({ roms })
}

/** Plex rows on Home: on start, every 5 minutes, and after an app closes (you may have watched something). */
export async function refreshPlex() {
  if (!tv.plexHome) return
  const plex = await tv.plexHome().catch(() => null)
  set({ plex })
}

export function plexTiles(items: PlexItem[], rowKey?: string): TileModel[] {
  return items.map((m) => ({
    rowKey,
    id: `plex:${m.ratingKey}`,
    title: m.title,
    subtitle: m.subtitle,
    color: 'var(--tile-bg)',
    tags: [],
    image: m.image ?? undefined,
    progress: m.progress,
    launch: { kind: 'plex' as const, ratingKey: m.ratingKey },
    kind: 'media' as const,
  }))
}

let started = false
export function startLibrary() {
  if (started) return
  started = true
  void refreshLibrary()
  void refreshPlex()
  void refreshRoms()
  setInterval(() => void refreshPlex(), 5 * 60 * 1000)
  tv.onEvent((e) => {
    if (e.type === 'install-progress') set({ installing: { ...state.installing, [e.appId]: e.percent } })
    if (e.type === 'notice') notify(e.message)
    if (e.type === 'volume' && e.volume != null) notify(`Volume ${e.volume}%`)
    if (e.type === 'app-exited' || e.type === 'web-closed') {
      void refreshLibrary()
      void refreshPlex()
      // RetroArch writes its save state as it closes; look a moment later too
      void refreshRoms()
      setTimeout(() => void refreshRoms(), 3000)
    }
  })
}

export function isInstalled(appId: string) {
  return state.flatpaks.some((f) => f.appId === appId)
}

export async function install(appId: string, label: string): Promise<boolean> {
  if (appId in state.installing) return false
  set({ installing: { ...state.installing, [appId]: 0 } })
  notify(`Installing ${label}…`)
  const result = await tv.storeInstall(appId).catch((e: unknown) => ({ ok: false, error: String(e) }))
  const { [appId]: _done, ...rest } = state.installing
  void _done
  set({ installing: rest })
  await refreshLibrary()
  notify(result.ok ? `${label} is installed` : `Couldn't install ${label}${result.error ? `: ${result.error}` : ''}`)
  return result.ok
}

export async function uninstall(appId: string, label: string) {
  const result = await tv.storeUninstall(appId)
  await refreshLibrary()
  notify(result.ok ? `${label} was removed` : `Couldn't remove ${label}`)
}

export async function activate(tile: TileModel) {
  if (tile.unplayable) {
    notify(tile.unplayable)
    return
  }
  if (tile.needs && !isInstalled(tile.needs)) {
    const ok = await install(tile.needs, tile.title)
    if (!ok) return
  }
  // The tile being opened: the highlighted one, or its first copy on screen.
  const focused = currentElement()
  const el =
    focused?.dataset.tileKey === tile.id ? focused : document.querySelector<HTMLElement>(`[data-tile-key="${CSS.escape(tile.id)}"]`)
  showLaunchCover(el, tile.title)
  if (tile.kind !== 'media') markRecent(tile.id) // Recently Opened is for apps
  if (tile.rowKey) recordRowPick(tile.rowKey)
  if (tile.romId) markPlayed(tile.romId)
  try {
    await tv.launch(tile.launch, tile.title)
    markAppOpened()
    // A web service opens inside the launcher's own window, in front of the cover.
    if (tile.launch.kind === 'web') removeLaunchCover(true)
  } catch (e) {
    removeLaunchCover()
    notify(`Couldn't open ${tile.title}: ${String(e)}`)
  }
}

// ----- derived tiles -----

export function serviceTiles(): TileModel[] {
  return streaming.map((s) => ({ ...s, kind: 'service' as const }))
}

export function appTiles(flatpaks: InstalledFlatpak[]): TileModel[] {
  const serviceApps = new Set(streaming.map((s) => s.needs).filter(Boolean))
  return flatpaks
    .filter((f) => !hiddenApps.has(f.appId) && !serviceApps.has(f.appId))
    .map((f) => ({
      id: `flatpak:${f.appId}`,
      title: f.name,
      color: colorFor(f.appId),
      tags: [],
      icon: f.icon,
      launch: { kind: 'flatpak' as const, appId: f.appId },
      kind: 'app' as const,
    }))
}

export function gameTiles(games: SteamGame[]): TileModel[] {
  return [
    ...games.map((g) => ({
      id: `steam:${g.appId}`,
      title: g.name,
      color: colorFor(g.appId),
      tags: ['games' as const],
      image: g.image,
      launch: { kind: 'steam' as const, appId: g.appId },
      kind: 'game' as const,
    })),
    { ...steamBigPicture, kind: 'game' as const },
  ]
}

export function romTiles(s: LibraryState = state, games: RomGame[] = s.roms.games): TileModel[] {
  const dups = duplicateTitles(s.roms.games)
  return games.map((g) => {
    const t = romTile(g, s.roms.systems)
    // Several copies of one game: say which this is (region, version...) under its name
    const tags = dups.has(`${g.system}:${g.title.toLowerCase()}`) ? romShortTags(g.file, g.system) : ''
    return tags ? { ...t, subtitle: `${t.subtitle} · ${tags}`, tag: tags } : t
  })
}

let dupCache: { games: RomGame[]; dups: Set<string> } | null = null
function duplicateTitles(games: RomGame[]): Set<string> {
  if (dupCache?.games === games) return dupCache.dups
  const seen = new Set<string>()
  const dups = new Set<string>()
  for (const g of games) {
    const k = `${g.system}:${g.title.toLowerCase()}`
    if (seen.has(k)) dups.add(k)
    seen.add(k)
  }
  dupCache = { games, dups }
  return dups
}

export function allTiles(s: LibraryState = state): TileModel[] {
  return [...serviceTiles(), ...gameTiles(s.games), ...appTiles(s.flatpaks), ...romTiles(s)]
}

export function useLibrary(): LibraryState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}
