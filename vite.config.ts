// vite.config.ts - Version corrigée pour développement local et production
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from 'url';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Charger les variables d'environnement depuis .env selon le mode
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'http://localhost:5000';
  
  // Convertir l'URL HTTP en WS pour le proxy WebSocket
  const wsTarget = apiTarget.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,ttf}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/senior-full-stack\.onrender\.com\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24
                },
                networkTimeoutSeconds: 10
              }
            },
            {
              urlPattern: /^https:\/\/(.*\.)?tile\.openstreetmap\.org\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'map-tiles-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                }
              }
            }
          ],
          navigateFallback: '/offline.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/ws\//, /^\/@vite\/client/]
        }
      })
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@shared": path.resolve(__dirname, "shared"),
      },
    },
    root: path.resolve(__dirname, "client"),
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
      assetsDir: "assets",
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'wouter'],
            ui: ['framer-motion', 'lucide-react'],
            maps: ['leaflet', 'react-leaflet'],
          }
        }
      }
    },
    server: {
      port: 5173,
      strictPort: false,
      host: true,
      fs: {
        strict: false,
        allow: ['..']
      },
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/ws': {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
        }
      }
    },
    base: '/',
    optimizeDeps: {
      // Ne désactivez pas totalement l'optimisation, mais excluez certains packages si nécessaire
      include: ['react', 'react-dom', 'wouter', 'framer-motion', 'lucide-react', 'leaflet', 'react-leaflet'],
      exclude: []
    }
  };
});