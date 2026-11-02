import { useEffect, useRef } from 'react'
import { currentElement } from '../lib/focus'

/** One white highlight frame that glides between items instead of each item
 *  drawing its own outline. It reads the highlighted element's position every
 *  frame (so it follows scrolling and the rail expanding) and the CSS
 *  transition does the gliding. Each item's own outline offset and corner
 *  radius still decide the frame's shape. */
export function FocusRing() {
  const ring = useRef<HTMLDivElement>(null)
  useEffect(() => {
    document.documentElement.classList.add('has-focus-ring')
    let raf = 0
    let last = ''
    let lastEl: HTMLElement | null = null
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const el = currentElement()
      const div = ring.current
      if (!div) return
      if (!el) {
        if (last !== 'hidden') div.style.opacity = '0'
        last = 'hidden'
        return
      }
      const cs = getComputedStyle(el)
      const width = parseFloat(cs.outlineWidth) || 4
      const offset = parseFloat(cs.outlineOffset) || 0
      const pad = offset + width
      const r = el.getBoundingClientRect()
      const radius = (parseFloat(cs.borderTopLeftRadius) || 0) + Math.max(0, pad)
      const key = `${r.left},${r.top},${r.width},${r.height},${pad},${radius}`
      if (key === last) return
      // A new element appearing far away (screen change, dialog) jumps rather than glides.
      const jump = lastEl !== el && (!lastEl || !lastEl.isConnected || last === 'hidden')
      div.style.transition = jump ? 'none' : ''
      div.style.opacity = '1'
      div.style.borderWidth = `${width}px`
      div.style.borderRadius = `${radius}px`
      div.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`
      div.style.width = `${r.width + pad * 2}px`
      div.style.height = `${r.height + pad * 2}px`
      last = key
      lastEl = el
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      document.documentElement.classList.remove('has-focus-ring')
    }
  }, [])
  return <div ref={ring} className="focus-ring" aria-hidden="true" />
}
