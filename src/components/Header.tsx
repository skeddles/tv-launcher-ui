import { useEffect, useState } from 'react'

const fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5000)
    return () => clearInterval(t)
  }, [])
  return fmt.format(now)
}

export function Header({ title }: { title: string }) {
  const time = useClock()
  return (
    <header className="header">
      <h1 className="header__title">{title}</h1>
      <span className="header__clock">{time}</span>
    </header>
  )
}
