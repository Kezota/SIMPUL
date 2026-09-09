import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

/**
 * Endpoint kompetisi MAPID (Activities) menolak permintaan yang membawa header
 * `Origin` — "server-to-server only". Saat dev, Vite jadi backend tipisnya:
 * /api/activities diteruskan ke server MAPID tanpa Origin dan dengan key dari
 * .env.local. Di produksi peran ini diambil `api/activities.ts` (Vercel).
 */
const MAPID_UPSTREAM = 'https://server.mapid.io'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.MAPID_API_KEY || env.VITE_MAPID_API_KEY || ''
  return {
    plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
    server: {
      proxy: {
        '/api/activities': {
          target: MAPID_UPSTREAM,
          changeOrigin: true,
          rewrite: () => '/web/competition/activities',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin')
              proxyReq.removeHeader('referer')
              if (apiKey) proxyReq.setHeader('x-api-key', apiKey)
            })
          },
        },
      },
    },
  }
})
