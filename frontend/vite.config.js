import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0', // Allow access from any IP
    https: false, // Use HTTP to match backend
    middlewareMode: false,
    hmr: {
      port: 5173,
      host: 'localhost', // Use localhost for HMR to avoid network issues
      clientPort: 5173
    },
    // Remove proxy to avoid conflicts with network access
    // All API calls will be handled directly by getApiUrl() function
    // which automatically detects the correct backend URL based on hostname
  },
  build: {
    // Production optimizations
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    sourcemap: false, // Disable source maps for production
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunk for third-party libraries
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // UI libraries chunk
          ui: ['axios', 'socket.io-client'],
          // Icons and utilities
          utils: ['lucide-react']
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Optimize chunk size warning limit
    chunkSizeWarningLimit: 600,
    // Enable tree shaking
    cssCodeSplit: true
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'socket.io-client',
      'lucide-react'
    ]
  }
})
