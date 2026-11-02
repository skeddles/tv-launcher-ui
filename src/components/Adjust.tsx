import { useEffect, type ReactNode } from 'react'
import { interceptInput } from '../lib/input'
import { Dialog } from './Dialog'

/** A setting changed with left/right (or the ◀ ▶ buttons with a mouse); A or B closes. */
export function Adjust({
  title,
  value,
  hint,
  onStep,
  onClose,
}: {
  title: string
  value: ReactNode
  hint?: string
  onStep: (dir: -1 | 1) => void
  onClose: () => void
}) {
  useEffect(
    () =>
      interceptInput((a) => {
        if (a !== 'left' && a !== 'right') return false
        onStep(a === 'right' ? 1 : -1)
        return true
      }),
    [onStep],
  )
  return (
    <Dialog title={title} message={hint} options={[{ label: 'Done', onSelect: onClose }]} onClose={onClose}>
      <div className="adjust">
        <button type="button" className="adjust__arrow" tabIndex={-1} aria-label="Less" onClick={() => onStep(-1)}>
          ◀
        </button>
        <div className="adjust__value">{value}</div>
        <button type="button" className="adjust__arrow" tabIndex={-1} aria-label="More" onClick={() => onStep(1)}>
          ▶
        </button>
      </div>
      <p className="adjust__help muted">◀ ▶ on the D-pad to change</p>
    </Dialog>
  )
}
