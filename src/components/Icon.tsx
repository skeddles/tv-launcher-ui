// Stroke icons from the TV Launcher design.
const paths = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-5-5',
  home: 'M3 11l9-7 9 7 M5 10v10h14V10',
  movies: 'M4 5h16v14H4z M8 5v14 M16 5v14 M4 12h16',
  tv: 'M3 7h18v12H3z M8 3l4 4 4-4',
  library: 'M5 4v16 M10 4v16 M15 5l4 15',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1',
  store: 'M4 7h16l-1 13H5z M9 7a3 3 0 0 1 6 0',
  backspace: 'M9 5h11v14H9l-6-7z M12 9l5 6 M17 9l-5 6',
  shift: 'M12 4l8 8h-5v8H9v-8H4z',
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
