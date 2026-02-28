import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  define: {
    'import.meta.env.VITE_MSAL_CLIENT_ID': JSON.stringify(process.env.VITE_MSAL_CLIENT_ID || ''),
    'import.meta.env.VITE_MSAL_TENANT_ID': JSON.stringify(process.env.VITE_MSAL_TENANT_ID || '')
  }
})
