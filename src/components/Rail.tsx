import { useFocused } from '../lib/focus'
import { goTo, usePlace, type Screen } from '../lib/place'
import { Icon, type IconName } from './Icon'

const tabs: Array<{ screen: Screen; label: string; icon: IconName }> = [
  { screen: 'search', label: 'Search', icon: 'search' },
  { screen: 'home', label: 'Home', icon: 'home' },
  { screen: 'movies', label: 'Movies', icon: 'movies' },
  { screen: 'tv', label: 'TV Shows', icon: 'tv' },
  { screen: 'library', label: 'Library', icon: 'library' },
]

function RailButton({ screen, label, icon }: { screen: Screen; label: string; icon: IconName }) {
  const id = `rail:${screen}`
  const focused = useFocused(id)
  const current = usePlace((p) => p.screen)
  // The store lives under Library in the rail.
  const active = current === screen || (screen === 'library' && current === 'store')
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      data-focus={id}
      data-focus-group="rail"
      className={`rail__button${active ? ' rail__button--active' : ''}${focused ? ' is-focused' : ''}`}
      onClick={() => goTo(screen)}
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
