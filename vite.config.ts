import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    allowedHosts: true,
    port: 13000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:13001',
        changeOrigin: true,
      },
    },
  },
})
