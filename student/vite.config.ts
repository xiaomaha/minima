import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { defineConfig } from 'vite'
import biomePlugin from 'vite-plugin-biome'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'solid', autoCodeSplitting: true }),
    solidPlugin(),
    tailwindcss(),
    biomePlugin({
      mode: 'check',
    }),
  ],
  resolve: {
    alias: {
      // path
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://minima:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
        },
      },
    },
  },
})
