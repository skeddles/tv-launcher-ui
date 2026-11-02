import type { ReactNode } from 'react'
import { useFocused } from '../lib/focus'
import { Icon, type IconName } from './Icon'

/** A setting shown like an app tile: its current value (or an icon) on top, its name below. */
export function SettingTile({
  id,
  label,
  value,
  icon,
  isDefault,
  onSelect,
}: {
  id: string
  label: string
  value?: ReactNode
  icon?: IconName // shown when there's no value
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
      {value != null ? (
        <span className="setting-tile__value">{value}</span>
      ) : (
        icon && (
          <span className="setting-tile__icon">
            <Icon name={icon} size={44} />
          </span>
        )
      )}
      <span className="tile__title">{label}</span>
    </button>
  )
}
