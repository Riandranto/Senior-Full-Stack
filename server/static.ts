// server/static.ts - Version ultra-simple
import express, { type Express } from "express";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  
  console.log('📁 Serving static files from:', distPath);
  
  // Servir les fichiers statiques
  app.use(express.static(distPath));
  
  // Pour toutes les routes non-API, servir index.html
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}