// Game info for an emulated game (tile options → Game info): what its file name's
// tags mean, which folder and file it is, its save, and the other copies of the
// same game, so copies with the same name can be told apart.

import { useCallback, useEffect, useState } from 'react'
import { closeGameInfo, useGameInfoId } from '../lib/gameInfo'
import { romTags } from '../lib/romTags'
import { activate, romTiles, useLibrary } from '../lib/library'
import { Dialog } from './Dialog'

interface Info {
  id: string
  file: string
  folder: string
  extra: boolean
  system: string
  size: number
  added: number
  emulator: string | null
  save: { size: number; modified: number } | null
  state: { size: number; modified: number } | null
  others: Array<{ id: string; file: string; extra: boolean }>
}

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
function size(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`
  return `${Math.max(1, Math.round(n / 1e3))} KB`
}

export function GameInfoDialog() {
  const id = useGameInfoId()
  const lib = useLibrary()
  // What was loaded, and for which game (a stale answer for another game is ignored)
  const [loaded, setLoaded] = useState<{ id: string; info: Info | null } | null>(null)
  const close = useCallback(() => closeGameInfo(), [])

  useEffect(() => {
    if (!id) return
    let live = true
    fetch(`/games-api/info/${id}`)
      .then((r) => (r.ok ? (r.json() as Promise<Info>) : Promise.reject(new Error(String(r.status)))))
      .then((i) => live && setLoaded({ id, info: i }))
      .catch(() => live && setLoaded({ id, info: null }))
    return () => {
      live = false
    }
  }, [id])
  const info = loaded?.id === id ? loaded.info : null
  const error = loaded?.id === id && !loaded.info

  if (!id) return null
  const game = lib.roms.games.find((g) => g.id === id)
  const title = game?.title ?? 'Game info'
  const tags = info ? romTags(info.file, game?.system) : []
  const options = [
    ...(game
      ? [
          {
            label: game.resumable ? 'Continue playing' : 'Play',
            onSelect: () => {
              close()
              const [tile] = romTiles(lib, [game])
              void activate(tile)
            },
          },
        ]
      : []),
    { label: 'Done', onSelect: close },
  ]

  return (
    <Dialog title={title} onClose={close} options={options}>
      {error && <p className="muted">Couldn't read this game's details.</p>}
      {!info && !error && <p className="muted">Loading…</p>}
      {info && (
        <dl className="info-grid info-grid--dialog">
          <dt>This copy</dt>
          <dd>{tags.length ? tags.join(' · ') : 'No region or version in its name'}</dd>
          <dt>File</dt>
          <dd>{info.file}</dd>
          <dt>Folder</dt>
          <dd>
            {info.folder}
            {info.extra ? ' (extras: only under All games)' : ''}
          </dd>
          <dt>System</dt>
          <dd>
            {info.system}
            {info.emulator ? ` (RetroArch core: ${info.emulator})` : ' (no emulator set up yet)'}
          </dd>
          {game?.genre && (
            <>
              <dt>Genre</dt>
              <dd>{game.genre}</dd>
            </>
          )}
          <dt>Size</dt>
          <dd>{size(info.size)}</dd>
          <dt>Saved game</dt>
          <dd>{info.save ? `${size(info.save.size)}, last saved ${dateFmt.format(info.save.modified)}` : 'None yet'}</dd>
          <dt>Continue from</dt>
          <dd>{info.state ? dateFmt.format(info.state.modified) : 'Starts from the beginning'}</dd>
          <dt>Played</dt>
          <dd>
            {game?.plays
              ? `${game.plays} time${game.plays === 1 ? '' : 's'}, last ${dateFmt.format(game.playedAt ?? 0)}`
              : 'Not yet (on this TV)'}
          </dd>
          {info.others.length > 0 && (
            <>
              <dt>Other copies</dt>
              <dd>
                {info.others.map((o) => (
                  <div key={o.id}>
                    {romTags(o.file, game?.system).join(' · ') || o.file}
                    {o.extra ? ' (extras)' : ''}
                  </div>
                ))}
              </dd>
            </>
          )}
        </dl>
      )}
    </Dialog>
  )
}
