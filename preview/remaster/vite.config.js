import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use '/' for custom domain, or GitHub Pages path for that deployment
  base: process.env.GITHUB_PAGES ? '/remastered-punks/preview/remaster/dist/' : '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        traits: path.resolve(__dirname, 'traits.html'),
        zero: path.resolve(__dirname, 'zero.html'),
        leaks: path.resolve(__dirname, 'leaks.html'),
      },
    },
  },
  // Allow importing from the shared lib folder
  server: {
    fs: {
      allow: [
        // Allow the project root
        '.',
        // Allow the shared lib folder
        path.resolve(__dirname, '../../lib'),
      ],
    },
  },
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, '../../lib'),
    },
  },
})
