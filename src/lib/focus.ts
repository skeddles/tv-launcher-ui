// Spatial navigation: the D-pad and stick move the highlight to the nearest
// focusable item in that direction, like Roku or Android TV.
//
// Any element with `data-focus="<unique id>"` can be highlighted. Optional:
//   data-focus-group="rail" | "content" | ...  remembers the last item per group,
//       so moving from the rail back into the tiles returns to where you were.
//   data-focus-default                          first item to highlight on a screen.
//   data-focus-scope (on a container)          traps navigation inside it (modals).
// The highlighted element gets the `is-focused` class via useFocused().

import { useEffect, useSyncExternalStore } from 'react'
import { getPlace, setPlace, subscribePlace } from './place'

export type Direction = 'up' | 'down' | 'left' | 'right'

const lastInGroup = new Map<string, string>()
const backHandlers: Array<() => boolean> = []

function scopeRoot(): ParentNode {
  const scopes = document.querySelectorAll('[data-focus-scope]')
  return scopes.length ? scopes[scopes.length - 1] : document
}

function focusables(root: ParentNode = scopeRoot()): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-focus]')).filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0,
  )
}

function byId(id: string | null, root: ParentNode = scopeRoot()): HTMLElement | null {
  if (!id) return null
  return root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(id)}"]`)
}

export function currentElement(): HTMLElement | null {
  return byId(getPlace().focusId)
}

export function focus(id: string) {
  const el = byId(id)
  if (!el) return
  const group = el.dataset.focusGroup
  if (group) lastInGroup.set(group, id)
  if (getPlace().focusId !== id) setPlace({ focusId: id })
  scrollIntoView(el)
}

function scrollIntoView(el: HTMLElement) {
  const container = el.closest<HTMLElement>('[data-scroll]')
  if (!container) return
  const anchor = el.closest<HTMLElement>('[data-scroll-anchor]') ?? el
  const c = container.getBoundingClientRect()
  const a = anchor.getBoundingClientRect()
  const margin = 48
  // The first rows sit under the header: scroll fully to the top for them.
  if (anchor.dataset.scrollTop !== undefined) {
    container.scrollTo({ top: 0 })
    return
  }
  if (a.top < c.top + margin) {
    container.scrollBy({ top: a.top - c.top - margin })
  } else if (a.bottom > c.bottom - margin) {
    container.scrollBy({ top: a.bottom - c.bottom + margin })
  }
}

function center(r: DOMRect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

export function move(dir: Direction): boolean {
  const cur = currentElement()
  if (!cur) {
    ensureFocus()
    return true
  }
  const r = cur.getBoundingClientRect()
  const c = center(r)
  let best: HTMLElement | null = null
  let bestScore = Infinity

  for (const el of focusables()) {
    if (el === cur) continue
    const er = el.getBoundingClientRect()
    const ec = center(er)
    let primary: number
    let secondary: number
    switch (dir) {
      case 'right':
        if (ec.x <= c.x + 1 || er.left < r.right - r.width / 2) continue
        primary = Math.max(0, er.left - r.right)
        secondary = Math.abs(ec.y - c.y)
        break
      case 'left':
        if (ec.x >= c.x - 1 || er.right > r.left + r.width / 2) continue
        primary = Math.max(0, r.left - er.right)
        secondary = Math.abs(ec.y - c.y)
        break
      case 'down':
        if (ec.y <= c.y + 1 || er.top < r.bottom - r.height / 2) continue
        primary = Math.max(0, er.top - r.bottom)
        secondary = Math.abs(ec.x - c.x)
        break
      case 'up':
        if (ec.y >= c.y - 1 || er.bottom > r.top + r.height / 2) continue
        primary = Math.max(0, r.top - er.bottom)
        secondary = Math.abs(ec.x - c.x)
        break
    }
    // Strongly prefer staying in the same line (row or column).
    const score = primary + secondary * 2.5
    if (score < bestScore) {
      bestScore = score
      best = el
    }
  }
  if (!best) return false

  // Entering a different group (e.g. rail -> tiles): restore the last item there.
  const fromGroup = cur.dataset.focusGroup
  const toGroup = best.dataset.focusGroup
  if (toGroup && toGroup !== fromGroup) {
    const remembered = byId(lastInGroup.get(toGroup) ?? null)
    if (remembered) best = remembered
  }
  focus(best.dataset.focus!)
  return true
}

export function select() {
  const el = currentElement()
  el?.click()
}

/** Register a handler for B / Escape. Return true from it to consume the press. */
export function pushBack(handler: () => boolean): () => void {
  backHandlers.push(handler)
  return () => {
    const i = backHandlers.lastIndexOf(handler)
    if (i >= 0) backHandlers.splice(i, 1)
  }
}

export function back() {
  for (let i = backHandlers.length - 1; i >= 0; i--) {
    if (backHandlers[i]()) return
  }
}

/** Make sure something on the current screen is highlighted. */
export function ensureFocus() {
  const place = getPlace()
  if (byId(place.focusId)) return
  const root = scopeRoot()
  const remembered = byId(place.focusByScreen[place.screen] ?? null, root)
  const fallback =
    remembered ??
    root.querySelector<HTMLElement>('[data-focus-default]') ??
    focusables(root).find((el) => el.dataset.focusGroup !== 'rail') ??
    focusables(root)[0]
  if (fallback) focus(fallback.dataset.focus!)
}

let scheduled = false
/** Watch the DOM so focus is repaired whenever a screen or modal changes. */
export function startFocusWatcher() {
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      ensureFocus()
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })
  requestAnimationFrame(ensureFocus)
  return () => observer.disconnect()
}

/** For modals: remember what was highlighted when it opened, restore it on close. */
export function useFocusReturn() {
  useEffect(() => {
    const saved = getPlace().focusId
    return () => {
      requestAnimationFrame(() => {
        if (saved && byId(saved)) focus(saved)
      })
    }
  }, [])
}

export function useFocused(id: string): boolean {
  return useSyncExternalStore(subscribePlace, () => getPlace().focusId === id)
}
