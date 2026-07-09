import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

const isVitest =
  process.env.VITEST === 'true' ||
  process.env.NODE_ENV === 'test' ||
  process.argv.some(arg => arg.includes('vitest'))
const vueDevToolsPlugin = isVitest
  ? null
  : (await import('vite-plugin-vue-devtools')).default()

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevToolsPlugin,
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
// Vitest-Konfiguration
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
