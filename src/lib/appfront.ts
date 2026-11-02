// Whether another app is in front of the launcher. The launcher window keeps
// reading the controller (Gamepad API) while an app is in front, so without this
// an A press meant for the app also re-opened the highlighted tile (seen with
// Plex: it looked like Plex restarting). Paused while an app is in front, except
// while the launcher's keyboard is up for that app.

import { tv } from './bridge'
import { localAppOpen } from './localApps'

let appOpen = false
let typing = false

/** True when the launcher should ignore the controller. */
export function controllerPaused(): boolean {
  return (appOpen && !typing) || localAppOpen()
}

/** Something was opened from the launcher (an app, a game or a web layer). */
export function markAppOpened() {
  appOpen = true
}

let started = false
export function startAppFront() {
  if (started) return
  started = true
  tv.onEvent((e) => {
    switch (e.type) {
      case 'app-exited':
      case 'web-closed':
      case 'steam-closed':
      case 'app-running': // the launcher is in front again; the Steam game waits behind it
        appOpen = false
        break
      case 'keyboard-request':
        typing = true
        break
      case 'keyboard-closed':
        typing = false
        break
    }
  })
}
