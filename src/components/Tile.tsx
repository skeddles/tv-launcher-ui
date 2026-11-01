import { useState } from 'react'
import { useFocused } from '../lib/focus'

export interface TileProps {
  id: string
  title: string
  color: string
  image?: string
  icon?: string
  logo?: string // URL of a logo that fills the tile; the title is then hidden
  badge?: string
  progress?: number // 0-100; shows the accent bar along the bottom
  isDefault?: boolean
  onSelect: () => void
}

export function Tile({ id, title, color, image, icon, logo, badge, progress, isDefault, onSelect }: TileProps) {
  const focused = useFocused(id)
  const [imageFailed, setImageFailed] = useState(false)
  const [iconFailed, setIconFailed] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const showLogo = logo && !logoFailed
  const showImage = image && !imageFailed
  return (
    <button
      type="button"
      className={`tile${focused ? ' is-focused' : ''}`}
      style={{ background: color }}
      data-focus={id}
      data-focus-group="content"
      data-focus-default={isDefault || undefined}
      onClick={onSelect}
      aria-label={title}
    >
      {showLogo && <img className="tile__logo" src={logo} alt="" onError={() => setLogoFailed(true)} />}
      {showImage && <img className="tile__image" src={image} alt="" onError={() => setImageFailed(true)} />}
      {!showImage && !showLogo && icon && !iconFailed && (
        <img className="tile__icon" src={icon} alt="" onError={() => setIconFailed(true)} />
      )}
      {showImage && <span className="tile__shade" aria-hidden="true" />}
      {!showLogo && <span className="tile__title">{title}</span>}
      {badge && <span className="tile__badge">{badge}</span>}
      {progress != null && (
        <span className="tile__progress" aria-hidden="true">
          <span className="tile__progress-fill" style={{ width: `${progress}%` }} />
        </span>
      )}
    </button>
  )
}
