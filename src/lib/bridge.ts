// The contract between this UI and the Electron shell (tv-os/shell/preload.cjs).
// The shell exposes `window.tv`; when the UI runs in a normal browser (for
// development on another computer) a mock stands in so every screen still works.

export type LaunchTarget =
  | { kind: 'web'; url: string; userAgent?: string }
  | { kind: 'chrome'; url: string }
  | { kind: 'flatpak'; appId: string; args?: string[] }
  | { kind: 'steam'; appId: string }
  | { kind: 'steam-bigpicture' }

export interface InstalledFlatpak {
  appId: string
  name: string
  icon?: string // URL the shell serves
}

export interface SteamGame {
  appId: string
  name: string
  image?: string
}

export interface StoreApp {
  appId: string
  name: string
  summary: string
  icon?: string
  gamepad: boolean // AppStream says it supports a gamepad
  installed: boolean
}

export interface SystemInfo {
  shellVersion: string
  electron: string
  chrome: string
  hostname: string
  uiCommit: string
  uiSource: 'dev-server' | 'fallback-build' | 'browser'
  imageVersion: string
}

export type ShellEvent =
  | { type: 'app-exited'; label: string }
  | { type: 'web-closed' }
  | { type: 'install-progress'; appId: string; percent: number }
  | { type: 'notice'; message: string }
  // In mouse mode the controller's Y asks for the keyboard to type into another app.
  | { type: 'keyboard-request'; label: string; password?: boolean }
  | { type: 'keyboard-closed' }
  | { type: 'mouse-mode'; on: boolean; label: string | null }
  | { type: 'volume'; volume: number | null; muted: boolean }
  // Xbox button during a Steam game (or Big Picture): it's still running behind the launcher.
  | { type: 'app-running'; label: string; quitLabel: string }
  | { type: 'steam-closed'; label: string }
  | { type: 'os-update'; state: OsUpdateState }

export interface OsUpdateState {
  // unknown: not checked yet · busy: an update started elsewhere (e.g. Bazzite's daily one) is running
  phase: 'unknown' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'busy' | 'error'
  percent: number | null
  doneMB: number
  totalMB: number
  message: string | null
}

export interface DisplaySettings {
  scale: number // how big other apps look; the launcher itself stays the same
  scales: number[]
}

export interface TvBridge {
  listFlatpaks(): Promise<InstalledFlatpak[]>
  listSteamGames(): Promise<SteamGame[]>
  launch(target: LaunchTarget, label: string): Promise<void>
  storeSearch(query: string): Promise<StoreApp[]>
  storeDetails(appIds: string[]): Promise<StoreApp[]>
  storeInstall(appId: string): Promise<{ ok: boolean; error?: string }>
  storeUninstall(appId: string): Promise<{ ok: boolean; error?: string }>
  systemInfo(): Promise<SystemInfo>
  power(action: 'reboot' | 'poweroff' | 'restart-shell' | 'reload-ui'): Promise<void>
  /** Close the keyboard and type the text into the app that asked (optionally pressing Enter). */
  typeText(text: string, enter: boolean): Promise<void>
  cancelTyping(): Promise<void>
  getDisplay(): Promise<DisplaySettings>
  setDisplay(opts: { scale: number }): Promise<{ scale: number }>
  /** Forget per-app mouse mode choices. */
  resetInputPrefs(): Promise<void>
  /** Go back to the Steam game left running behind the launcher. False if it has closed. */
  resumeApp(): Promise<boolean>
  /** Quit that game (or close Steam for Big Picture). */
  quitApp(): Promise<boolean>
  /** System image update: current state, check for one, download one (applies at next start). */
  osUpdateStatus(): Promise<OsUpdateState>
  osUpdateCheck(): Promise<OsUpdateState>
  osUpdateDownload(): Promise<OsUpdateState>
  /** A new one-time code for connecting Claude to this PC, and the connector URL to add in Claude. */
  newPairingCode(): Promise<{ code: string; url: string | null }>
  /** System volume in percent (null if unknown). */
  getVolume(): Promise<{ volume: number | null; muted: boolean }>
  /** One 5% step up (+1) or down (-1). */
  changeVolume(step: 1 | -1): Promise<{ volume: number | null; muted: boolean }>
  onEvent(cb: (e: ShellEvent) => void): () => void
}

declare global {
  interface Window {
    tv?: TvBridge
  }
}

const mockListeners = new Set<(e: ShellEvent) => void>()
let mockScale = 1.5
let mockVolume = 100
let mockOs: OsUpdateState = { phase: 'unknown', percent: null, doneMB: 0, totalMB: 0, message: null }
const setMockOs = (patch: Partial<OsUpdateState>) => {
  mockOs = { ...mockOs, ...patch }
  mockListeners.forEach((cb) => cb({ type: 'os-update', state: mockOs }))
  return mockOs
}

