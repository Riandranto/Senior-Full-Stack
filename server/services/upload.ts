import multer from 'multer';
import { randomBytes } from 'crypto';
import mime from 'mime-types';
import path from 'path';
import fs from 'fs/promises';
import { AppError } from './error-handler';

// Types de fichiers autorisés
const ALLOWED_MIME_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
  'image/heic': ['.heic'], // Pour les photos iPhone
};

const ALLOWED_EXTENSIONS = Object.values(ALLOWED_MIME_TYPES).flat();
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Configuration stockage
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  
  filename: (_req, file, cb) => {
    // Générer nom de fichier sécurisé
    const ext = mime.extension(file.mimetype) || path.extname(file.originalname).toLowerCase();
    const randomName = randomBytes(20).toString('hex');
    const timestamp = Date.now();
    const safeName = `${timestamp}-${randomName}.${ext}`;
    
    cb(null, safeName);
  }
});

// Filtre de fichiers
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Vérifier MIME type
  if (!ALLOWED_MIME_TYPES[file.mimetype as keyof typeof ALLOWED_MIME_TYPES]) {
    cb(new AppError(`Type de fichier non autorisé: ${file.mimetype}`, 400));
    return;
  }
  
  // Vérifier extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    cb(new AppError(`Extension non autorisée: ${ext}`, 400));
    return;
  }
  
  cb(null, true);
};

// Configuration multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5 // Max 5 fichiers par requête
  }
});

// Types de documents acceptés
export const DOCUMENT_TYPES = {
  CIN: 'CIN',
  PERMIS: 'PERMIS',
  VEHICLE: 'VEHICLE',
  PHOTO: 'PHOTO',
  INSURANCE: 'INSURANCE'
} as const;

export type DocumentType = keyof typeof DOCUMENT_TYPES;

// Validation spécifique par type de document
export function validateDocumentType(type: string, file: Express.Multer.File): boolean {
  switch (type) {
    case DOCUMENT_TYPES.CIN:
    case DOCUMENT_TYPES.PERMIS:
      // Ces documents doivent être des images ou PDF
      return file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
      
    case DOCUMENT_TYPES.PHOTO:
      // Photo doit être une image
      return file.mimetype.startsWith('image/');
      
    case DOCUMENT_TYPES.VEHICLE:
    case DOCUMENT_TYPES.INSURANCE:
      // Peut être image ou PDF
      return true;
      
    default:
      return false;
  }
}

// Nettoyage des fichiers orphelins
export async function cleanupOldFiles(daysOld: number = 7) {
  const uploadDir = path.join(process.cwd(), 'uploads');
  const files = await fs.readdir(uploadDir);
  const now = Date.now();
  
  for (const file of files) {
    const filePath = path.join(uploadDir, file);
    const stat = await fs.stat(filePath);
    const fileAge = (now - stat.mtimeMs) / (1000 * 60 * 60 * 24);
    
    if (fileAge > daysOld) {
      await fs.unlink(filePath);
    }
  }
}