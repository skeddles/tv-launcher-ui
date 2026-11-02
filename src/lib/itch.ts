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
}

export const ITCH_ROWS: Array<{ title: string; sort?: string; genre?: string }> = [
  { title: 'Popular' },
  { title: 'Top rated', sort: 'top-rated' },
  { title: 'New and popular', sort: 'new-and-popular' },
  { title: 'Free', sort: 'free' },
  { title: 'On sale', sort: 'on-sale' },
  { title: 'Platformers', genre: 'platformer' },
  { title: 'Action', genre: 'action' },
  { title: 'Puzzle', genre: 'puzzle' },
  { title: 'Adventure', genre: 'adventure' },
  { title: 'RPGs', genre: 'rpg' },
  { title: 'Horror', genre: 'horror' },
  { title: 'Visual novels', genre: 'visual-novel' },
  { title: 'Racing', genre: 'racing' },
  { title: 'Fighting', genre: 'fighting' },
  { title: 'Shooters', genre: 'shooter' },
  { title: 'Rhythm', genre: 'rhythm' },
  { title: 'Strategy', genre: 'strategy' },
  { title: 'Simulation', genre: 'simulation' },
  { title: 'Sports', genre: 'sports' },
  { title: 'Survival', genre: 'survival' },
]

export async function browseItch(sort: string | undefined, genre: string | undefined, page: number): Promise<ItchGame[]> {
  const q = new URLSearchParams({ sort: sort ?? '', genre: genre ?? '', page: String(page) })
  const res = await fetch(`/itch-api/browse?${q}`)
  if (!res.ok) throw new Error(`itch.io ${res.status}`)
  return (await res.json()) as ItchGame[]
}

export async function itchGameId(url: string): Promise<number> {
  const res = await fetch(`/itch-api/game?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error(`itch.io ${res.status}`)
  return ((await res.json()) as { id: number }).id
}

export async function installedItchGames(): Promise<InstalledItchGame[]> {
  const res = await fetch('/itch-api/installed').catch(() => null)
  return res?.ok ? ((await res.json()) as InstalledItchGame[]) : []
}

/** Open the itch app at an itch:// address: a game's page, its install, or launching it. */
export function openInItch(itchUrl: string, label: string) {
  return tv.launch({ kind: 'flatpak', appId: ITCH_APP, args: [itchUrl] }, label)
}

export const itchPage = (id: number) => `itch://games/${id}`
export const itchInstall = (id: number) => `itch://install?game_id=${id}`
export const itchPlay = (id: number) => `itch://install?game_id=${id}&launch`
