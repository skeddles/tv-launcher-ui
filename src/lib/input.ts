// Controller and keyboard input -> navigation actions.
// Xbox One controller via the browser Gamepad API ("standard" mapping):
//   A = select, B = back, D-pad / left stick = move, Y = search shortcut,
//   Menu ☰ = options for the highlighted tile.
// Arrow keys, Enter and Escape/Backspace do the same for testing with a keyboard.

import { back, move, select, type Direction } from './focus'
import { controllerPaused } from './appfront'
import { goTo } from './place'
import { openMenuForFocused } from './tileMenu'

const REPEAT_DELAY = 380 // hold this long before a direction repeats
const REPEAT_RATE = { left: 120, right: 120, up: 170, down: 170 } as Record<string, number> // ms per step while held

// A held step waits until the last one has been drawn, so slow frames lower the
// speed instead of building up a backlog the screen then races through.
let drawing = false
function afterDraw() {
  drawing = true
  requestAnimationFrame(() => requestAnimationFrame(() => (drawing = false)))
}
const STICK_THRESHOLD = 0.55

export type Action = Direction | 'select' | 'back' | 'search' | 'x' | 'menu'

// Listeners can intercept raw actions before navigation (e.g. the keyboard's
// shortcuts). Return true to consume.
const interceptors: Array<(a: Action) => boolean> = []

export function interceptInput(fn: (a: Action) => boolean) {
  interceptors.push(fn)
  return () => {
    const i = interceptors.indexOf(fn)
    if (i >= 0) interceptors.splice(i, 1)
  }
}

export function dispatchAction(action: Action) {
  dispatch(action)
}

function dispatch(action: Action, repeat = false) {
  for (let i = interceptors.length - 1; i >= 0; i--) if (interceptors[i](action)) return
  switch (action) {
    case 'select':
      select()
      break
    case 'back':
      back()
      break
    case 'search':
      goTo('search')
      break
    case 'x':
      break // only used by the on-screen keyboard (delete)
    case 'menu':
      openMenuForFocused()
      break
    default:
      move(action, repeat)
  }
}

const BUTTONS: Array<[number, Action]> = [
  [0, 'select'], // A
  [1, 'back'], // B
  [2, 'x'], // X
  [3, 'search'], // Y
  [9, 'menu'], // Menu ☰: options for the highlighted tile
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
]

interface HeldState {
  since: number
  lastFire: number
}

export function startInput(): () => void {
  const held = new Map<Action, HeldState>()
  let raf = 0

  function press(action: Action, now: number, repeatable: boolean) {
    const h = held.get(action)
    if (!h) {
      held.set(action, { since: now, lastFire: now })
      dispatch(action)
      return
    }
    if (repeatable && !drawing && now - h.since > REPEAT_DELAY && now - h.lastFire > (REPEAT_RATE[action] ?? 120)) {
      h.lastFire = now
      dispatch(action, true)
      afterDraw()
    }
  }

  function poll(now: number) {
    const pressed = new Set<Action>()
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (!pad) continue
      // View held: the D-pad changes the volume (handled by the shell), so don't navigate.
      if (pad.buttons[8]?.pressed) continue
      for (const [index, action] of BUTTONS) {
        if (pad.buttons[index]?.pressed) pressed.add(action)
      }
      const [x = 0, y = 0] = pad.axes
      if (x > STICK_THRESHOLD) pressed.add('right')
      if (x < -STICK_THRESHOLD) pressed.add('left')
      if (y > STICK_THRESHOLD) pressed.add('down')
      if (y < -STICK_THRESHOLD) pressed.add('up')
    }
    if (controllerPaused()) {
      // An app is in front and these presses are for it. Count them as held, so
      // a button still down when the launcher comes back doesn't fire there.
      for (const action of pressed) if (!held.has(action)) held.set(action, { since: now, lastFire: now })
      for (const action of [...held.keys()]) if (!pressed.has(action)) held.delete(action)
      raf = requestAnimationFrame(poll)
      return
    }
    for (const action of pressed) {
      const repeatable = action === 'up' || action === 'down' || action === 'left' || action === 'right'
      press(action, now, repeatable)
    }
    for (const action of [...held.keys()]) if (!pressed.has(action)) held.delete(action)
    raf = requestAnimationFrame(poll)
  }
  raf = requestAnimationFrame(poll)

  const KEYS: Record<string, Action> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    Enter: 'select',
    ' ': 'select',
    Escape: 'back',
    Backspace: 'back',
    BrowserBack: 'back',
    ContextMenu: 'menu',
  }
  let lastKeyRepeat = 0
  function onKey(e: KeyboardEvent) {
    const action = KEYS[e.key]
    if (!action) return
    e.preventDefault()
    if (e.repeat) {
      // Same pacing as a held D-pad
      const now = performance.now()
      if (drawing || now - lastKeyRepeat < (REPEAT_RATE[action] ?? 120)) return
      lastKeyRepeat = now
      dispatch(action, true)
      afterDraw()
      return
    }
    dispatch(action, false)
  }
  window.addEventListener('keydown', onKey)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('keydown', onKey)
  }
}
