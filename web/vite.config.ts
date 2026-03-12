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
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('Host', req.headers.host ?? 'localhost:8000')
          })
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist')) return 'pdf'
          if (id.includes('pdf.worker')) return 'pdf-worker'
          if (id.includes('@cropper') || id.includes('cropper')) return 'cropper'
          if (id.includes('@tiptap') || id.includes('tiptap')) return 'editor'
          if (id.includes('date-fns')) return 'date'
          if (id.includes('i18next')) return 'i18n'

          if (id.includes('node_modules/solid-js')) return 'solid'
          if (id.includes('node_modules/@solidjs/router')) return 'router'
          if (id.includes('@solid-primitives')) return 'primitives'
          if (id.includes('@tanstack')) return 'tanstack'

          if (id.includes('/icons/') || id.includes('tabler-icons')) return 'icons'
          if (id.includes('valibot')) return 'validation'
          if (id.includes('ky/')) return 'http'

          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
