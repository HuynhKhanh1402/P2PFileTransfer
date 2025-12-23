import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Đọc từ env VITE_ALLOWED_HOSTS (comma-separated) hoặc dùng default
    allowedHosts: process.env.VITE_ALLOWED_HOSTS?.split(',') || ['localhost'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
