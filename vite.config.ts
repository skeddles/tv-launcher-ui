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
    hmr: {
      overlay: false, // a broken push must never cover the TV with Vite's error screen
    },
    watch: {
      // The update service replaces files via git; polling is not needed on a local disk.
      usePolling: false,
    },
  },
  build: {
    outDir: 'dist',
    target: 'chrome120',
  },
})
