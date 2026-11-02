import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, type Plugin, type ProxyOptions } from 'vite'
import { gamesApi } from './server/games.ts'

// TMDB (Netflix rows on Movies / TV Shows): the keys live only on the TV, in
// ~/.config/tvlauncher/tmdb.json, never in this repository. This server adds
// them to requests sent to /tmdb-api, so the page never sees them.
function tmdbSettings(): { readAccessToken?: string; region?: string } {
  try {
    return JSON.parse(readFileSync(join(homedir(), '.config/tvlauncher/tmdb.json'), 'utf8'))
  } catch {
    return {}
  }
}

const tmdb = tmdbSettings()

/** /tmdb-region: the country set in tmdb.json (404 when TMDB isn't set up). */
function tmdbRegion(): Plugin {
  const handler = (
    req: { url?: string },
    res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void },
    next: () => void,
  ) => {
    if (req.url !== '/tmdb-region') return next()
    res.statusCode = tmdb.readAccessToken ? 200 : 404
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ region: tmdb.region || 'US' }))
  }
  return {
    name: 'tmdb-region',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  }
}

// The TV runs this permanently in dev mode (`npm run dev`) so pushed changes
// hot-swap without a refresh. See README "How live updates work".
const tmdbProxy: ProxyOptions = {
  target: 'https://api.themoviedb.org',
  changeOrigin: true,
  rewrite: (p) => p.replace(/^\/tmdb-api/, '/3'),
  headers: tmdb.readAccessToken ? { Authorization: `Bearer ${tmdb.readAccessToken}` } : {},
}

export default defineConfig({
  plugins: [react(), tmdbRegion(), gamesApi()],
  // Relative asset paths so the shell can load the fallback build from disk.
  base: './',
  server: {
    host: 'localhost', // never expose the dev server to the network
    port: 5173,
    strictPort: true,
    // Flathub's API doesn't allow every request from a web page (its collection
    // lists send no CORS header), so the App Store reads it through here.
    proxy: {
      '/flathub-api': {
        target: 'https://flathub.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/flathub-api/, '/api/v2'),
      },
      '/tmdb-api': tmdbProxy,
    },
    hmr: {
      overlay: false, // a broken push must never cover the TV with Vite's error screen
    },
    watch: {
      // The update service replaces files via git; polling is not needed on a local disk.
      usePolling: false,
    },
  },
  preview: {
    // Flathub's API doesn't allow every request from a web page (its collection
    // lists send no CORS header), so the App Store reads it through here.
    proxy: {
      '/flathub-api': {
        target: 'https://flathub.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/flathub-api/, '/api/v2'),
      },
      '/tmdb-api': tmdbProxy,
    },
  },
  build: {
    outDir: 'dist',
    target: 'chrome120',
  },
})
