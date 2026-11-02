import { Header } from '../components/Header'
import { Keyboard } from '../components/Keyboard'
import { Tile } from '../components/Tile'
import { Row } from '../components/Row'
import { allTiles, useLibrary } from '../lib/library'
import { goTo, setPlace, usePlace } from '../lib/place'
import { TileRow } from './shared'

export function Search() {
  const lib = useLibrary()
  const text = usePlace((p) => p.searchText)
  const setText = (searchText: string) => setPlace({ searchText })
  const q = text.trim().toLowerCase()
  const matches = q ? allTiles(lib).filter((t) => t.title.toLowerCase().includes(q)) : []

  return (
    <>
      <Header title="Search" />
      <div className="search-field" aria-live="polite">
        {text ? <span>{text}</span> : <span className="search-field__placeholder">Search apps and games</span>}
        <span className="search-field__caret" aria-hidden="true" />
      </div>
      <Keyboard value={text} onChange={setText} />
      {q && (
        <>
          <TileRow title="On this TV" tiles={matches} empty={`Nothing installed matches “${text}”.`} />
          <Row title="More" count={1}>
            <Tile id="search:store" title={`Find “${text}” in the App Store`} color="var(--tile-bg)" onSelect={() => {
                setPlace({ storeQuery: text.trim() })
                goTo('store')
              }}
            />
          </Row>
        </>
      )}
    </>
  )
}
