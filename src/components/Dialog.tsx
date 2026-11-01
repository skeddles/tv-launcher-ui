import { useEffect } from 'react'
import { focus, pushBack, useFocused, useFocusReturn } from '../lib/focus'

export interface DialogOption {
  label: string
  onSelect: () => void
}

function Option({ id, label, onSelect }: DialogOption & { id: string }) {
  const focused = useFocused(id)
  return (
    <button
      type="button"
      className={`list-item${focused ? ' is-focused' : ''}`}
      data-focus={id}
      data-focus-group="dialog"
      onClick={onSelect}
    >
      {label}
    </button>
  )
}

export function Dialog({
  title,
  message,
  options,
  onClose,
  children,
}: {
  title: string
  message?: string
  options: DialogOption[]
  onClose: () => void
  children?: React.ReactNode
}) {
  useFocusReturn()
  useEffect(() => pushBack(() => (onClose(), true)), [onClose])
  useEffect(() => {
    requestAnimationFrame(() => focus('dialog:0'))
  }, [])
  return (
    <div className="dialog" data-focus-scope role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog__panel">
        <h2 className="dialog__title">{title}</h2>
        {message && <p className="muted">{message}</p>}
        {children}
        <div className="list">
          {options.map((o, i) => (
            <Option key={o.label} id={`dialog:${i}`} {...o} />
          ))}
        </div>
      </div>
    </div>
  )
}
