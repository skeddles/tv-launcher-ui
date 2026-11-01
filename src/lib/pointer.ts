// The launcher is made for the controller, so the mouse pointer stays hidden
// until the mouse actually moves, and hides again after a few seconds still.

const IDLE_MS = 3000

export function startPointerWatch(): () => void {
  const root = document.documentElement
  let timer = 0
  const onMove = () => {
    root.classList.add('pointer-active')
    window.clearTimeout(timer)
    timer = window.setTimeout(() => root.classList.remove('pointer-active'), IDLE_MS)
  }
  window.addEventListener('mousemove', onMove, { passive: true })
  return () => {
    window.removeEventListener('mousemove', onMove)
    window.clearTimeout(timer)
    root.classList.remove('pointer-active')
  }
}

/** Put text on the clipboard (navigator.clipboard, or the older copy command as a fallback). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}
