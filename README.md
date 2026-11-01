# tv-launcher-ui

The home screen for the TV PC: a dark, Roku-style launcher with a slim icon rail
and rows of 16:9 tiles, driven entirely by an Xbox controller.

It runs inside the Electron shell from [tv-os](https://github.com/skeddles/tv-os),
permanently in Vite dev mode, so changes pushed here appear on the TV within
seconds without a refresh.

## How live updates work

1. Push to `main`.
2. GitHub Actions runs `npm run lint` and `npm run build`. If both pass, it moves
   the `tv` branch to that commit. A failing commit never reaches the TV.
3. On the TV, `tvlauncher-ui-update` pulls `tv` every few seconds.
4. Vite sees the changed files and hot-swaps them: CSS instantly; React
   components keep their state. Changes Fast Refresh can't handle cause a full
   reload, which still lands you on the same screen and tile (see `src/lib/place.ts`).

Vite's error overlay is off, and a React error boundary shows a "Something
broke" screen with a retry instead of a blank TV.

## Controls

| Controller | Keyboard | Does |
|---|---|---|
| D-pad / left stick | Arrow keys | Move the highlight |
| A | Enter | Open |
| B | Escape / Backspace | Back: tiles → rail → Home |
| X | | Delete (on-screen keyboard) |
| Y | | Jump to Search |

## Where things live

| Want to change | File |
|---|---|
| Colors, spacing, sizes (design tokens) | `src/styles/tokens.css` |
| Layout and component styles | `src/styles/app.css` |
| Streaming services, controller-friendly app list | `src/data/catalog.ts` |
| What each rail tab shows | `src/screens/*.tsx` |
| Controller mapping | `src/lib/input.ts` |
| D-pad navigation | `src/lib/focus.ts` |
| What the UI can ask the shell to do | `src/lib/bridge.ts` (implemented in `tv-os/shell/`) |

Rail tabs: **Search** (on-screen keyboard, searches everything installed),
**Home** (recent, streaming, games, apps), **Movies** and **TV Shows**
(services that carry each, plus Kodi/Jellyfin if installed), **Library**
(installed games and apps, App Store), **Settings** (accent color,
restart/shut down, versions).

## Developing on another computer

```sh
npm install
npm run dev   # http://localhost:5173, 1920x1080 browser window
```

Outside the shell, `window.tv` is replaced by a mock so every screen works.
Use the arrow keys, Enter and Escape, or plug in a controller.

Any element with `data-focus="unique-id"` takes part in D-pad navigation; see the
top of `src/lib/focus.ts`.

The design is fixed at 1920×1080 to match the TV.
