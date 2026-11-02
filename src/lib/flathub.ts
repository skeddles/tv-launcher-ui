// Flathub's public API, read straight from the launcher (it allows any origin):
// suggestion rows for the App Store and the details shown before installing.
// Installing still goes through the shell (tv.storeInstall).

import type { StoreApp } from './bridge'

// Through the launcher's own server (vite.config.ts proxy): some Flathub
// endpoints don't allow direct requests from a page.
const API = '/flathub-api'
const cache = new Map<string, Promise<unknown>>()

function getJson<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = fetch(API + path).then((r) => {
      if (!r.ok) throw new Error(`Flathub ${r.status}`)
      return r.json()
    })
    p.catch(() => cache.delete(path)) // try again next time
    cache.set(path, p)
  }
  return cache.get(path) as Promise<T>
}

interface Hit {
  app_id: string
  name: string
  summary?: string
  icon?: string
  type?: string
}

/** The App Store's suggestion rows: a title and a Flathub collection. */
export const STORE_ROWS: Array<{ title: string; path: string }> = [
  { title: 'Popular', path: '/collection/popular' },
  { title: 'Trending', path: '/collection/trending' },
  { title: 'Video', path: '/collection/category/AudioVideo/subcategories?subcategory=Video' },
  { title: 'Music & audio', path: '/collection/category/AudioVideo/subcategories?subcategory=Audio' },
  { title: 'Games', path: '/collection/category/Game' },
  { title: 'Emulators', path: '/collection/category/Game/subcategories?subcategory=Emulator' },
  { title: 'New on Flathub', path: '/collection/recently-added' },
]

export async function collection(path: string, count = 20): Promise<StoreApp[]> {
  const sep = path.includes('?') ? '&' : '?'
  const data = await getJson<{ hits: Hit[] }>(`${path}${sep}page=1&per_page=${count}`)
  return (data.hits || [])
    .filter((h) => !h.type || h.type === 'desktop-application')
    .map((h) => ({ appId: h.app_id, name: h.name, summary: h.summary ?? '', icon: h.icon, gamepad: false, installed: false }))
}

export interface AppDetails {
  appId: string
  name: string
  developer: string | null
  summary: string
  description: string[] // paragraphs and list items, as plain text
  screenshots: string[]
  gamepad: boolean // the listing says it supports a game controller
  freeSoftware: boolean
  homepage: string | null
  installsLastMonth: number | null
  downloadBytes: number | null
}

type Relation = { control?: string[] } | Array<{ type: string; value: string }> | null

interface AppstreamRaw {
  name?: string
  developer_name?: string
  summary?: string
  description?: string
  screenshots?: Array<{ sizes?: Array<{ src: string; width: string }> }>
  supports?: Relation
  recommends?: Relation
  requires?: Relation
  is_free_license?: boolean
  urls?: { homepage?: string }
}

/** Paragraphs and bullet points from AppStream's description markup, as plain text. */
export function descriptionText(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const parts: string[] = []
  doc.body.querySelectorAll('p, li').forEach((el) => {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (text) parts.push(el.tagName === 'LI' ? `• ${text}` : text)
  })
  return parts
}

function hasGamepad(s: Relation | undefined): boolean {
  if (!s) return false
  if (Array.isArray(s)) return s.some((x) => x.type === 'control' && x.value === 'gamepad')
  return Array.isArray(s.control) && s.control.includes('gamepad')
}

/** A screenshot about 1000px wide (or the closest there is). */
function screenshotUrl(s: { sizes?: Array<{ src: string; width: string }> }): string | null {
  const sizes = (s.sizes ?? []).slice().sort((a, b) => Math.abs(Number(a.width) - 1000) - Math.abs(Number(b.width) - 1000))
  return sizes[0]?.src ?? null
}

export async function appDetails(appId: string): Promise<AppDetails> {
  const id = encodeURIComponent(appId)
  const [a, summary, stats] = await Promise.all([
    getJson<AppstreamRaw>(`/appstream/${id}`),
    getJson<{ download_size?: number }>(`/summary/${id}`).catch(() => null),
    getJson<{ installs_last_month?: number }>(`/stats/${id}`).catch(() => null),
  ])
  return {
    appId,
    name: a.name ?? appId,
    developer: a.developer_name ?? null,
    summary: a.summary ?? '',
    description: descriptionText(a.description ?? ''),
    screenshots: (a.screenshots ?? [])
      .map(screenshotUrl)
      .filter((u): u is string => Boolean(u))
      .slice(0, 3),
    gamepad: hasGamepad(a.supports) || hasGamepad(a.recommends) || hasGamepad(a.requires),
    freeSoftware: Boolean(a.is_free_license),
    homepage: a.urls?.homepage ?? null,
    installsLastMonth: stats?.installs_last_month ?? null,
    downloadBytes: summary?.download_size ?? null,
  }
}
