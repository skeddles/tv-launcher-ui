import { useCallback, useEffect, useState } from 'react'
import { Dialog } from '../components/Dialog'
import { Header } from '../components/Header'
import { accents } from '../data/catalog'
import { tv, type SystemInfo } from '../lib/bridge'
import { useFocused } from '../lib/focus'
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

type Confirm = 'reboot' | 'poweroff' | null

export function Settings() {
  const accent = usePrefs((p) => p.accent)
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const close = useCallback(() => setConfirm(null), [])

  useEffect(() => {
    tv.systemInfo().then(setInfo).catch(() => setInfo(null))
  }, [])

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
        <Item id="settings:reload" label="Reload launcher screen" onSelect={() => void tv.power('reload-ui')} />
        <Item id="settings:restart" label="Restart launcher" onSelect={() => void tv.power('restart-shell')} />
        <Item id="settings:reboot" label="Restart TV PC" onSelect={() => setConfirm('reboot')} />
        <Item id="settings:poweroff" label="Shut down" onSelect={() => setConfirm('poweroff')} />
      </div>

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

      {confirm && (
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
