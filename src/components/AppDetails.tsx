import { useEffect, useState } from 'react'
import { tv } from '../lib/bridge'
import { appDetails, type AppDetails as Details } from '../lib/flathub'
import { focus, pushBack, useFocused, useFocusReturn } from '../lib/focus'
import { install, uninstall, useLibrary } from '../lib/library'

function Action({ id, label, primary, onSelect }: { id: string; label: string; primary?: boolean; onSelect: () => void }) {
  const focused = useFocused(id)
  return (
    <button
      type="button"
      className={`app-details__action${primary ? ' app-details__action--primary' : ''}${focused ? ' is-focused' : ''}`}
      data-focus={id}
      data-focus-group="details"
      onClick={onSelect}
    >
      {label}
    </button>
  )
}

const mb = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`)
const count = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n))

/** An app's Flathub page, shown before installing (and for installed apps: open/remove). */
export function AppDetails({
  appId,
  name,
  icon,
  controllerPick,
  onClose,
}: {
  appId: string
  name: string
  icon?: string
  controllerPick: boolean // on the launcher's own list of controller-friendly apps
  onClose: () => void
}) {
  useFocusReturn()
  const lib = useLibrary()
  const [d, setD] = useState<Details | null>(null)
  const [failed, setFailed] = useState(false)
  const installed = lib.flatpaks.some((f) => f.appId === appId)
  const progress = lib.installing[appId]

  useEffect(() => pushBack(() => (onClose(), true)), [onClose])
  useEffect(() => {
    appDetails(appId)
      .then(setD)
      .catch(() => setFailed(true))
  }, [appId])
  useEffect(() => {
    const t = window.setTimeout(() => focus('details:main'), 60)
    return () => window.clearTimeout(t)
  }, [installed])

  const controller = controllerPick || d?.gamepad
  const facts = [
    d?.developer && `By ${d.developer}`,
    controller ? 'Works with a controller' : 'Controller support not listed (mouse mode will help)',
    d?.installsLastMonth != null && `${count(d.installsLastMonth)} installs last month`,
    d?.downloadBytes != null && `${mb(d.downloadBytes)} download`,
    d && (d.freeSoftware ? 'Free software' : 'Proprietary'),
  ].filter(Boolean) as string[]

  return (
    <div className="app-details" data-focus-scope role="dialog" aria-modal="true" aria-label={name}>
      <div className="app-details__head">
        {icon && <img className="app-details__icon" src={icon} alt="" />}
        <div>
          <h1 className="app-details__name">{d?.name ?? name}</h1>
          <p className="app-details__summary">{d?.summary ?? (failed ? "Couldn't load the details from Flathub." : 'Loading…')}</p>
          <p className="app-details__facts">
            {facts.map((f, i) => (
              <span key={i} className={i === 1 && controller ? 'app-details__good' : undefined}>
                {f}
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="app-details__actions">
        {progress != null ? (
          <Action id="details:main" label={`Installing… ${progress}%`} primary onSelect={() => {}} />
        ) : installed ? (
          <>
            <Action
              id="details:main"
              label="Open"
              primary
              onSelect={() => {
                onClose()
                void tv.launch({ kind: 'flatpak', appId }, name)
              }}
            />
            <Action id="details:remove" label="Uninstall" onSelect={() => void uninstall(appId, name)} />
          </>
        ) : (
          <Action id="details:main" label="Install" primary onSelect={() => void install(appId, name)} />
        )}
        <Action id="details:back" label="Back" onSelect={onClose} />
      </div>

      {d && d.screenshots.length > 0 && (
        <div className="app-details__shots">
          {d.screenshots.map((src) => (
            <img key={src} src={src} alt="" loading="lazy" />
          ))}
        </div>
      )}
      {d && d.description.length > 0 && (
        <div className="app-details__description">
          {d.description.slice(0, 12).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
    </div>
  )
}
