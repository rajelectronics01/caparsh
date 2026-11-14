import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dev server only: accept requests by LAN address or a preview hostname, not just localhost.
  server: { allowedHosts: true },
})
