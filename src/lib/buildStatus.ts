// Is a new system image being built? (Settings > System update)
//
// System images are built by GitHub Actions in the public tv-os repository
// (.github/workflows/build.yml). GitHub's API says whether a build is running
// but not how far along it is, so the percentage is an estimate: time since it
// started against how long recent successful builds took.

import { useEffect, useState } from 'react'

const RUNS = 'https://api.github.com/repos/skeddles/tv-os/actions/workflows/build.yml/runs?per_page=10'
const POLL_MS = 60_000 // GitHub allows 60 requests an hour without signing in
const DEFAULT_MS = 14 * 60_000

interface Run {
  status: string // queued | in_progress | completed
  conclusion: string | null // success | failure | cancelled | ...
  display_title: string // the commit message's first line
  run_started_at: string
  updated_at: string
}

export interface BuildStatus {
  building: boolean
  title: string
  startedAt: number
  expectedMs: number // typical length of a successful build
  lastFailed: boolean // the latest finished build failed
}

/** The build state from GitHub's list of runs (newest first). */
export function summarize(runs: Run[]): BuildStatus | null {
  if (!runs.length) return null
  const times = runs
    .filter((r) => r.status === 'completed' && r.conclusion === 'success')
    .slice(0, 5)
    .map((r) => Date.parse(r.updated_at) - Date.parse(r.run_started_at))
    .filter((ms) => ms > 60_000)
  const expectedMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : DEFAULT_MS
  const latest = runs[0]
  // A newer push cancels the build before it, so skip cancelled runs when judging failure.
  const lastFinished = runs.find((r) => r.status === 'completed' && r.conclusion !== 'cancelled')
  return {
    building: latest.status === 'queued' || latest.status === 'in_progress',
    title: latest.display_title,
    startedAt: Date.parse(latest.run_started_at),
    expectedMs,
    lastFailed: Boolean(lastFinished && lastFinished.conclusion !== 'success'),
  }
}

/** Estimated percent done and minutes left for a running build. */
export function estimate(b: BuildStatus, now = Date.now()) {
  const elapsed = Math.max(0, now - b.startedAt)
  return {
    percent: Math.min(99, Math.round((elapsed / b.expectedMs) * 100)),
    minutesLeft: Math.max(1, Math.ceil((b.expectedMs - elapsed) / 60_000)),
    minutesIn: Math.floor(elapsed / 60_000),
  }
}

/** Build status, refreshed every minute while the caller is on screen. */
export function useBuildStatus(): BuildStatus | null {
  const [status, setStatus] = useState<BuildStatus | null>(null)
  useEffect(() => {
    let stop = false
    const load = async () => {
      try {
        const res = await fetch(RUNS, { headers: { Accept: 'application/vnd.github+json' } })
        if (!res.ok) return
        const data = (await res.json()) as { workflow_runs: Run[] }
        if (!stop) setStatus(summarize(data.workflow_runs))
      } catch {
        /* offline: keep what we had */
      }
    }
    void load()
    const t = window.setInterval(load, POLL_MS)
    return () => {
      stop = true
      window.clearInterval(t)
    }
  }, [])
  return status
}

/** Re-render every few seconds so the estimate moves between polls. */
export function useTick(ms = 5000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return now
}
