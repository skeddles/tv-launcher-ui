# Working on the TV (rules for Claude sessions)

The full rules are in skeddles/tv-os `CLAUDE.md`; read them before using the
"TV PC" connector. The ones that matter most:

- Check `tv_screen` before touching the TV; ask before taking over the screen.
- Start and stop apps only through the launcher (`tv_open`, `tv_close_app`).
  Never start an app, game or Steam window directly with `run_command`: the
  launcher keeps reading the controller and acts on the same presses behind it
  (Nov 4 2026: a hand-opened Big Picture led to Mario Kart starting).
- Never restart the Cage session; to restart the launcher only kill Electron
  (`pkill -9 -f "^/usr/lib/tvlauncher/electron/electron"`).
- Never put secrets in this repo (TMDB keys stay in `~/.config/tvlauncher/tmdb.json`
  on the TV).
- Pushes to `main` go live on the TV after CI. Code style: `.prettierrc.json`
  (single quotes, no semicolons, width 140); check with `npx tsc -b` and `npx oxlint`.
