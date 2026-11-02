// Opening an app: its tile grows to fill the screen and stays until the app's
// window covers it, so a slow app doesn't look like nothing happened. Removed as
// soon as the app's window takes the keyboard focus from the launcher (it covers
// the screen from then on), so it isn't seen again when the app closes; and,
// failing that, when the launcher is back in front.

import { tv } from './bridge'

const GROW_MS = 320
const SAFETY_MS = 120_000 // in case no event ever says the app ended

let cover: HTMLElement | null = null
let safety = 0

/** Grow a copy of `tile` (the element of the tile being opened) to full screen. */
export function showLaunchCover(tile: HTMLElement | null, title: string) {
  removeLaunchCover(true)
  const el = document.createElement('div')
  el.className = 'launch-cover'
  el.setAttribute('role', 'status')
  el.setAttribute('aria-label', `Opening ${title}`)
  let from: Keyframe
  if (tile) {
    const copy = tile.cloneNode(true) as HTMLElement
    copy.classList.remove('is-focused')
    copy.removeAttribute('data-focus')
    copy.removeAttribute('data-tile-key')
    copy.classList.add('launch-cover__tile')
    copy.tabIndex = -1
    el.appendChild(copy)
    const r = tile.getBoundingClientRect()
    from = { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: '12px' }
  } else {
    from = { left: '25vw', top: '25vh', width: '50vw', height: '50vh', borderRadius: '12px', opacity: 0 }
  }
  const label = document.createElement('div')
  label.className = 'launch-cover__label'
  label.textContent = `Opening ${title}…`
  el.appendChild(label)
  document.body.appendChild(el)
  el.animate([from, { left: '0px', top: '0px', width: '100vw', height: '100vh', borderRadius: '0px', opacity: 1 }], {
    duration: GROW_MS,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    fill: 'forwards',
  })
  cover = el
  safety = window.setTimeout(() => removeLaunchCover(), SAFETY_MS)
}

export function removeLaunchCover(instant = false) {
  window.clearTimeout(safety)
  const el = cover
  cover = null
  if (!el) return
  if (instant) return el.remove()
  el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).finished.finally(() => el.remove())
}

let started = false
export function startLaunchCover() {
  if (started) return
  started = true
  // The app's window appeared and took focus: the cover's job is done.
  window.addEventListener('blur', () => removeLaunchCover(true))
  tv.onEvent((e) => {
    // The launcher is in front again (the app ended or never started, the Xbox
    // button brought it back, or its keyboard is up for the app).
    if (
      e.type === 'app-exited' ||
      e.type === 'web-closed' ||
      e.type === 'steam-closed' ||
      e.type === 'app-running' ||
      e.type === 'keyboard-request'
    ) {
      removeLaunchCover(true)
    }
  })
}
