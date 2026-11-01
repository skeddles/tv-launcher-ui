import { useEffect, useState } from 'react'
import { Rail } from './components/Rail'
import { TypingScreen } from './components/TypingScreen'
import { tv } from './lib/bridge'
import { currentElement, focus, pushBack, startFocusWatcher } from './lib/focus'
import { startInput } from './lib/input'
import { startLibrary, useLibrary } from './lib/library'
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
  const [typingFor, setTypingFor] = useState<string | null>(null)

  useEffect(
    () =>
      tv.onEvent((e) => {
        if (e.type === 'keyboard-request') setTypingFor(e.label)
        if (e.type === 'keyboard-closed') setTypingFor(null)
      }),
    [],
  )

  useEffect(() => {
    startLibrary()
    const stopInput = startInput()
    const stopWatch = startFocusWatcher()
    const popBack = pushBack(defaultBack)
    return () => {
      stopInput()
      stopWatch()
      popBack()
    }
  }, [])

  return (
    <div className="app">
      <Rail />
      <main className="main" data-scroll key={screen}>
        <ScreenView screen={screen} />
      </main>
      {typingFor && <TypingScreen label={typingFor} onClose={() => setTypingFor(null)} />}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  )
}
