import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  base: '/georp/',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    {
      name: 'redirect-root-to-georp',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || ''
          if (url === '/' || url.startsWith('/georp/') || url.startsWith('/api')) {
            return next()
          }
          if (url === '/georp') {
            res.writeHead(302, { Location: '/georp/' })
            res.end()
            return
          }
          next()
        })
      },
    },
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
