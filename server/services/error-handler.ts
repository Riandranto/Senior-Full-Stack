import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { PostgresError } from 'postgres';

// Types d'erreurs personnalisés
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  
  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  errors: any[];
  
  constructor(message: string, errors: any[] = []) {
    super(message, 400);
    this.errors = errors;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} non trouvé`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Non authentifié') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Accès interdit') {
    super(message, 403);
  }
}

// Error handler middleware
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log l'erreur
  logger.error({
    err,
    req: {
      method: req.method,
      url: req.url,
      body: req.body,
      params: req.params,
      query: req.query,
      userId: (req.session as any)?.userId
    }
  }, 'Error occurred');

  // Erreur Zod (validation)
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Erreur de validation',
      errors: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    });
  }

  // Erreur PostgreSQL
  if (err.name === 'PostgresError' || err.name === 'DatabaseError') {
    const pgError = err as any;
    
    // Violation de contrainte unique
    if (pgError.code === '23505') {
      return res.status(409).json({
        message: 'Cette ressource existe déjà',
        detail: pgError.detail
      });
    }
    
    // Violation de clé étrangère
    if (pgError.code === '23503') {
      return res.status(400).json({
        message: 'Référence invalide',
        detail: pgError.detail
      });
    }
    
    // Autres erreurs BD
    return res.status(500).json({
      message: 'Erreur base de données',
      // Ne pas exposer les détails en production
      ...(process.env.NODE_ENV === 'development' && { detail: pgError.message })
    });
  }

  // Nos erreurs personnalisées
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      ...(err instanceof ValidationError && { errors: err.errors })
    });
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Token invalide' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expiré' });
  }

  // Erreur inattendue
  const statusCode = (err as any).statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Erreur interne du serveur'
    : err.message;

  res.status(statusCode).json({ message });
}

// Async handler wrapper pour éviter try/catch
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}