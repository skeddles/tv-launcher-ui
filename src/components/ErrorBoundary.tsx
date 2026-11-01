// Catches render errors (e.g. a bad push) and shows a friendly screen instead of
// a blank TV. A or Enter retries. Vite's own error overlay is turned off.

import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }
  private raf = 0

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[launcher] render error', error)
    this.watchForRetry()
  }

  componentWillUnmount() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.onKey)
  }

  private retry = () => {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.onKey)
    this.setState({ error: null })
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') this.retry()
  }

  // The normal input loop may be what broke, so poll the A button directly.
  private watchForRetry() {
    window.addEventListener('keydown', this.onKey)
    let wasDown = true
    const poll = () => {
      const down = Array.from(navigator.getGamepads?.() ?? []).some((p) => p?.buttons[0]?.pressed)
      if (down && !wasDown) return this.retry()
      wasDown = down
      this.raf = requestAnimationFrame(poll)
    }
    this.raf = requestAnimationFrame(poll)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash" role="alert">
        <h1>Something broke</h1>
        <p>The launcher hit an error. It usually fixes itself after the next update. Press A to try again.</p>
        <p className="muted">{this.state.error.message}</p>
        <button type="button" onClick={this.retry}>
          Try again
        </button>
      </div>
    )
  }
}
