import { useEffect, useState } from 'react'
import { Dialog } from './components/Dialog'
import { Rail } from './components/Rail'
import { TileOptionsDialog } from './components/TileOptions'
import { TypingScreen } from './components/TypingScreen'
import { tv } from './lib/bridge'
import { currentElement, focus, pushBack, startFocusWatcher } from './lib/focus'
import { startInput } from './lib/input'
import { markAppOpened, startAppFront } from './lib/appfront'
import { startLaunchCover } from './lib/launchCover'
import { startLibrary, useLibrary } from './lib/library'
import { startPointerWatch } from './lib/pointer'
import { getPlace, goTo, setPlace, usePlace, type Screen } from './lib/place'
import { Browse } from './screens/Browse'
import { Home } from './screens/Home'
import { Library } from './screens/Library'
import { Search } from './screens/Search'
import { Settings } from './screens/Settings'
import { Store } from './screens/Store'

function ScreenView({ screen }: { screen: Screen }) {
  switch (screen) {
    case 'search':
      return <Search />
    case 'movies':
      return <Browse title="Movies" tag="movies" />
    case 'tv':
      return <Browse title="TV Shows" tag="tv" />
    case 'library':
      return <Library />
    case 'store':
      return <Store />
    case 'settings':
      return <Settings />
    default:
      return <Home />
  }
}

// B / Escape when nothing else wants it: tiles -> rail -> Home.
function defaultBack(): boolean {
  const { screen } = getPlace()
  const el = currentElement()
  if (screen === 'store') {
    setPlace({ screen: 'library', focusId: null })
    return true
  }
  if (el && el.dataset.focusGroup !== 'rail') {
    focus(`rail:${screen}`)
    return true
  }
  if (screen !== 'home') goTo('home')
  return true
}

export default function App() {
  const screen = usePlace((p) => p.screen)
  const notice = useLibrary().notice
  // Set while another app is waiting for text (Y in mouse mode).
  const [typingFor, setTypingFor] = useState<{ label: string; password: boolean } | null>(null)
  // Set after the Xbox button left a Steam game running behind the launcher.
  const [running, setRunning] = useState<{ label: string; quitLabel: string } | null>(null)

  useEffect(
    () =>
      tv.onEvent((e) => {
        if (e.type === 'keyboard-request') setTypingFor({ label: e.label, password: Boolean(e.password) })
        if (e.type === 'keyboard-closed') setTypingFor(null)
        if (e.type === 'app-running') setRunning({ label: e.label, quitLabel: e.quitLabel })
        if (e.type === 'steam-closed') setRunning(null)
      }),
    [],
  )

  useEffect(() => {
    startAppFront()
    startLaunchCover()
    startLibrary()
    const stopInput = startInput()
    const stopWatch = startFocusWatcher()
    const stopPointer = startPointerWatch()
    const popBack = pushBack(defaultBack)
    return () => {
      stopInput()
      stopWatch()
      stopPointer()
      popBack()
    }
  }, [])

  return (
    <div className="app">
      <Rail />
      <main className="main" data-scroll key={screen}>
        <ScreenView screen={screen} />
      </main>
      {typingFor && <TypingScreen label={typingFor.label} password={typingFor.password} onClose={() => setTypingFor(null)} />}
      {running && !typingFor && (
        <Dialog
          title={`${running.label} is still running`}
          options={[
            {
              label: 'Resume',
              onSelect: () => {
                setRunning(null)
                void tv.resumeApp().then((back) => back && markAppOpened())
              },
            },
            {
              label: running.quitLabel,
              onSelect: () => {
                setRunning(null)
                void tv.quitApp()
              },
            },
            { label: 'Stay on the launcher', onSelect: () => setRunning(null) },
          ]}
          onClose={() => setRunning(null)}
        />
      )}
      <TileOptionsDialog />
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  )
}
