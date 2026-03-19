// server/static.ts
import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: Express) {
  // En production sur Railway, les fichiers sont dans dist/public
  const distPath = path.resolve(process.cwd(), "dist", "public");
  
  console.log('📁 Looking for static files at:', distPath);
  console.log('📁 Directory exists:', fs.existsSync(distPath));
  
  if (!fs.existsSync(distPath)) {
    console.error(`❌ Could not find build directory: ${distPath}`);
    console.error('💡 Current directory:', process.cwd());
    try {
      console.error('💡 Files in current directory:', fs.readdirSync(process.cwd()));
    } catch (e) {
      console.error('💡 Cannot read directory');
    }
    return;
  }

  // Servir les fichiers statiques
  app.use(express.static(distPath));

  // Log les requêtes statiques (optionnel)
  app.use((req, res, next) => {
    if (req.path.startsWith('/assets/')) {
      console.log('📦 Static request:', req.path);
    }
    next();
  });

  // IMPORTANT: Correction ici - utilisation de '*' au lieu de "{*path}"
  // Fallback pour SPA - retourner index.html pour toutes les routes non-API
  app.get('*', (req, res, next) => {
    // Ne pas intercepter les routes API
    if (req.path.startsWith('/api')) {
      return next();
    }
    
    const indexPath = path.join(distPath, 'index.html');
    
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error('❌ index.html not found at:', indexPath);
      res.status(404).send('Application not built correctly');
    }
  });
}