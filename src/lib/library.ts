// Everything the launcher can open: built-in services, installed Flatpaks and
// Steam games, plus install progress. Module-level so it survives hot updates.

import { markAppOpened } from './appfront'
import { useSyncExternalStore } from 'react'
import { tv, type InstalledFlatpak, type LaunchTarget, type SteamGame } from './bridge'
import { colorFor, hiddenApps, steamBigPicture, streaming, type Tag } from '../data/catalog'
import { markRecent } from './prefs'

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
  kind: 'service' | 'app' | 'game'
}

interface LibraryState {
  loaded: boolean
  flatpaks: InstalledFlatpak[]
  games: SteamGame[]
  installing: Record<string, number> // appId -> percent
  notice: string | null
}

let state: LibraryState = { loaded: false, flatpaks: [], games: [], installing: {}, notice: null }
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

let started = false
export function startLibrary() {
  if (started) return
  started = true
  void refreshLibrary()
  tv.onEvent((e) => {
    if (e.type === 'install-progress') set({ installing: { ...state.installing, [e.appId]: e.percent } })
    if (e.type === 'notice') notify(e.message)
    if (e.type === 'volume' && e.volume != null) notify(`Volume ${e.volume}%`)
    if (e.type === 'app-exited' || e.type === 'web-closed') void refreshLibrary()
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
  if (tile.needs && !isInstalled(tile.needs)) {
    const ok = await install(tile.needs, tile.title)
    if (!ok) return
  }
  markRecent(tile.id)
  try {
    await tv.launch(tile.launch, tile.title)
    markAppOpened()
  } catch (e) {
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

export function allTiles(s: LibraryState = state): TileModel[] {
  return [...serviceTiles(), ...gameTiles(s.games), ...appTiles(s.flatpaks)]
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
