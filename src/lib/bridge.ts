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
  onEvent(cb: (e: ShellEvent) => void): () => void
}

declare global {
  interface Window {
    tv?: TvBridge
  }
}

const mockListeners = new Set<(e: ShellEvent) => void>()
let mockScale = 1.5

// Dev helper: in a browser, `__tvMock.keyboard('Firefox')` opens the typing screen.
;(window as unknown as { __tvMock: unknown }).__tvMock = {
  keyboard: (label = 'Firefox', password = false) =>
    mockListeners.forEach((cb) => cb({ type: 'keyboard-request', label, password })),
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
  onEvent(cb) {
    mockListeners.add(cb)
    return () => mockListeners.delete(cb)
  },
}

export const tv: TvBridge = window.tv ?? mock
export const inShell = Boolean(window.tv)
