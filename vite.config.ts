import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The TV runs this permanently in dev mode (`npm run dev`) so pushed changes
// hot-swap without a refresh. See README "How live updates work".
export default defineConfig({
  plugins: [react()],
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
    },
  },
  build: {
    outDir: 'dist',
    target: 'chrome120',
  },
})
