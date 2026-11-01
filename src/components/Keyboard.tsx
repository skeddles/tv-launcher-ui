// Controller-driven on-screen keyboard. A types the highlighted key,
// X deletes, B closes (overlay mode) or leaves the keyboard.

import { useEffect, useState } from 'react'
import { useFocused, useFocusReturn, pushBack } from '../lib/focus'
import { interceptInput } from '../lib/input'
import { Icon } from './Icon'

const LETTERS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', "'"],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
]

// For web addresses, email and passwords in other apps.
const SYMBOLS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['@', '#', '$', '%', '&', '*', '-', '+', '(', ')'],
  ['!', '"', "'", ':', ';', '/', '?', '=', '_', '~'],
  ['.com', '.', ',', '<', '>', '[', ']', '{', '}', '\\'],
]

interface KeyProps {
  id: string
  label: React.ReactNode
  ariaLabel?: string
  className?: string
  onPress: () => void
}

function Key({ id, label, ariaLabel, className = '', onPress }: KeyProps) {
  const focused = useFocused(id)
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`key ${className}${focused ? ' is-focused' : ''}`}
      data-focus={id}
      data-focus-group="keyboard"
      onClick={onPress}
    >
      {label}
    </button>
  )
}

interface KeyboardProps {
  value: string
  onChange: (v: string) => void
  onDone?: () => void
  doneLabel?: string
  /** Optional second action key, e.g. "Send + Enter". */
  onAltDone?: () => void
  altDoneLabel?: string
  overlay?: boolean
  onClose?: () => void
}

export function Keyboard({ value, onChange, onDone, doneLabel = 'Done', onAltDone, altDoneLabel, overlay, onClose }: KeyboardProps) {
  const [shift, setShift] = useState(false)
  const [symbols, setSymbols] = useState(false)
  const rows = symbols ? SYMBOLS : LETTERS

  const type = (ch: string) => {
    onChange(value + (shift && !symbols ? ch.toUpperCase() : ch))
    if (shift) setShift(false)
  }
  const del = () => onChange(value.slice(0, -1))

  // X on the controller deletes from anywhere while the keyboard is up.
  useEffect(() => interceptInput((a) => (a === 'x' ? (onChange(value.slice(0, -1)), true) : false)), [value, onChange])

  // In overlay mode B closes the keyboard.
  useEffect(() => {
    if (!overlay || !onClose) return
    return pushBack(() => {
      onClose()
      return true
    })
  }, [overlay, onClose])

  return (
    <div
      className={`keyboard${overlay ? ' keyboard--overlay' : ''}`}
      data-focus-scope={overlay || undefined}
      role="group"
      aria-label="On-screen keyboard"
    >
      {rows.map((row, r) => (
        <div className="keyboard__row" key={r}>
          {row.map((ch) => (
            <Key key={ch} id={`kb:${ch}`} label={shift && !symbols ? ch.toUpperCase() : ch} onPress={() => type(ch)} />
          ))}
        </div>
      ))}
      <div className="keyboard__row">
        <Key
          id="kb:shift"
          label={<Icon name="shift" />}
          ariaLabel="Shift"
          className={`key--wide${shift ? ' key--on' : ''}`}
          onPress={() => setShift((s) => !s)}
        />
        <Key
          id="kb:symbols"
          label={symbols ? 'abc' : '&123'}
          ariaLabel={symbols ? 'Letters' : 'Symbols'}
          className="key--wide"
          onPress={() => setSymbols((v) => !v)}
        />
        <Key id="kb:space" label="Space" className="key--xwide" onPress={() => onChange(value + ' ')} />
        <Key id="kb:del" label={<Icon name="backspace" />} ariaLabel="Delete" className="key--wide" onPress={del} />
        <Key id="kb:clear" label="Clear" className="key--wide" onPress={() => onChange('')} />
        {onAltDone && <Key id="kb:altdone" label={altDoneLabel ?? 'Done'} className="key--wide" onPress={onAltDone} />}
        {onDone && <Key id="kb:done" label={doneLabel} className="key--wide key--on" onPress={onDone} />}
      </div>
      <span className="keyboard__hint">A type · X delete · B {overlay ? 'close' : 'back'}</span>
    </div>
  )
}

/** Keyboard that slides over the screen; restores the highlight when it closes. */
export function KeyboardOverlay(props: Omit<KeyboardProps, 'overlay'> & { onClose: () => void }) {
  useFocusReturn()
  return <Keyboard {...props} overlay />
}
