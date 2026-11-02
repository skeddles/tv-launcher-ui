// Stroke icons from the TV Launcher design.
const paths = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-5-5',
  home: 'M3 11l9-7 9 7 M5 10v10h14V10',
  movies: 'M4 5h16v14H4z M8 5v14 M16 5v14 M4 12h16',
  tv: 'M3 7h18v12H3z M8 3l4 4 4-4',
  library: 'M5 4v16 M10 4v16 M15 5l4 15',
  apps: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1',
  store: 'M4 7h16l-1 13H5z M9 7a3 3 0 0 1 6 0',
  backspace: 'M9 5h11v14H9l-6-7z M12 9l5 6 M17 9l-5 6',
  shift: 'M12 4l8 8h-5v8H9v-8H4z',
  // Settings tiles
  undo: 'M9 14L4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  gamepad:
    'M7 8h10a5 5 0 0 1 5 5v1.5a2.5 2.5 0 0 1-4.6 1.4L16 14H8l-1.4 1.9A2.5 2.5 0 0 1 2 14.5V13a5 5 0 0 1 5-5z M7.5 10.5v3 M6 12h3 M15.5 11h.01 M17.5 13h.01',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7 M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v5 M12 8h.01',
  reload: 'M20 12a8 8 0 1 1-2.3-5.7 M20 4v5h-5',
  relaunch: 'M4 12a8 8 0 1 0 2.3-5.7 M4 4v5h5 M10 9.5v5l4-2.5z',
  restart: 'M12 4v6 M7.8 6.6a7 7 0 1 0 8.4 0 M19 3v4h-4',
  power: 'M12 3v9 M6.3 6.3a8 8 0 1 0 11.4 0',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 26 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
