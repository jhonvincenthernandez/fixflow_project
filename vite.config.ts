import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// The Ionic Vue guide uses `dist` as the Capacitor web directory (see capacitor.config.ts).
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
