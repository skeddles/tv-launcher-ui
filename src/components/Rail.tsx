import { focusContent, useFocused } from '../lib/focus'
import { goTo, usePlace, type Screen } from '../lib/place'
import { Icon, type IconName } from './Icon'

const tabs: Array<{ screen: Screen; label: string; icon: IconName }> = [
  { screen: 'search', label: 'Search', icon: 'search' },
  { screen: 'home', label: 'Home', icon: 'home' },
  { screen: 'movies', label: 'Movies', icon: 'movies' },
  { screen: 'tv', label: 'TV Shows', icon: 'tv' },
  { screen: 'apps', label: 'Apps', icon: 'apps' },
  { screen: 'games', label: 'Games', icon: 'gamepad' },
]

function RailButton({ screen, label, icon }: { screen: Screen; label: string; icon: IconName }) {
  const id = `rail:${screen}`
  const focused = useFocused(id)
  const current = usePlace((p) => p.screen)
  // The store lives under Apps in the rail; All games and itch.io under Games.
  const active = current === screen || (screen === 'apps' && current === 'store') || (screen === 'games' && (current === 'allgames' || current === 'itch'))
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      data-focus={id}
      data-focus-group="rail"
      className={`rail__button${active ? ' rail__button--active' : ''}${focused ? ' is-focused' : ''}`}
      onClick={() => {
        goTo(screen)
        // Move into the screen so the rail closes (once the screen has rendered;
        // a screen still loading gets a few more tries).
        let tries = 0
        const go = () => {
          if (!focusContent() && ++tries < 10) setTimeout(go, 100)
        }
        requestAnimationFrame(() => requestAnimationFrame(go))
      }}
    >
      <Icon name={icon} />
      <span className="rail__label">{label}</span>
    </button>
  )
}

export function Rail() {
  return (
    <nav className="rail" aria-label="Main">
      <div className="rail__top-spacer" aria-hidden="true" />
      <div className="rail__grow" />
      {tabs.map((t) => (
        <RailButton key={t.screen} {...t} />
      ))}
      <div className="rail__grow" />
      <RailButton screen="settings" label="Settings" icon="settings" />
    </nav>
  )
}
