// Which Steam games are still downloading (from the launcher's server, which
// reads Steam's library files: server/steam.ts).

export interface SteamState {
  ready: boolean
  percent: number | null
}

export async function steamStates(): Promise<Record<string, SteamState>> {
  try {
    const r = await fetch('/steam-api/state', { cache: 'no-store' })
    return r.ok ? ((await r.json()) as Record<string, SteamState>) : {}
  } catch {
    return {} // the fallback build has no server: treat every game as ready
  }
}
