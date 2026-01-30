import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use '/' for custom domain, or GitHub Pages path for that deployment
  base: process.env.GITHUB_PAGES ? '/remastered-punks/preview/remaster/dist/' : '/',
  build: {
    outDir: 'dist',
  },
})
