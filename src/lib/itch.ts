// itch.io: lists of games for Linux with gamepad support (server/itch.ts reads
// itch.io for us), and opening or installing them in the itch app (Flathub
// io.itch.itch), which handles sign-in, buying and downloads.

import { tv } from './bridge'

export const ITCH_APP = 'io.itch.itch'

export interface ItchGame {
  url: string
  title: string
  image: string | null
  price: string
  free: boolean
  sale: number | null
  summary: string
  genre: string | null
}

export interface InstalledItchGame {
  id: number
  title: string
  image: string | null
  url: string | null
  folder?: string | null // its folder in the itch app's apps folder
  updateAvailable?: boolean // a newer build is out
  caveId?: string // the itch app's id for this install (for updating)
  version?: string | null // installed version, e.g. "1.8.0"
}

export interface ItchUpdate {
  status: 'running' | 'done' | 'failed'
  progress: number // 0-1
  version: string | null
  error: string | null
}

/** Start updating an installed game (the launcher's server runs the itch app's butler). */
export async function startItchUpdate(caveId: string): Promise<ItchUpdate> {
  const r = await fetch(`/itch-api/update?cave=${encodeURIComponent(caveId)}`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`itch update ${r.status}`)
  return (await r.json()) as ItchUpdate
}

export async function itchUpdateStatus(caveId: string): Promise<ItchUpdate | null> {
  const r = await fetch(`/itch-api/update-status?cave=${encodeURIComponent(caveId)}`, { cache: 'no-store' })
  return r.ok ? ((await r.json()) as ItchUpdate | null) : null
}

export interface ItchRowDef {
  title: string
  sort?: string // itch.io list: '' (popular), top-rated, new-and-popular, newest, on-sale
  free?: boolean // free games only
  tag?: string // any itch.io tag, e.g. "pixel-art"
}

/** itch.io tags with a row title. `genre` ones also show in Settings → Hidden as game genres. */
export const ITCH_TAGS: Array<{ tag: string; title: string; genre?: boolean }> = [
  { tag: 'platformer', title: 'Platformers', genre: true },
  { tag: 'action', title: 'Action', genre: true },
  { tag: 'puzzle', title: 'Puzzle', genre: true },
  { tag: 'adventure', title: 'Adventure', genre: true },
  { tag: 'rpg', title: 'RPGs', genre: true },
  { tag: 'horror', title: 'Horror', genre: true },
  { tag: 'visual-novel', title: 'Visual novels', genre: true },
  { tag: 'racing', title: 'Racing', genre: true },
  { tag: 'fighting', title: 'Fighting', genre: true },
  { tag: 'shooter', title: 'Shooters', genre: true },
  { tag: 'rhythm', title: 'Rhythm', genre: true },
  { tag: 'strategy', title: 'Strategy', genre: true },
  { tag: 'simulation', title: 'Simulation', genre: true },
  { tag: 'sports', title: 'Sports', genre: true },
  { tag: 'survival', title: 'Survival', genre: true },
  { tag: 'pixel-art', title: 'Pixel art' },
  { tag: 'roguelike', title: 'Roguelikes' },
  { tag: 'roguelite', title: 'Roguelites' },
  { tag: 'metroidvania', title: 'Metroidvanias' },
  { tag: 'local-multiplayer', title: 'Local multiplayer' },
  { tag: 'local-co-op', title: 'Local co-op' },
  { tag: 'co-op', title: 'Co-op' },
  { tag: 'cozy', title: 'Cozy' },
  { tag: 'retro', title: 'Retro' },
  { tag: 'story-rich', title: 'Story rich' },
  { tag: 'short', title: 'Short games' },
  { tag: 'cute', title: 'Cute' },
  { tag: 'atmospheric', title: 'Atmospheric' },
  { tag: 'sci-fi', title: 'Sci-fi' },
  { tag: 'fantasy', title: 'Fantasy' },
  { tag: 'bullet-hell', title: 'Bullet hell' },
  { tag: 'top-down', title: 'Top-down' },
  { tag: 'side-scroller', title: 'Side scrollers' },
  { tag: 'arcade', title: 'Arcade' },
  { tag: 'puzzle-platformer', title: 'Puzzle platformers' },
  { tag: '3d', title: '3D' },
  { tag: 'multiplayer', title: 'Multiplayer' },
  { tag: 'exploration', title: 'Exploration' },
  { tag: 'casual', title: 'Casual' },
  { tag: 'relaxing', title: 'Relaxing' },
  { tag: 'difficult', title: 'Difficult' },
  { tag: 'funny', title: 'Funny' },
  { tag: 'cyberpunk', title: 'Cyberpunk' },
  { tag: 'space', title: 'Space' },
  { tag: 'dungeon-crawler', title: 'Dungeon crawlers' },
  { tag: 'turn-based', title: 'Turn-based' },
  { tag: 'tower-defense', title: 'Tower defense' },
  { tag: 'open-world', title: 'Open world' },
  { tag: 'sandbox', title: 'Sandbox' },
  { tag: 'low-poly', title: 'Low-poly' },
  { tag: 'physics', title: 'Physics' },
  { tag: 'stealth', title: 'Stealth' },
  { tag: 'hack-and-slash', title: 'Hack and slash' },
  { tag: 'shoot-em-up', title: "Shoot 'em ups" },
  { tag: 'mystery', title: 'Mystery' },
  { tag: 'psychological-horror', title: 'Psychological horror' },
  { tag: 'walking-simulator', title: 'Walking simulators' },
  { tag: 'boss-battle', title: 'Boss battles' },
]

