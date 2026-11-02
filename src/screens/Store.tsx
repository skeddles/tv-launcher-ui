// App store: Flathub. Search, then suggestion rows (the launcher's list of
// controller-friendly apps, then Flathub collections like Popular and Games).
// Selecting an app opens its details page; installing starts from there.

import { useCallback, useEffect, useState } from 'react'
import { AppDetails } from '../components/AppDetails'
import { Header } from '../components/Header'
import { KeyboardOverlay } from '../components/Keyboard'
import { Row } from '../components/Row'
import { Tile } from '../components/Tile'
import { colorFor, controllerFriendly } from '../data/catalog'
import { tv, type StoreApp } from '../lib/bridge'
import { collection, STORE_ROWS } from '../lib/flathub'
import { useLibrary } from '../lib/library'
import { setPlace, usePlace } from '../lib/place'

function rank(a: StoreApp) {
  if (controllerFriendly.includes(a.appId)) return 0
  if (a.gamepad) return 1
  return 2
}

function StoreTiles({ row, apps, onPick, first }: { row: string; apps: StoreApp[]; onPick: (a: StoreApp) => void; first?: boolean }) {
  const lib = useLibrary()
  const installed = new Set(lib.flatpaks.map((f) => f.appId))
  return (
    <>
      {apps.map((a, i) => {
        const progress = lib.installing[a.appId]
        const isInstalled = installed.has(a.appId)
        const badge = progress != null ? 'Installing' : isInstalled ? 'Installed' : rank(a) < 2 ? 'Controller' : undefined
        return (
          <Tile
            key={a.appId}
            id={`${row}:${a.appId}`}
            title={a.name}
            color={colorFor(a.appId)}
            icon={a.icon}
            badge={badge}
            progress={progress}
            isDefault={first && i === 0}
            onSelect={() => onPick(a)}
          />
        )
      })}
    </>
  )
}

export function Store() {
  const query = usePlace((p) => p.storeQuery)
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState(query)
  const [featured, setFeatured] = useState<StoreApp[]>([])
  const [searched, setSearched] = useState<{ query: string; apps: StoreApp[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<StoreApp | null>(null)
  const [rows, setRows] = useState<Record<string, StoreApp[]>>({})

  useEffect(() => {
    tv.storeDetails(controllerFriendly)
      .then(setFeatured)
      .catch(() => setError('Couldn’t reach Flathub. Check the internet connection.'))
  }, [])

  // Suggestion rows, straight from Flathub (each fills in when it arrives).
  useEffect(() => {
    let cancelled = false
    for (const r of STORE_ROWS) {
      collection(r.path)
        .then((apps) => !cancelled && setRows((cur) => ({ ...cur, [r.title]: apps })))
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [])

  const results = searched && searched.query === query ? searched.apps : null

  useEffect(() => {
    if (!query) return
    let cancelled = false
    tv.storeSearch(query)
      .then((r) => !cancelled && setSearched({ query, apps: [...r].sort((a, b) => rank(a) - rank(b)) }))
      .catch(() => !cancelled && setError('Search failed. Check the internet connection.'))
    return () => {
      cancelled = true
    }
  }, [query])

  const onPick = (a: StoreApp) => setPicked(a)
  const closeDialog = useCallback(() => setPicked(null), [])
  const closeKeyboard = useCallback(() => setTyping(false), [])

  return (
    <>
      <Header title="App Store" />
      <Row title="Search Flathub" count={1} first>
        <Tile
          id="store:search"
          title={query ? `Search: ${query}` : 'Search for an app'}
          color="var(--tile-bg)"
          isDefault={!query}
          onSelect={() => {
            setDraft(query)
            setTyping(true)
          }}
        />
      </Row>
      {error && <p className="muted">{error}</p>}
      {query && (
        <Row title={`Results for “${query}”`} count={results?.length ?? 0} empty={results ? 'No apps found.' : 'Searching…'}>
          <StoreTiles row="results" apps={results ?? []} onPick={onPick} first />
        </Row>
      )}
      <Row carousel title="Works with a controller" count={featured.length} empty={error ? undefined : 'Loading…'}>
        <StoreTiles row="featured" apps={featured} onPick={onPick} />
      </Row>
      {STORE_ROWS.map((r) =>
        rows[r.title]?.length ? (
          <Row carousel key={r.title} title={r.title} count={rows[r.title].length}>
            <StoreTiles row={r.title} apps={rows[r.title]} onPick={onPick} />
          </Row>
        ) : null,
      )}

      {typing && (
        <KeyboardOverlay
          value={draft}
          onChange={setDraft}
          doneLabel="Search"
          onDone={() => {
            setPlace({ storeQuery: draft.trim() })
            setTyping(false)
          }}
          onClose={closeKeyboard}
        />
      )}
      {picked && (
        <AppDetails
          key={picked.appId}
          appId={picked.appId}
          name={picked.name}
          icon={picked.icon}
          controllerPick={controllerFriendly.includes(picked.appId)}
          onClose={closeDialog}
        />
      )}
    </>
  )
}
