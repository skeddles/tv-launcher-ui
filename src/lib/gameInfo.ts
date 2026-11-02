// Which emulated game's info screen is open (components/GameInfo.tsx).

import { useSyncExternalStore } from 'react'

let openId: string | null = null
const listeners = new Set<() => void>()

export function openGameInfo(romId: string) {
  openId = romId
  listeners.forEach((l) => l())
}

export function closeGameInfo() {
  openId = null
  listeners.forEach((l) => l())
}

export function useGameInfoId(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => openId,
  )
}
