// Remote control hooks for the TV connector (Claude): the shell reads the screen
// and presses buttons through window.__tvRemote, via webContents.executeJavaScript.
// Kept here, in the UI, so it updates live along with the screens it describes.

import { activate, allTiles } from './library'
import { dispatchAction, type Action } from './input'
import { getPlace } from './place'

export interface ScreenText {
  screen: string
  title: string
  focused: { id: string; label: string } | null
  typing: string | null
  notice: string | null
  sections: Array<{ title: string; items: string[] }>
}

function labelOf(el: Element | null): string {
  if (!el) return ''
  const aria = el.getAttribute('aria-label')
  const text = (el.querySelector('.tile__title')?.textContent ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
  const badge = el.querySelector('.tile__badge')?.textContent
  return [aria || text, badge ? `(${badge})` : ''].filter(Boolean).join(' ')
}

/** What's on screen, as text. */
function state(): ScreenText {
  const focusId = getPlace().focusId
  const focusedEl = focusId ? document.querySelector(`[data-focus="${CSS.escape(focusId)}"]`) : null
  const sections = Array.from(document.querySelectorAll('.main .row, .main .list')).map((sec) => ({
    title: sec.querySelector('.row__title')?.textContent?.trim() ?? '',
    items: Array.from(sec.querySelectorAll('[data-focus], .info-grid dt')).map((el) => {
      if (el.tagName === 'DT') return `${el.textContent?.trim()}: ${el.nextElementSibling?.textContent?.trim() ?? ''}`
      const mark = el.getAttribute('data-focus') === focusId ? '▶ ' : ''
      return mark + labelOf(el)
    }),
  }))
  return {
    screen: getPlace().screen,
    title: document.querySelector('.typing__title, .header__title')?.textContent?.trim() ?? '',
    focused: focusedEl ? { id: focusId!, label: labelOf(focusedEl) } : null,
    typing: document.querySelector('.typing') ? (document.querySelector('.typing__text')?.textContent ?? '') : null,
    notice: document.querySelector('.toast')?.textContent ?? null,
    sections,
  }
}

const ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'select', 'back', 'search', 'x', 'menu']

/** Press a controller button in the launcher. */
function press(action: string, times = 1): boolean {
  if (!ACTIONS.includes(action as Action)) return false
  for (let i = 0; i < Math.max(1, Math.min(times, 20)); i++) dispatchAction(action as Action)
  return true
}

/** Open a tile by name (case-insensitive; exact match first, then prefix, then substring). */
function open(name: string): { ok: boolean; title?: string; choices?: string[] } {
  const q = name.trim().toLowerCase()
  const tiles = allTiles()
  const tile =
    tiles.find((t) => t.title.toLowerCase() === q) ??
    tiles.find((t) => t.title.toLowerCase().startsWith(q)) ??
    tiles.find((t) => t.title.toLowerCase().includes(q))
  if (!tile) return { ok: false, choices: tiles.map((t) => t.title) }
  void activate(tile)
  return { ok: true, title: tile.title }
}

export function installRemote() {
  ;(window as unknown as { __tvRemote: unknown }).__tvRemote = { state, press, open }
}
