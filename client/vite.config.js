import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      // Normal API istekleri için
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      // WebSocket (Canlı veri) için bu kısmı EKLE:
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
      }
    }
  }
})