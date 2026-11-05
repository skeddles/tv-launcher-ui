// Your own apps and games: web pages in ~/.local/share/tvlauncher/apps on the TV
// (listed and served by the launcher's server, see server/localApps.ts). One
// opens full screen in a frame over the launcher, which starts it almost
// instantly: the browser engine is already running.
//
// While one is open the launcher ignores the controller (the game reads it
// itself). The Xbox button closes it; so does holding View + Menu together
// (in case the Xbox button doesn't reach the page).

import { useSyncExternalStore } from 'react'
import { tv } from './bridge'
import { launcherInFront } from './appfront'

export interface LocalApp {
  id: string
  name: string
  type: 'game' | 'app'
  url: string
  icon: string | null
  color: string | null
}

const GUIDE = 16 // Xbox button, in the browser's standard controller layout
const VIEW = 8
const MENU = 9
const COMBO_MS = 600 // hold View + Menu this long

export async function fetchLocalApps(): Promise<LocalApp[]> {
  try {
    const r = await fetch('/local-apps.json', { cache: 'no-store' })
    if (!r.ok) return []
    return (await r.json()) as LocalApp[]
  } catch {
    return [] // the fallback build has no server
  }
}

let open: { app: LocalApp; openedAt: number } | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function openLocalApp(app: LocalApp) {
  open = { app, openedAt: Date.now() }
  emit()
  watchExit()
}

export function closeLocalApp() {
  if (!open) return
  open = null
  emit()
  window.focus()
  launcherInFront()
}

/** True while one of your apps is open (the launcher leaves the controller to it). */
export function localAppOpen(): boolean {
  return open !== null
}

export function useLocalApp(): LocalApp | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => open?.app ?? null,
  )
}

let raf = 0
function watchExit() {
  cancelAnimationFrame(raf)
  // Buttons already down when it opened (the A that opened it) don't count.
  let armed = false
  let comboSince = 0
  const poll = (now: number) => {
    if (!open) return
    let guide = false
    let combo = false
    let any = false
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (!pad) continue
      if (pad.buttons.some((b) => b?.pressed)) any = true
      if (pad.buttons[GUIDE]?.pressed) guide = true
      if (pad.buttons[VIEW]?.pressed && pad.buttons[MENU]?.pressed) combo = true
    }
    if (!armed) armed = !any
    else {
      comboSince = combo ? comboSince || now : 0
      if (guide || (comboSince && now - comboSince > COMBO_MS)) {
        closeLocalApp()
        return
      }
    }
    raf = requestAnimationFrame(poll)
  }
  raf = requestAnimationFrame(poll)
}

let started = false
export function startLocalApps() {
  if (started) return
  started = true
  // The shell's "home" (Xbox button seen by the shell, or the connector).
  tv.onEvent((e) => {
    if (e.type === 'home') closeLocalApp()
  })
}
