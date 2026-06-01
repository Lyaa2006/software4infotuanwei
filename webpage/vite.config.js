import { defineConfig } from 'vite'

// NOTE: removed @vitejs/plugin-react to avoid peer dependency conflicts with Vite versions.
// Vite's default esbuild transform handles JSX; add the official plugin later if you upgrade Vite
// or install a plugin version compatible with your Vite version.
function normalizeApiBaseUrl(input) {
  let base = String(input || '').trim()
  if (!base) return ''
  base = base.replace(/\/+$/, '')
  if (/\/api$/i.test(base)) base = base.replace(/\/api$/i, '')
  return base.replace(/\/+$/, '')
}

export default defineConfig({
  server: {
    // bind to IPv4 to avoid ::1 permission/lookup issues on some systems
    host: '127.0.0.1',
    port: 5173,
    // Proxy /api requests to backend to avoid CORS during development
    proxy: {
      '/api': {
        target: normalizeApiBaseUrl(process.env.VITE_API_BASE || 'http://localhost:3001'),
        changeOrigin: true,
        secure: false,
      },
      // Also proxy uploads so image URLs like /uploads/.. are forwarded to the backend
      '/uploads': {
        target: normalizeApiBaseUrl(process.env.VITE_API_BASE || 'http://localhost:3001'),
        changeOrigin: true,
        secure: false,
      },
    },
  },
})