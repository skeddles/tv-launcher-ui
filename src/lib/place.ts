// "Where you are": the current screen and highlighted item. Kept outside React
// components and mirrored to sessionStorage, so a hot update or a full reload
// puts you back on the same tile. (Plan: Layer 4, "Making full reloads harmless".)

import { useSyncExternalStore } from 'react'

export type Screen = 'search' | 'home' | 'movies' | 'tv' | 'apps' | 'games' | 'allgames' | 'store' | 'settings'

export interface Place {
  screen: Screen
  focusId: string | null
  // last focused id per screen, so going back restores your spot
  focusByScreen: Partial<Record<Screen, string>>
  searchText: string
  storeQuery: string
}

const KEY = 'tvlauncher.place.v1'

function load(): Place {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) {
      const p = { ...defaults(), ...JSON.parse(raw) }
      if (p.screen === 'library') p.screen = 'apps' // the old Library tab (split into Apps and Games)
      return p
    }
  } catch {
    /* storage unavailable: start fresh */
  }
  return defaults()
}

function defaults(): Place {
  return { screen: 'home', focusId: null, focusByScreen: {}, searchText: '', storeQuery: '' }
}

let state: Place = load()
const listeners = new Set<() => void>()

function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function getPlace(): Place {
  return state
}

export function setPlace(patch: Partial<Place>) {
  state = { ...state, ...patch }
  // Remember the last tile per screen (not the rail, dialogs or keyboard keys).
  if (patch.focusId && !/^(rail|dialog|kb):/.test(patch.focusId)) {
    state.focusByScreen = { ...state.focusByScreen, [state.screen]: patch.focusId }
  }
  save()
  listeners.forEach((l) => l())
}

export function goTo(screen: Screen) {
  if (screen === state.screen) return
  setPlace({ screen, focusId: `rail:${screen}` })
}

export function subscribePlace(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function usePlace<T>(select: (p: Place) => T): T {
  return useSyncExternalStore(subscribePlace, () => select(state))
}
