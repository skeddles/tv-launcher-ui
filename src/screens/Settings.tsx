import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Adjust } from '../components/Adjust'
import { BackgroundPicker } from '../components/BackgroundPicker'
import { Dialog } from '../components/Dialog'
import { Header } from '../components/Header'
import { Row } from '../components/Row'
import { SettingTile } from '../components/SettingTile'
import { accents } from '../data/catalog'
import { tv, type DisplaySettings, type OsUpdateState, type PointerSettings, type SystemInfo } from '../lib/bridge'
import { notify } from '../lib/library'
import { estimate, useBuildStatus, useTick } from '../lib/buildStatus'
import { copyText } from '../lib/pointer'
import { BACKGROUNDS, setPrefs, TILE_SIZES, usePrefs } from '../lib/prefs'

type Confirm = 'reboot' | 'poweroff' | 'update' | null
type Adjusting = 'volume' | 'appSize' | 'tileSize' | 'accent' | 'background' | 'pointerSpeed' | 'pointerSize' | null
type Info = 'guide' | 'about' | 'build' | null

const mbText = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} GB` : `${Math.round(n)} MB`)

const SPEED_NAMES: Record<number, string> = { 0.5: 'Slowest', 0.75: 'Slow', 1: 'Normal', 1.5: 'Fast', 2: 'Fastest' }
const SIZE_NAMES: Record<number, string> = { 24: 'Small', 32: 'Medium', 48: 'Large', 64: 'Extra large' }
const NEEDS_UPDATE = 'Needs the next system update (Settings > System update)'

/** The next value in `list` from `current` in direction `dir`, stopping at the ends. */
function step<T>(list: T[], current: T, dir: -1 | 1): T {
  const i = list.indexOf(current)
  return list[Math.max(0, Math.min(list.length - 1, (i < 0 ? 0 : i) + dir))]
}

/** What the System update tile shows. */
function osUpdateValue(u: OsUpdateState | null): ReactNode {
  if (!u) return '…'
  switch (u.phase) {
    case 'checking':
      return 'Checking…'
    case 'up-to-date':
      return 'Up to date'
    case 'available':
      return u.totalMB ? `New · ${mbText(u.totalMB)}` : 'Update available'
    case 'downloading':
      return (
        <span className="setting-tile__progress" aria-label={`Downloading ${u.percent ?? 0}%`}>
          <span>{u.message ?? (u.percent == null ? 'Starting…' : `${u.percent}%`)}</span>
          <span className="volume__bar" aria-hidden="true">
            <span className="volume__fill" style={{ width: `${u.percent ?? 0}%` }} />
          </span>
        </span>
      )
    case 'ready':
      return 'Ready'
    case 'busy':
      return 'Updating…'
    case 'error':
      return "Couldn't update"
    default:
      return 'Check'
  }
}

function Swatches({ accent }: { accent: string }) {
  return (
    <span className="swatches" aria-label={`Current ${accent}`}>
      {accents.map((c) => (
        <span key={c} className={`swatch${c === accent ? ' swatch--on' : ''}`} style={{ background: c }} />
      ))}
    </span>
  )
}

export function Settings() {
  const accent = usePrefs((p) => p.accent)
  const tileColumns = usePrefs((p) => p.tileColumns)
  const background = usePrefs((p) => p.background)
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [adjusting, setAdjusting] = useState<Adjusting>(null)
  const [showInfo, setShowInfo] = useState<Info>(null)
  const [disp, setDisp] = useState<DisplaySettings | null>(null)
  const [volume, setVolume] = useState<number | null>(null)
  const [pointer, setPointer] = useState<PointerSettings | null>(null)
  const [osUpdate, setOsUpdate] = useState<OsUpdateState | null>(null)
  const build = useBuildStatus()
  const now = useTick()
  const [pairing, setPairing] = useState<{ code: string; url: string | null } | null>(null)
  const closePairing = useCallback(() => setPairing(null), [])
  const close = useCallback(() => setConfirm(null), [])
  const closeAdjust = useCallback(() => setAdjusting(null), [])
  const closeInfo = useCallback(() => setShowInfo(null), [])

  useEffect(() => {
    tv.systemInfo()
      .then(setInfo)
      .catch(() => setInfo(null))
    tv.getDisplay()
      .then(setDisp)
      .catch(() => setDisp(null))
    tv.getVolume()
      .then((v) => setVolume(v.volume))
      .catch(() => setVolume(null))
    tv.osUpdateStatus()
      .then(setOsUpdate)
      .catch(() => setOsUpdate(null))
    tv.getPointer?.()
      .then(setPointer)
      .catch(() => setPointer(null))
    return tv.onEvent((e) => {
      if (e.type === 'volume') setVolume(e.volume)
      if (e.type === 'os-update') setOsUpdate(e.state)
    })
  }, [])

  const stepAdjust = useCallback(
    (dir: -1 | 1) => {
      switch (adjusting) {
        case 'volume':
          void tv.changeVolume(dir)
          break
        case 'appSize': {
          if (!disp) return
          const next = step(disp.scales, disp.scale, dir)
          setDisp({ ...disp, scale: next })
          tv.setDisplay({ scale: next }).catch(() => notify("Couldn't change the app size"))
          break
        }
        case 'tileSize':
          // Left = smaller tiles (more per row)
          setPrefs({ tileColumns: step(TILE_SIZES, TILE_SIZES.find((t) => t.columns === tileColumns) ?? TILE_SIZES[1], dir).columns })
          break
        case 'accent':
          setPrefs({ accent: accents[(accents.indexOf(accent) + dir + accents.length) % accents.length] })
          break
        case 'pointerSpeed':
        case 'pointerSize': {
          if (!pointer || !tv.setPointer) return
          const patch =
            adjusting === 'pointerSpeed'
              ? { speed: step(pointer.speeds, pointer.speed, dir) }
              : { size: step(pointer.sizes, pointer.size, dir) }
          setPointer({ ...pointer, ...patch })
          tv.setPointer(patch)
            .then(setPointer)
            .catch(() => notify("Couldn't change the pointer"))
          break
        }
      }
    },
    [adjusting, disp, tileColumns, accent, pointer],
  )

  const adjust = (what: Exclude<Adjusting, null>) => {
    if ((what === 'pointerSpeed' || what === 'pointerSize') && !pointer) return notify(NEEDS_UPDATE)
    setAdjusting(what)
  }

  // The PC's own update (rpm-ostree) comes first; otherwise show a build in progress on GitHub.
  const idlePhase = !osUpdate || ['unknown', 'up-to-date', 'error'].includes(osUpdate.phase)
  const buildShown = idlePhase && build?.building
  const buildEta = build ? estimate(build, now) : null

  const updateTileValue = buildShown ? (
    <span className="setting-tile__progress" aria-label={`Building ${buildEta?.percent ?? 0}%`}>
      <span>Building · {buildEta?.percent ?? 0}%</span>
      <span className="volume__bar" aria-hidden="true">
        <span className="volume__fill" style={{ width: `${buildEta?.percent ?? 0}%` }} />
      </span>
    </span>
  ) : idlePhase && build?.lastFailed && osUpdate?.phase !== 'error' ? (
    'Build failed'
  ) : (
    osUpdateValue(osUpdate)
  )

  const updateAction = () => {
    if (buildShown || (idlePhase && build?.lastFailed)) return setShowInfo('build')
    const phase = osUpdate?.phase ?? 'unknown'
    if (phase === 'available') void tv.osUpdateDownload().then(setOsUpdate)
    else if (phase === 'ready') setConfirm('update')
    else if (phase === 'unknown' || phase === 'up-to-date' || phase === 'error') void tv.osUpdateCheck().then(setOsUpdate)
  }

  const connectClaude = () =>
    // The screens update live; the shell side can arrive later with a system update.
    typeof tv.newPairingCode !== 'function'
      ? notify(NEEDS_UPDATE)
      : void tv
          .newPairingCode()
          .then(setPairing)
          .catch((e: unknown) => notify(e instanceof Error ? e.message.replace(/^.*Error: /, '') : "Couldn't make a pairing code"))

  const backgroundName = (
    <span className="bg-value">
      <span className="bg-value__swatch" style={{ background }} />
      {BACKGROUNDS.find((b) => b.color.toUpperCase() === background.toUpperCase())?.label ?? 'Custom'}
    </span>
  )
  const tileSizeName = TILE_SIZES.find((t) => t.columns === tileColumns)?.label ?? 'Medium'
  const appSize = disp ? `${Math.round(disp.scale * 100)}%` : '…'
  const speedName = pointer ? (SPEED_NAMES[pointer.speed] ?? `${pointer.speed}×`) : '—'
  const sizeName = pointer ? (SIZE_NAMES[pointer.size] ?? `${pointer.size}px`) : '—'

  return (
    <>
      <Header title="Settings" />

      <Row first title="Picture & sound" count={5}>
        <SettingTile
          id="settings:volume"
          isDefault
          label="Volume"
          value={volume == null ? '…' : `${volume}%`}
          onSelect={() => adjust('volume')}
        />
        <SettingTile id="settings:scale" label="App size" value={appSize} onSelect={() => adjust('appSize')} />
        <SettingTile id="settings:tiles" label="Tile size" value={tileSizeName} onSelect={() => adjust('tileSize')} />
        <SettingTile id="settings:accent" label="Accent color" value={<Swatches accent={accent} />} onSelect={() => adjust('accent')} />
        <SettingTile id="settings:background" label="Background color" value={backgroundName} onSelect={() => adjust('background')} />
      </Row>

      <Row title="Controller & mouse" count={4}>
        <SettingTile id="settings:pointer-speed" label="Pointer speed" value={speedName} onSelect={() => adjust('pointerSpeed')} />
        <SettingTile id="settings:pointer-size" label="Pointer size" value={sizeName} onSelect={() => adjust('pointerSize')} />
        <SettingTile
          id="settings:mouse-reset"
          icon="undo"
          label="Forget mouse mode choices"
          onSelect={() => {
            void tv.resetInputPrefs()
            notify('Mouse mode will decide automatically again for every app')
          }}
        />
        <SettingTile id="settings:guide" icon="gamepad" label="Controller guide" onSelect={() => setShowInfo('guide')} />
      </Row>

      <Row title="System" count={7}>
        <SettingTile id="settings:update" label="System update" value={updateTileValue} onSelect={updateAction} />
        <SettingTile id="settings:claude" icon="link" label="Connect Claude" onSelect={connectClaude} />
        <SettingTile id="settings:about" icon="info" label="About" onSelect={() => setShowInfo('about')} />
        <SettingTile id="settings:reload" icon="reload" label="Reload launcher screen" onSelect={() => void tv.power('reload-ui')} />
        <SettingTile id="settings:restart" icon="relaunch" label="Restart launcher" onSelect={() => void tv.power('restart-shell')} />
        <SettingTile id="settings:reboot" icon="restart" label="Restart TV PC" onSelect={() => setConfirm('reboot')} />
        <SettingTile id="settings:poweroff" icon="power" label="Shut down" onSelect={() => setConfirm('poweroff')} />
      </Row>

      {adjusting === 'volume' && (
        <Adjust title="Volume" value={volume == null ? '…' : `${volume}%`} onStep={stepAdjust} onClose={closeAdjust} />
      )}
      {adjusting === 'appSize' && (
        <Adjust
          title="App size"
          hint="How big other apps and the pointer look. The launcher stays the same."
          value={appSize}
          onStep={stepAdjust}
          onClose={closeAdjust}
        />
      )}
      {adjusting === 'tileSize' && (
        <Adjust
          title="Tile size"
          hint="How big the tiles are on every screen."
          value={`${tileSizeName} · ${tileColumns} per row`}
          onStep={stepAdjust}
          onClose={closeAdjust}
        />
      )}
      {adjusting === 'accent' && (
        <Adjust title="Accent color" value={<Swatches accent={accent} />} onStep={stepAdjust} onClose={closeAdjust} />
      )}
      {adjusting === 'background' && <BackgroundPicker onClose={closeAdjust} />}
      {adjusting === 'pointerSpeed' && (
        <Adjust
          title="Pointer speed"
          hint="How fast the controller's stick moves the pointer in mouse mode. (A USB mouse's speed can't be changed here.)"
          value={speedName}
          onStep={stepAdjust}
          onClose={closeAdjust}
        />
      )}
      {adjusting === 'pointerSize' && (
        <Adjust
          title="Pointer size"
          hint="Applies to apps opened after the change; App size makes it bigger again."
          value={sizeName}
          onStep={stepAdjust}
          onClose={closeAdjust}
        />
      )}

      {showInfo === 'guide' && (
        <Dialog title="Controller guide" onClose={closeInfo} options={[{ label: 'Done', onSelect: closeInfo }]}>
          <p className="muted">
            In apps that don't read the controller, mouse mode turns on by itself. Hold the Xbox button for a second to turn it on or off
            for the app you're in; that choice is remembered.
          </p>
          <dl className="info-grid info-grid--dialog">
            <dt>Xbox button</dt>
            <dd>Back to Home (hold: mouse mode on/off)</dd>
            <dt>Left stick</dt>
            <dd>Move the pointer (hold RT for slow and precise)</dd>
            <dt>Right stick</dt>
            <dd>Scroll</dd>
            <dt>A / B</dt>
            <dd>Click / right-click (after using the D-pad: Enter / Back)</dd>
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
            <dt>Menu ☰ on a tile</dt>
            <dd>Tile options (hide its name, remove from Recently Opened)</dd>
            <dt>View + D-pad ↑↓</dt>
            <dd>Volume (anywhere, also in the launcher)</dd>
          </dl>
        </Dialog>
      )}
      {showInfo === 'build' && build && (
        <Dialog
          title={build.building ? 'An update is being built' : 'The last update build failed'}
          message={
            build.building
              ? `GitHub is building a new system image with: “${build.title}”. Started ${buildEta?.minutesIn ?? 0} min ago; about ${buildEta?.minutesLeft ?? '?'} min left (an estimate from recent builds). When it's done, check for updates here.`
              : `GitHub couldn't build the newest system image (“${build.title}”). Your PC keeps the system it has; ask Claude to look at the build.`
          }
          onClose={closeInfo}
          options={[
            {
              label: 'Check for updates now',
              onSelect: () => {
                closeInfo()
                void tv.osUpdateCheck().then(setOsUpdate)
              },
            },
            { label: 'OK', onSelect: closeInfo },
          ]}
        />
      )}
      {showInfo === 'about' && (
        <Dialog title="About" onClose={closeInfo} options={[{ label: 'Done', onSelect: closeInfo }]}>
          {info ? (
            <dl className="info-grid info-grid--dialog">
              <dt>Name</dt>
              <dd>{info.hostname}</dd>
              <dt>UI version</dt>
              <dd>{info.uiCommit}</dd>
              <dt>UI source</dt>
              <dd>
                {info.uiSource === 'dev-server'
                  ? 'Live (updates automatically)'
                  : info.uiSource === 'fallback-build'
                    ? 'Backup copy (live server not running)'
                    : 'Browser'}
              </dd>
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
        </Dialog>
      )}

      {pairing && (
        <Dialog
          title="Connect Claude"
          message={`In claude.ai: Settings > Connectors > connect TV PC${pairing.url ? ` (or Add custom connector with ${pairing.url})` : ''}. On the page that opens, type this code and approve. It works once, within 7 days; showing a new one cancels this one.`}
          onClose={closePairing}
          options={[
            {
              label: 'Copy code',
              onSelect: () => void copyText(pairing.code).then((ok) => notify(ok ? 'Code copied' : "Couldn't copy; type the code instead")),
            },
            { label: 'Done', onSelect: closePairing },
          ]}
        >
          <code className="pairing-code">{pairing.code}</code>
        </Dialog>
      )}
      {confirm === 'update' && (
        <Dialog
          title="Finish the update?"
          message="The PC shuts down. Then press its power button: it starts with the new system. (A full shutdown keeps the TV picture from getting stuck.)"
          onClose={close}
          options={[
            { label: 'Shut down now', onSelect: () => void tv.power('poweroff') },
            {
              label: 'Check for a newer update first',
              onSelect: () => {
                close()
                void tv.osUpdateCheck().then(setOsUpdate)
              },
            },
            { label: 'Later', onSelect: close },
          ]}
        />
      )}
      {(confirm === 'reboot' || confirm === 'poweroff') && (
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