// Dev helpers: in a browser, `__tvMock.keyboard('Firefox')` opens the typing screen,
// `__tvMock.running()` the dialog shown when the Xbox button leaves a Steam game running.
;(window as unknown as { __tvMock: unknown }).__tvMock = {
  keyboard: (label = 'Firefox', password = false) =>
    mockListeners.forEach((cb) => cb({ type: 'keyboard-request', label, password })),
  running: (label = 'Castle Crashers', quitLabel = 'Quit game') =>
    mockListeners.forEach((cb) => cb({ type: 'app-running', label, quitLabel })),
}

const mock: TvBridge = {
  async listFlatpaks() {
    return [
      { appId: 'tv.plex.PlexHTPC', name: 'Plex HTPC' },
      { appId: 'com.google.Chrome', name: 'Google Chrome' },
    ]
  },
  async listSteamGames() {
    return [
      { appId: '413150', name: 'Stardew Valley' },
      { appId: '367520', name: 'Hollow Knight' },
      { appId: '1145360', name: 'Hades' },
    ]
  },
  async launch(target, label) {
    console.info('[mock] launch', label, target)
    mockListeners.forEach((cb) => cb({ type: 'notice', message: `Would open ${label}` }))
  },
  async storeSearch(query) {
    const q = query.toLowerCase()
    const all: StoreApp[] = [
      { appId: 'org.libretro.RetroArch', name: 'RetroArch', summary: 'Frontend for emulators, game engines and media players', gamepad: true, installed: false },
      { appId: 'tv.kodi.Kodi', name: 'Kodi', summary: 'Ultimate entertainment center', gamepad: true, installed: false },
      { appId: 'org.gimp.GIMP', name: 'GIMP', summary: 'Create images and edit photographs', gamepad: false, installed: false },
    ]
    return all.filter((a) => a.name.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q))
  },
  async storeDetails(appIds) {
    return appIds.map((appId) => ({ appId, name: appId.split('.').pop() ?? appId, summary: '', gamepad: true, installed: false }))
  },
  async storeInstall(appId) {
    for (let p = 0; p <= 100; p += 20) {
      await new Promise((r) => setTimeout(r, 300))
      mockListeners.forEach((cb) => cb({ type: 'install-progress', appId, percent: p }))
    }
    return { ok: true }
  },
  async storeUninstall() {
    return { ok: true }
  },
  async systemInfo() {
    return {
      shellVersion: 'browser',
      electron: '-',
      chrome: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? '-',
      hostname: location.hostname,
      uiCommit: import.meta.env.VITE_UI_COMMIT ?? 'dev',
      uiSource: 'browser',
      imageVersion: '-',
    }
  },
  async power(action) {
    console.info('[mock] power', action)
    if (action === 'reload-ui') location.reload()
  },
  async typeText(text, enter) {
    console.info('[mock] type into app:', JSON.stringify(text), enter ? '+ Enter' : '')
    mockListeners.forEach((cb) => cb({ type: 'keyboard-closed' }))
  },
  async cancelTyping() {
    mockListeners.forEach((cb) => cb({ type: 'keyboard-closed' }))
  },
  async getDisplay() {
    return { scale: mockScale, scales: [1, 1.25, 1.5, 1.75, 2] }
  },
  async setDisplay({ scale }) {
    mockScale = scale
    return { scale }
  },
  async resetInputPrefs() {},
  async resumeApp() {
    console.info('[mock] resume app')
    return true
  },
  async newPairingCode() {
    return { code: 'K7QX-4MZP-H9RA', url: 'https://tv-pc.example.ts.net/mcp' }
  },
  async osUpdateStatus() {
    return mockOs
  },
  async osUpdateCheck() {
    setMockOs({ phase: 'checking' })
    setTimeout(() => setMockOs({ phase: 'available', totalMB: 912.2 }), 800)
    return mockOs
  },
  async osUpdateDownload() {
    let done = 0
    setMockOs({ phase: 'downloading', percent: 0, doneMB: 0 })
    const t = setInterval(() => {
      done = Math.min(912.2, done + 120)
      if (done >= 912.2) {
        clearInterval(t)
        setMockOs({ phase: 'ready', percent: 100, doneMB: done })
      } else setMockOs({ percent: Math.floor((done / 912.2) * 100), doneMB: done })
    }, 400)
    return mockOs
  },
  async quitApp() {
    console.info('[mock] quit app')
    mockListeners.forEach((cb) => cb({ type: 'steam-closed', label: 'game' }))
    return true
  },
  async getVolume() {
    return { volume: mockVolume, muted: false }
  },
  async changeVolume(step) {
    mockVolume = Math.max(0, Math.min(100, mockVolume + step * 5))
    mockListeners.forEach((cb) => cb({ type: 'volume', volume: mockVolume, muted: false }))
    return { volume: mockVolume, muted: false }
  },
  onEvent(cb) {
    mockListeners.add(cb)
    return () => mockListeners.delete(cb)
  },
}

export const tv: TvBridge = window.tv ?? mock
export const inShell = Boolean(window.tv)
