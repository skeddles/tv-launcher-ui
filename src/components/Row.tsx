import type { ReactNode } from 'react'

interface RowProps {
  title: string
  first?: boolean
  count: number
  carousel?: boolean // one line that scrolls sideways (Recently Opened)
  empty?: string
  children: ReactNode
}

export function Row({ title, first, count, carousel, empty, children }: RowProps) {
  // Small rows scroll as a unit so the heading stays visible with the tiles.
  const anchor = count <= 12
  return (
    <section className="row" aria-label={title} data-scroll-anchor={anchor || undefined} data-scroll-top={first || undefined}>
      <h2 className="row__title">{title}</h2>
      {count === 0 && empty ? (
        <p className="row__empty">{empty}</p>
      ) : (
        <div className={`row__grid${carousel ? ' row__grid--carousel' : ''}`} data-carousel={carousel || undefined}>
          {children}
        </div>
      )}
    </section>
  )
}
