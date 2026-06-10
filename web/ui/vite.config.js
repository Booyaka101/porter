import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      include: '**/*.{jsx,js}',
    })
  ],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: []
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8080'
    }
  },
  build: {
    outDir: 'build',
    sourcemap: false
  }
})
