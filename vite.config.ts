import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),  // <-- Important: output dans dist/public
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "client/index.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true,
      },
    },
  },
});