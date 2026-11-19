import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages com domínio personalizado: https://desbloqueio.ievavanca.com.br/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: { host: '127.0.0.1' },
})