/**
 * The store page's rows: itch.io's main lists, then every tag in a new random
 * order each visit. At least half the rows are free games only ("… · Free").
 */
export function itchRows(seed = Math.random()): ItchRowDef[] {
  const head: ItchRowDef[] = [
    { title: 'Popular' },
    { title: 'Popular · Free', free: true },
    { title: 'Top rated · Free', sort: 'top-rated', free: true },
    { title: 'Top rated', sort: 'top-rated' },
    { title: 'New and popular · Free', sort: 'new-and-popular', free: true },
    { title: 'New and popular', sort: 'new-and-popular' },
    { title: 'On sale', sort: 'on-sale' },
  ]
  let s = Math.floor(seed * 2147483646) + 1
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  const tags = ITCH_TAGS.map((t) => ({ t, k: rnd() }))
    .sort((a, b) => a.k - b.k)
    .map(({ t }, i): ItchRowDef => {
      // Two of every three tag rows are free games only
      const free = i % 3 !== 2
      const sort = rnd() < 0.3 ? 'top-rated' : ''
      return { title: free ? `${t.title} · Free` : t.title, tag: t.tag, free, sort }
    })
  return [...head, ...tags]
}

export async function browseItch(row: ItchRowDef, page: number): Promise<ItchGame[]> {
  const q = new URLSearchParams({ sort: row.sort ?? '', free: row.free ? '1' : '0', tag: row.tag ?? '', page: String(page) })
  const res = await fetch(`/itch-api/browse?${q}`)
  if (!res.ok) throw new Error(`itch.io ${res.status}`)
  return (await res.json()) as ItchGame[]
}

export async function itchGameId(url: string): Promise<number> {
  const res = await fetch(`/itch-api/game?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error(`itch.io ${res.status}`)
  return ((await res.json()) as { id: number }).id
}

export async function installedItchGames(fresh = false): Promise<InstalledItchGame[]> {
  const res = await fetch(`/itch-api/installed${fresh ? '?fresh=1' : ''}`).catch(() => null)
  return res?.ok ? ((await res.json()) as InstalledItchGame[]) : []
}

/** Open the itch app at an itch:// address: a game's page, its install, or launching it. */
export function openInItch(itchUrl: string, label: string) {
  return tv.launch({ kind: 'flatpak', appId: ITCH_APP, args: [itchUrl] }, label)
}

export const itchPage = (id: number) => `itch://games/${id}`
export const itchInstall = (id: number) => `itch://install?game_id=${id}`
export const itchPlay = (id: number) => `itch://install?game_id=${id}&launch`
