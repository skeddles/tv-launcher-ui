// Emulated games (ROMs on the TV), from the dev server's /games-api (server/games.ts).
// They open in RetroArch, straight into the game.

import type { TileModel } from './library'

export interface RomGame {
  id: string
  system: string
  title: string
  file: string
  extra: boolean // in "ROMs Extra": only listed under All games
  args: string[] | null // null: no emulator installed for this system yet
  playedAt: number | null
  plays: number
  resumable: boolean
}

export interface RomSystem {
  id: string
  name: string
}

export interface RomLibrary {
  systems: RomSystem[]
  games: RomGame[]
}

export const RETROARCH = 'org.libretro.RetroArch'

export async function fetchRoms(): Promise<RomLibrary> {
  const res = await fetch('/games-api/list')
  if (!res.ok) throw new Error(`games ${res.status}`)
  return (await res.json()) as RomLibrary
}

/** Tell the library a game was started (for Continue playing and Recently Opened). */
export function markPlayed(id: string) {
  void fetch(`/games-api/played/${id}`, { method: 'POST' }).catch(() => {})
}

export function romTile(g: RomGame, systems: RomSystem[]): TileModel {
  const system = systems.find((s) => s.id === g.system)?.name ?? g.system
  return {
    id: `rom:${g.id}`,
    title: g.title,
    subtitle: system,
    color: 'var(--tile-bg)',
    tags: ['games'],
    art: `/games-api/art/${g.id}`,
    launch: g.args ? { kind: 'flatpak', appId: RETROARCH, args: g.args } : { kind: 'flatpak', appId: RETROARCH },
    needs: RETROARCH,
    romId: g.id,
    unplayable: g.args ? undefined : `No emulator for ${system} games is set up yet`,
    kind: 'game',
  }
}

/** Opens RetroArch's own menu: emulator settings shared by every system. */
export const emulatorSettingsTile: TileModel = {
  id: 'retroarch-settings',
  title: 'Emulator settings',
  color: 'var(--tile-bg)',
  tags: ['games'],
  launch: { kind: 'flatpak', appId: RETROARCH, args: ['--menu'] },
  needs: RETROARCH,
  kind: 'app',
}

/** Most recently played first. */
export function recentlyPlayed(games: RomGame[]): RomGame[] {
  return games.filter((g) => g.playedAt).sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0))
}

// ----- suggestion rows (Games page) -----

function shuffle<T>(items: T[], seed: number): T[] {
  const a = [...items]
  let s = seed || 1
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface GameRow {
  key: string
  title: string
  games: RomGame[]
}

/**
 * Rows for the Games page, from the main ROMs folder only: a mix "Picked for you"
 * (leaning toward systems you play), then one row per system in an order that
 * also favours what you play. Shuffled again each time the page opens (`seed`).
 */
export function suggestedRows(lib: RomLibrary, seed: number, perRow = 18): GameRow[] {
  const main = lib.games.filter((g) => !g.extra && g.args)
  if (main.length === 0) return []
  const playsBy = new Map<string, number>()
  for (const g of main) playsBy.set(g.system, (playsBy.get(g.system) ?? 0) + g.plays)
  const weight = (sys: string) => 1 + (playsBy.get(sys) ?? 0)

  // Picked for you: weighted pick without replacement, unplayed games mixed in
  const pool = shuffle(main, seed)
  const picked: RomGame[] = []
  const bag = pool.map((g) => ({ g, w: weight(g.system) * (g.plays ? 0.6 : 1) }))
  let s = seed
  while (picked.length < Math.min(perRow, main.length) && bag.length) {
    const total = bag.reduce((t, x) => t + x.w, 0)
    s = (s * 16807) % 2147483647
    let r = (s / 2147483647) * total
    const i = Math.max(
      0,
      bag.findIndex((x) => (r -= x.w) <= 0),
    )
    picked.push(bag[i].g)
    bag.splice(i, 1)
  }
  const rows: GameRow[] = [{ key: 'picked', title: 'Picked for you', games: picked }]

  const systems = shuffle(
    lib.systems.filter((sys) => main.some((g) => g.system === sys.id)),
    seed + 7,
  ).sort((a, b) => weight(b.id) - weight(a.id)) // stable: equal weights stay shuffled
  // Keep the most played systems near the top but not always in the same order
  for (const sys of systems) {
    const games = main.filter((g) => g.system === sys.id)
    rows.push({ key: `sys:${sys.id}`, title: sys.name, games: shuffle(games, seed + sys.id.length * 31).slice(0, perRow) })
  }
  return rows
}
