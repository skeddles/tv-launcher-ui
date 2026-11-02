import { useState } from 'react'
import { useFocused } from '../lib/focus'
import { openTileMenu, titleShown, useTileOptions } from '../lib/tileMenu'

export interface TileProps {
  id: string
  title: string
  color: string
  image?: string
  icon?: string
  logo?: string // URL of a logo that fills the tile (the name is then hidden by default)
  logoTone?: 'white' | 'invert'
  art?: string // box art: shown whole over a blurred copy (the name is then hidden by default)
  // Tile id for per-tile options (Menu ☰ / right-click); tiles without one have no options
  optionsKey?: string
  subtitle?: string // a second line under the name (e.g. episode)
  badge?: string
  progress?: number // 0-100; shows the accent bar along the bottom
  isDefault?: boolean
  onSelect: () => void
}

export function Tile({
  id,
  title,
  color,
  image,
  icon,
  logo,
  logoTone,
  art,
  optionsKey,
  subtitle,
  badge,
  progress,
  isDefault,
  onSelect,
}: TileProps) {
  const focused = useFocused(id)
  const options = useTileOptions(optionsKey ?? '')
  const [imageFailed, setImageFailed] = useState(false)
  const [iconFailed, setIconFailed] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const [artFailed, setArtFailed] = useState(false)
  const showArt = Boolean(art) && !artFailed
  const showLogo = (Boolean(logo) && !logoFailed) || showArt
  const showImage = Boolean(image) && !imageFailed
  const showTitle = titleShown(optionsKey ? options : undefined, showLogo)
  const showIcon = !showImage && !showLogo && Boolean(icon) && !iconFailed
  const classes = ['tile', focused && 'is-focused', !showTitle && 'tile--bare'].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={classes}
      style={{ background: color }}
      data-focus={id}
      data-focus-group="content"
      data-focus-default={isDefault || undefined}
      data-tile-key={optionsKey}
      data-tile-logo={showLogo || undefined}
      onClick={onSelect}
      onContextMenu={(e) => {
        if (!optionsKey) return
        e.preventDefault()
        openTileMenu({ key: optionsKey, title, hasLogo: showLogo })
      }}
      aria-label={title}
    >
      {showArt && (
        <>
          <img className="tile__art-backdrop" src={art} alt="" loading="lazy" aria-hidden="true" />
          <img className="tile__art" src={art} alt="" loading="lazy" onError={() => setArtFailed(true)} />
        </>
      )}
      {showLogo && !showArt && (
        <img className={`tile__logo${logoTone ? ` tile__logo--${logoTone}` : ''}`} src={logo} alt="" onError={() => setLogoFailed(true)} />
      )}
      {showImage && <img className="tile__image" src={image} alt="" onError={() => setImageFailed(true)} />}
      {showIcon && <img className="tile__icon" src={icon} alt="" onError={() => setIconFailed(true)} />}
      {(showImage || showArt) && showTitle && <span className="tile__shade" aria-hidden="true" />}
      {showTitle && (
        <span className="tile__title">
          {title}
          {subtitle && <span className="tile__subtitle">{subtitle}</span>}
        </span>
      )}
      {badge && <span className="tile__badge">{badge}</span>}
      {progress != null && (
        <span className="tile__progress" aria-hidden="true">
          <span className="tile__progress-fill" style={{ width: `${progress}%` }} />
        </span>
      )}
    </button>
  )
}
