// Whether another app is in front of the launcher. The launcher window keeps
// reading the controller (Gamepad API) while an app is in front, so without this
// an A press meant for the app also re-opened the highlighted tile (seen with
// Plex: it looked like Plex restarting). Paused while an app is in front, except
// while the launcher's keyboard is up for that app.
//
// Also paused whenever the launcher window doesn't have the keyboard focus, which
// means some other window is in front, even one the launcher didn't open (Steam
// showing Big Picture by itself, something started outside the launcher). Seen
// Nov 2026: Big Picture opened behind the launcher's back, and presses meant for
// it started Mario Kart in the launcher underneath.

import { tv } from './bridge'
import { localAppOpen } from './localApps'

let appOpen = false
let typing = false
let covered = false // another window has the focus

/** True when the launcher should ignore the controller. */
export function controllerPaused(): boolean {
  return (appOpen && !typing) || localAppOpen() || covered
}

/** Something was opened from the launcher (an app, a game or a web layer). */
export function markAppOpened() {
  appOpen = true
}

/** The launcher itself just took the screen back (e.g. one of your own apps closed). */
export function launcherInFront() {
  covered = false
}

let started = false
export function startAppFront() {
  if (started) return
  started = true
  // Focus moving into one of your own apps (its frame is inside this window)
  // also blurs the window; that app pauses the controller anyway.
  window.addEventListener('blur', () => {
    covered = true
    console.info('[appfront] another window is in front: ignoring the controller')
  })
  window.addEventListener('focus', () => {
    covered = false
    console.info('[appfront] launcher in front again')
  })
  tv.onEvent((e) => {
    switch (e.type) {
      case 'app-exited':
      case 'web-closed':
      case 'steam-closed':
      case 'app-running': // the launcher is in front again; the Steam game waits behind it
        appOpen = false
        // The shell just raised the launcher. Trust that even if no focus event
        // follows, so the controller can't stay dead on a visible launcher.
        covered = false
        break
      case 'home':
        covered = false
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
