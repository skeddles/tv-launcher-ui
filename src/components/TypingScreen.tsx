// Shown when you click a text field (A) or press Y in mouse mode in another app:
// type here with the controller, then the text is typed into that app.
// Cage can only show one window at a time, so this is a full screen rather
// than a strip at the bottom of the app.

import { useCallback, useEffect, useState } from 'react'
import { tv } from '../lib/bridge'
import { focus, pushBack, useFocusReturn } from '../lib/focus'
import { Keyboard } from './Keyboard'

export function TypingScreen({ label, password = false, onClose }: { label: string; password?: boolean; onClose: () => void }) {
  const [text, setText] = useState('')
  useFocusReturn()

  const cancel = useCallback(() => {
    onClose()
    void tv.cancelTyping()
  }, [onClose])

  const send = (enter: boolean) => {
    onClose()
    void tv.typeText(text, enter)
  }

  useEffect(() => pushBack(() => (cancel(), true)), [cancel])
  useEffect(() => {
    requestAnimationFrame(() => focus('kb:q'))
  }, [])

  return (
    <div className="typing" data-focus-scope role="dialog" aria-modal="true" aria-label={`Type into ${label}`}>
      <h1 className="typing__title">{password ? `Password for ${label}` : `Type into ${label}`}</h1>
      <p className="muted">
        Your text is typed where {label}'s cursor was. Choose Send, or Send + Enter to also press Enter (for search
        boxes and address bars). B cancels.
      </p>
      <div className="search-field" aria-live="polite">
        {text ? (
          <span className="typing__text">{password ? '•'.repeat(text.length) : text}</span>
        ) : (
          <span className="search-field__placeholder">Start typing…</span>
        )}
        <span className="search-field__caret" aria-hidden="true" />
      </div>
      <Keyboard
        value={text}
        onChange={setText}
        onDone={() => send(false)}
        doneLabel="Send"
        onAltDone={() => send(true)}
        altDoneLabel="Send + Enter"
      />
    </div>
  )
}
