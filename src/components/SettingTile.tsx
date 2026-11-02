import type { ReactNode } from 'react'
import { useFocused } from '../lib/focus'

/** A setting shown like an app tile: its current value on top, its name below. */
export function SettingTile({
  id,
  label,
  value,
  isDefault,
  onSelect,
}: {
  id: string
  label: string
  value?: ReactNode
  isDefault?: boolean
  onSelect: () => void
}) {
  const focused = useFocused(id)
  return (
    <button
      type="button"
      className={`tile setting-tile${focused ? ' is-focused' : ''}`}
      data-focus={id}
      data-focus-group="content"
      data-focus-default={isDefault || undefined}
      onClick={onSelect}
      aria-label={label}
    >
      {value != null && <span className="setting-tile__value">{value}</span>}
      <span className="tile__title">{label}</span>
    </button>
  )
}
