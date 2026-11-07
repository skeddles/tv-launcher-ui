import { useEffect, useState } from 'react'
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
  rowTitle?: string // the row it's in (tile options: hide the row)
  genre?: string // tile options: hide this (game) genre
  rowGenre?: string // the genre the row is about
  rowDomain?: 'games' | 'video'
  tag?: string // small label at the bottom (which copy of a game this is)
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
  rowTitle,
  genre,
  rowGenre,
  rowDomain,
  tag,
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
  const [logoTry, setLogoTry] = useState(0)
  // A logo that didn't load (no network yet at boot): try again in a while
  useEffect(() => {
    if (!logoFailed || logoTry >= 20) return
    const t = window.setTimeout(() => {
      setLogoTry((n) => n + 1)
      setLogoFailed(false)
    }, 30_000)
    return () => window.clearTimeout(t)
  }, [logoFailed, logoTry])
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
      data-tile-row={rowTitle}
      data-tile-genre={genre}
      data-row-genre={rowGenre}
      data-row-domain={rowDomain}
      onClick={onSelect}
      onContextMenu={(e) => {
        if (!optionsKey) return
        e.preventDefault()
        openTileMenu({ key: optionsKey, title, hasLogo: showLogo, row: rowTitle, genre, rowGenre, rowDomain })
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
        <img
          className={`tile__logo${logoTone ? ` tile__logo--${logoTone}` : ''}`}
          src={logoTry && logo ? `${logo}${logo.includes('?') ? '&' : '?'}try=${logoTry}` : logo}
          alt=""
          onError={() => setLogoFailed(true)}
        />
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
      {tag && !showTitle && <span className="tile__tag">{tag}</span>}
      {progress != null && (
        <span className="tile__progress" aria-hidden="true">
          <span className="tile__progress-fill" style={{ width: `${progress}%` }} />
        </span>
      )}
    </button>
  )
}
