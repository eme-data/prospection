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
    'import.meta.env.VITE_MSAL_CLIENT_ID': JSON.stringify(process.env.VITE_MSAL_CLIENT_ID || '67ae828e-a871-46c9-9606-925672c43c4e'),
    'import.meta.env.VITE_MSAL_TENANT_ID': JSON.stringify(process.env.VITE_MSAL_TENANT_ID || '11d55f60-e3b1-48e4-a5cd-911c091fc1a7')
  }
})
