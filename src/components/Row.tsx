import { Children, useEffect, useRef, type ReactNode } from 'react'
import { revealFocusIn } from '../lib/focus'
import { usePrefs } from '../lib/prefs'

interface RowProps {
  title: string
  first?: boolean
  count: number // items in the row (so far)
  // One line that scrolls sideways (suggestion rows). Otherwise the row takes as
  // many lines as it needs, up to what fits on one screen; beyond that it
  // scrolls sideways as one block.
  carousel?: boolean
  empty?: string
  // Called when the highlight nears the end of what's shown, to add more items
  onNearEnd?: () => void
  children: ReactNode
}

// Layout numbers from tokens.css / app.css (the design is fixed at 1920x1080)
const CONTENT_WIDTH = 1920 - 80 - 2 * 64 // screen - rail - side padding
const GAP = 24
const SCREEN_ROOM = 1080 - 48 - 48 - 36 - 64 // screen - top padding - header - row heading - bottom padding

/** How many lines of tiles fit on one screen at this tile size. */
function maxLines(columns: number): number {
  const tileH = ((CONTENT_WIDTH - (columns - 1) * GAP) / columns) * (9 / 16)
  return Math.max(1, Math.floor((SCREEN_ROOM + GAP) / (tileH + GAP)))
}

export function Row({ title, first, count, carousel, empty, onNearEnd, children }: RowProps) {
  const columns = usePrefs((p) => p.tileColumns)
  const fit = maxLines(columns)
  const lines = carousel ? 1 : Math.max(1, Math.min(fit, Math.ceil(count / columns)))
  // Everything fits: an ordinary grid, read left to right. More than fits: a
  // block of `lines` lines that scrolls sideways, filled column by column.
  const scrolls = count > lines * columns
  const grid = useRef<HTMLDivElement>(null)
  const nearEnd = useRef(onNearEnd)
  useEffect(() => {
    nearEnd.current = onNearEnd
  }, [onNearEnd])

  // Ask for more once the last tile is within about a screen to the right
  const childCount = Children.count(children)
  useEffect(() => {
    const el = grid.current
    const last = el?.lastElementChild
    if (!el || !last || !scrolls || !nearEnd.current) return
    const obs = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && nearEnd.current?.(), {
      root: el,
      rootMargin: '0px 1920px 0px 0px',
    })
    obs.observe(last)
    revealFocusIn(el)
    return () => obs.disconnect()
  }, [childCount, scrolls])

  // Rows that fit on screen scroll as a unit so the heading stays visible with the tiles.
  const anchor = lines * columns <= 24 || scrolls
  const className = ['row__grid', scrolls && 'row__grid--scroll'].filter(Boolean).join(' ')
  return (
    <section className="row" aria-label={title} data-scroll-anchor={anchor || undefined} data-scroll-top={first || undefined}>
      <h2 className="row__title">{title}</h2>
      {count === 0 && empty ? (
        <p className="row__empty">{empty}</p>
      ) : (
        <div
          ref={grid}
          className={className}
          style={scrolls ? { gridTemplateRows: `repeat(${lines}, auto)` } : undefined}
          data-carousel={scrolls || undefined}
        >
          {children}
        </div>
      )}
    </section>
  )
}
