// Preferences that should survive reboots (localStorage), plus "recently opened".

import { useSyncExternalStore } from 'react'

export interface TileOptions {
  showTitle?: boolean // unset = the default (hidden for logo tiles, shown otherwise)
}

interface Prefs {
  accent: string
  recent: string[] // tile ids, most recent first
  tiles: Record<string, TileOptions> // per-tile options (Menu button on a tile)
}

const KEY = 'tvlauncher.prefs.v1'
const listeners = new Set<() => void>()

function load(): Prefs {
  const base: Prefs = { accent: '#4F8EF7', recent: [], tiles: {} }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...base, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return base
}

let prefs = load()

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
  applyAccent()
  listeners.forEach((l) => l())
}

export function getPrefs(): Prefs {
  return prefs
}

export function forgetRecent(id: string) {
  setPrefs({ recent: prefs.recent.filter((r) => r !== id) })
}

export function markRecent(id: string) {
  setPrefs({ recent: [id, ...prefs.recent.filter((r) => r !== id)].slice(0, 12) })
}

export function applyAccent() {
  document.documentElement.style.setProperty('--accent', prefs.accent)
}

export function usePrefs<T>(select: (p: Prefs) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => select(prefs),
  )
}
