/* global process, __dirname */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { PUBLIC_DATA_FILES } from '../../scripts/build-public-data.mjs'
import { validateNetworkEnv } from './src/lib/networkEnv.js'

// First 10 hex chars of a sha256 over every public data file. Appended to /data fetches
// as ?v= (see src/lib/dataUrl.js) so the long Cache-Control on /data/* is safe.
function dataVersion() {
  const h = crypto.createHash('sha256')
  for (const f of PUBLIC_DATA_FILES) {
    h.update(f)
    h.update(fs.readFileSync(path.resolve(__dirname, '../../data', f)))
  }
  return h.digest('hex').slice(0, 10)
}

// Preload the critical data files from the HTML so they start at the same time as the
// entry script. URLs must match dataUrl() byte for byte or the browser fetches twice.
function preloadData(version) {
  const v = `?v=${version}`
  return {
    name: 'preload-critical-data',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.filename.endsWith(`${path.sep}index.html`)) return
        return [
          { tag: 'link', attrs: { rel: 'preload', as: 'image', href: `/data/cryptopunks-assets/punks/config/punks-24x24.png${v}` }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'preload', as: 'fetch', crossorigin: '', href: `/data/punks-compact.json${v}` }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'preload', as: 'fetch', crossorigin: '', href: `/data/all-eligible-punks.json${v}` }, injectTo: 'head' },
        ]
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Merges .env* files with process.env VITE_* (which is how Vercel vars arrive).
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  if (command === 'build') {
    const errors = validateNetworkEnv(env, { vercelEnv: process.env.VERCEL_ENV })
    if (errors.length) {
      throw new Error(`[network] invalid build config:\n  - ${errors.join('\n  - ')}`)
    }
    // Never log the full RPC URL: it contains the API key.
    let rpcHost = '(publicnode → drpc)'
    try {
      if (env.VITE_MAINNET_RPC_URL) rpcHost = new URL(env.VITE_MAINNET_RPC_URL).host
    } catch { /* validated above in mainnet mode; ignore otherwise */ }
    const network = env.VITE_NETWORK || 'sepolia'
    console.log(
      `[network] mode=${network} vercelEnv=${process.env.VERCEL_ENV || 'n/a'} address=${network === 'mainnet' ? env.VITE_REMASTERED_PUNKS_MAINNET : 'n/a'} rpc=${rpcHost}`
    )
  }

  const version = dataVersion()

  return {
    plugins: [react(), preloadData(version)],
    define: { __DATA_VERSION__: JSON.stringify(version) },
    // Use '/' for custom domain, or GitHub Pages path for that deployment
    base: process.env.GITHUB_PAGES ? '/remastered-punks/preview/remaster/dist/' : '/',
    build: {
      outDir: 'dist',
      rollupOptions: {
        output: {
          // Keep react in its own long-cached chunk. The wallet stack is split off by the
          // dynamic import in App.jsx (src/wallet/WalletIslands.jsx); do NOT group it with
          // manualChunks: that merges RainbowKit's lazily-imported locales/icons/connectors
          // (2.9 MB) into one chunk. node_modules only, so lazy app code is never pulled in.
          manualChunks(id) {
            // Rollup's tiny shared helpers must live in the eager vendor-react chunk, else the
            // entry would import them from vendor-wallet and drag it into the first load.
            if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'vendor-react'
            if (!id.includes('node_modules')) return undefined
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react'
            return undefined
          },
        },
        input: {
          main: path.resolve(__dirname, 'index.html'),
          traits: path.resolve(__dirname, 'traits.html'),
          zero: path.resolve(__dirname, 'zero.html'),
          leaks: path.resolve(__dirname, 'leaks.html'),
          remasterSprites: path.resolve(__dirname, 'remaster-sprites.html'),
          stackingCompare: path.resolve(__dirname, 'stacking-compare.html'),
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
  }
})
