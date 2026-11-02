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
| Emulated games: systems, emulator cores, box art | `server/systems.ts`, `server/games.ts` |
| Games page rows, All games | `src/lib/games.ts`, `src/screens/Games.tsx`, `src/screens/AllGames.tsx` |

Rail tabs: **Search** (on-screen keyboard, searches everything installed),
**Home** (recent, streaming, games, apps), **Movies** and **TV Shows**
(services that carry each, plus Kodi/Jellyfin if installed), **Library**
(installed games and apps, App Store), **Settings** (accent color,
restart/shut down, versions).

## Emulated games

ROMs live on the TV in `~/Games/ROMs/<system>/` (shown on the Games page) and
`~/Games/ROMs Extra/<system>/` (only under **All games**). System folder names
are the ids in `server/systems.ts` (`nes`, `snes`, `n64`, `gb`, `gba`, `nds`,
`psx`, `ps2`, `gamecube`, `wii`, `megadrive`, `saturn`, `dreamcast`, …).
Multi-file games can sit in their own subfolder; only the `.cue`/`.m3u` shows.

Every system runs in **RetroArch** (Flatpak), started straight into the game
with `-L <core> <rom>`, so there's one controller-driven settings menu for all
of them: press **View + Menu** together in a game, or open **Emulator settings**
on the Games page. RetroArch's setup on the TV (`~/.var/app/org.libretro.RetroArch/config/retroarch/retroarch.cfg`):
BIOS files in `~/Games/BIOS`, saves in `~/Games/Saves/<system>/`, save states
in `~/Games/States/<system>/`, and a save state written automatically when a game
closes and loaded when it starts again, which is what **Continue playing** resumes.

The dev server reads the folders (`/games-api/list`), records what was played
(`~/.local/share/tvlauncher/games-played.json`) and finds box art on
[thumbnails.libretro.com](https://thumbnails.libretro.com) by file name (the
libretro-thumbnails project), cached in `~/.cache/tvlauncher/game-art/`. Art is
matched best when ROMs use No-Intro names, e.g. `Super Mario World (USA).sfc`.

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
