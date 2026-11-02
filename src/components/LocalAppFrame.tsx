import { useEffect, useRef } from 'react'
import { closeLocalApp, useLocalApp } from '../lib/localApps'
import { removeLaunchCover } from '../lib/launchCover'

/** One of your own apps, full screen over the launcher. */
export function LocalAppFrame() {
  const app = useLocalApp()
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!app) return
    // Escape on a keyboard also closes it (the page gets keys first, so only
    // when the launcher itself has the focus).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLocalApp()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [app])

  if (!app) return null
  return (
    <div className="local-app">
      <iframe
        ref={frame}
        key={app.id}
        className="local-app__frame"
        src={app.url}
        title={app.name}
        allow="gamepad; autoplay; fullscreen"
        onLoad={() => {
          removeLaunchCover()
          frame.current?.focus()
        }}
      />
      {/* fades out by itself (app.css) */}
      <div className="local-app__hint" role="status">
        Press the Xbox button to go back
      </div>
    </div>
  )
}
