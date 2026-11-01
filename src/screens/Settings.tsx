import { useCallback, useEffect, useState } from 'react'
import { Dialog } from '../components/Dialog'
import { Header } from '../components/Header'
import { accents } from '../data/catalog'
import { tv, type DisplaySettings, type OsUpdateState, type SystemInfo } from '../lib/bridge'
import { notify } from '../lib/library'
import { useFocused } from '../lib/focus'
import { interceptInput } from '../lib/input'
import { getPlace } from '../lib/place'
import { setPrefs, usePrefs } from '../lib/prefs'

function Item({ id, label, value, onSelect, isDefault }: { id: string; label: string; value?: React.ReactNode; onSelect: () => void; isDefault?: boolean }) {
  const focused = useFocused(id)
  return (
    <button
      type="button"
      className={`list-item${focused ? ' is-focused' : ''}`}
      data-focus={id}
      data-focus-group="content"
      data-focus-default={isDefault || undefined}
      onClick={onSelect}
    >
      <span>{label}</span>
      {value != null && <span className="list-item__value">{value}</span>}
    </button>
  )
}

type Confirm = 'reboot' | 'poweroff' | 'update' | null

const mbText = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} GB` : `${Math.round(n)} MB`)

/** What the System update row says on the right. */
function osUpdateValue(u: OsUpdateState | null): React.ReactNode {
  if (!u) return '…'
  switch (u.phase) {
    case 'checking':
      return 'Checking…'
    case 'up-to-date':
      return 'Up to date'
    case 'available':
      return u.totalMB ? `Update available · ${mbText(u.totalMB)} · Download` : 'Update available · Download'
    case 'downloading':
      return (
        <span className="volume" aria-label={`Downloading ${u.percent ?? 0}%`}>
          <span className="volume__bar" aria-hidden="true">
            <span className="volume__fill" style={{ width: `${u.percent ?? 0}%` }} />
          </span>
          <span className="update__text">
            {u.message ??
              (u.percent == null
                ? 'Starting…'
                : `${u.percent}% · ${mbText(u.doneMB)} of ${mbText(u.totalMB)}`)}
          </span>
        </span>
      )
    case 'ready':
      return 'Ready · shut down to finish'
    case 'busy':
      return u.message ?? 'Updating in the background…'
    case 'error':
      return u.message ?? "Couldn't update"
    default:
      return 'Check for updates'
  }
}

export function Settings() {
  const accent = usePrefs((p) => p.accent)
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [disp, setDisp] = useState<DisplaySettings | null>(null)
  const [volume, setVolume] = useState<number | null>(null)
  const [osUpdate, setOsUpdate] = useState<OsUpdateState | null>(null)
  const close = useCallback(() => setConfirm(null), [])

  useEffect(() => {
    tv.systemInfo().then(setInfo).catch(() => setInfo(null))
    tv.getDisplay().then(setDisp).catch(() => setDisp(null))
    tv.getVolume()
      .then((v) => setVolume(v.volume))
      .catch(() => setVolume(null))
    tv.osUpdateStatus()
      .then(setOsUpdate)
      .catch(() => setOsUpdate(null))
    const stopEvents = tv.onEvent((e) => {
      if (e.type === 'volume') setVolume(e.volume)
      if (e.type === 'os-update') setOsUpdate(e.state)
    })
    // On the Volume row, left/right change the volume like a TV's volume bar.
    const stopKeys = interceptInput((a) => {
      if ((a !== 'left' && a !== 'right') || getPlace().focusId !== 'settings:volume') return false
      void tv.changeVolume(a === 'right' ? 1 : -1)
      return true
    })
    return () => {
      stopEvents()
      stopKeys()
    }
  }, [])

  const nextScale = async () => {
    if (!disp) return
    const next = disp.scales[(disp.scales.indexOf(disp.scale) + 1) % disp.scales.length]
    setDisp({ ...disp, scale: next })
    try {
      await tv.setDisplay({ scale: next })
    } catch {
      notify("Couldn't change the app size")
    }
  }

  const updateAction = () => {
    const phase = osUpdate?.phase ?? 'unknown'
    if (phase === 'available') void tv.osUpdateDownload().then(setOsUpdate)
    else if (phase === 'ready') setConfirm('update')
    else if (phase === 'unknown' || phase === 'up-to-date' || phase === 'error') void tv.osUpdateCheck().then(setOsUpdate)
  }

  const nextAccent = () => setPrefs({ accent: accents[(accents.indexOf(accent) + 1) % accents.length] })

  return (
    <>
      <Header title="Settings" />
      <div className="list" data-scroll-anchor data-scroll-top>
        <Item
          id="settings:accent"
          isDefault
          label="Accent color"
          onSelect={nextAccent}
          value={
            <span className="swatches" aria-label={`Current ${accent}`}>
              {accents.map((c) => (
                <span key={c} className={`swatch${c === accent ? ' swatch--on' : ''}`} style={{ background: c }} />
              ))}
            </span>
          }
        />
        <Item
          id="settings:volume"
          label="Volume"
          onSelect={() => void tv.changeVolume(1)}
          value={
            <span className="volume" aria-label={`Volume ${volume ?? ''}%`}>
              <span aria-hidden="true">◀</span>
              <span className="volume__bar" aria-hidden="true">
                <span className="volume__fill" style={{ width: `${volume ?? 0}%` }} />
              </span>
              <span className="volume__value">{volume == null ? '…' : `${volume}%`}</span>
              <span aria-hidden="true">▶</span>
            </span>
          }
        />
        <Item
          id="settings:scale"
          label="App size (other apps and the pointer)"
          onSelect={() => void nextScale()}
          value={disp ? `${Math.round(disp.scale * 100)}%` : '…'}
        />
        <Item
          id="settings:mouse-reset"
          label="Forget mouse mode choices"
          onSelect={() => {
            void tv.resetInputPrefs()
            notify('Mouse mode will decide automatically again for every app')
          }}
        />
        <Item id="settings:update" label="System update" onSelect={updateAction} value={osUpdateValue(osUpdate)} />
        <Item id="settings:reload" label="Reload launcher screen" onSelect={() => void tv.power('reload-ui')} />
        <Item id="settings:restart" label="Restart launcher" onSelect={() => void tv.power('restart-shell')} />
        <Item id="settings:reboot" label="Restart TV PC" onSelect={() => setConfirm('reboot')} />
        <Item id="settings:poweroff" label="Shut down" onSelect={() => setConfirm('poweroff')} />
      </div>

      <section className="row" data-scroll-anchor>
        <h2 className="row__title">Controller in other apps</h2>
        <p className="muted">
          Apps that don't read the controller get mouse mode automatically. Hold the Xbox button for a second to turn it
          on or off for the app you're in; that choice is remembered.
        </p>
        <dl className="info-grid">
          <dt>Xbox button</dt>
          <dd>Back to Home (hold: mouse mode on/off)</dd>
          <dt>Left stick</dt>
          <dd>Move the pointer (hold RT for slow and precise)</dd>
          <dt>Right stick</dt>
          <dd>Scroll</dd>
          <dt>A / B</dt>
          <dd>Click / right-click</dd>
          <dt>Y</dt>
          <dd>Keyboard: type, then Send</dd>
          <dt>X</dt>
          <dd>Space (play/pause most videos)</dd>
          <dt>D-pad</dt>
          <dd>Arrow keys</dd>
          <dt>Menu / View</dt>
          <dd>Enter / Escape</dd>
          <dt>LB / RB</dt>
          <dd>Back / Forward</dd>
          <dt>View + D-pad ↑↓</dt>
          <dd>Volume (anywhere, also in the launcher)</dd>
        </dl>
      </section>

      <section className="row" data-scroll-anchor>
        <h2 className="row__title">About</h2>
        {info ? (
          <dl className="info-grid">
            <dt>Name</dt>
            <dd>{info.hostname}</dd>
            <dt>UI version</dt>
            <dd>{info.uiCommit}</dd>
            <dt>UI source</dt>
            <dd>{info.uiSource === 'dev-server' ? 'Live (updates automatically)' : info.uiSource === 'fallback-build' ? 'Backup copy (live server not running)' : 'Browser'}</dd>
            <dt>System image</dt>
            <dd>{info.imageVersion}</dd>
            <dt>Shell</dt>
            <dd>
              {info.shellVersion} · Electron {info.electron} · Chromium {info.chrome}
            </dd>
          </dl>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </section>

      {confirm === 'update' && (
        <Dialog
          title="Finish the update?"
          message="The PC shuts down. Then press its power button: it starts with the new system. (A full shutdown keeps the TV picture from getting stuck.)"
          onClose={close}
          options={[
            { label: 'Shut down now', onSelect: () => void tv.power('poweroff') },
            { label: 'Later', onSelect: close },
          ]}
        />
      )}
      {confirm && confirm !== 'update' && (
        <Dialog
          title={confirm === 'reboot' ? 'Restart the TV PC?' : 'Shut down?'}
          onClose={close}
          options={[
            { label: confirm === 'reboot' ? 'Restart' : 'Shut down', onSelect: () => void tv.power(confirm) },
            { label: 'Cancel', onSelect: close },
          ]}
        />
      )}
    </>
  )
}
