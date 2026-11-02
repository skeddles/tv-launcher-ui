// App store: Flathub, with controller-friendly apps first.
// Order: our allowlist (data/catalog.ts), then apps whose Flathub listing says
// they support a gamepad, then everything else.

import { useCallback, useEffect, useState } from 'react'
import { Dialog } from '../components/Dialog'
import { Header } from '../components/Header'
import { KeyboardOverlay } from '../components/Keyboard'
import { Row } from '../components/Row'
import { Tile } from '../components/Tile'
import { colorFor, controllerFriendly } from '../data/catalog'
import { tv, type StoreApp } from '../lib/bridge'
import { install, uninstall, useLibrary } from '../lib/library'
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
        const badge =
          progress != null ? 'Installing' : isInstalled ? 'Installed' : rank(a) < 2 ? 'Controller' : undefined
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
  const lib = useLibrary()
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState(query)
  const [featured, setFeatured] = useState<StoreApp[]>([])
  const [searched, setSearched] = useState<{ query: string; apps: StoreApp[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<StoreApp | null>(null)

  useEffect(() => {
    tv.storeDetails(controllerFriendly)
      .then(setFeatured)
      .catch(() => setError('Couldn’t reach Flathub. Check the internet connection.'))
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

  const installedIds = new Set(lib.flatpaks.map((f) => f.appId))
  const onPick = (a: StoreApp) => (installedIds.has(a.appId) ? setPicked(a) : void install(a.appId, a.name))
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
      <Row title="Works with a controller" count={featured.length} empty={error ? undefined : 'Loading…'}>
        <StoreTiles row="featured" apps={featured} onPick={onPick} />
      </Row>

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
        <Dialog
          title={picked.name}
          message="This app is installed."
          onClose={closeDialog}
          options={[
            {
              label: 'Open',
              onSelect: () => {
                setPicked(null)
                void tv.launch({ kind: 'flatpak', appId: picked.appId }, picked.name)
              },
            },
            {
              label: 'Uninstall',
              onSelect: () => {
                setPicked(null)
                void uninstall(picked.appId, picked.name)
              },
            },
            { label: 'Cancel', onSelect: closeDialog },
          ]}
        />
      )}
    </>
  )
}
