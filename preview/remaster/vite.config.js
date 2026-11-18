/* global process, __dirname */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { validateNetworkEnv } from './src/lib/networkEnv.js'

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
    let rpcHost = '(public default)'
    try {
      if (env.VITE_MAINNET_RPC_URL) rpcHost = new URL(env.VITE_MAINNET_RPC_URL).host
    } catch { /* validated above in mainnet mode; ignore otherwise */ }
    const network = env.VITE_NETWORK || 'sepolia'
    console.log(
      `[network] mode=${network} vercelEnv=${process.env.VERCEL_ENV || 'n/a'} address=${network === 'mainnet' ? env.VITE_REMASTERED_PUNKS_MAINNET : 'n/a'} rpc=${rpcHost}`
    )
  }

  return {
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
