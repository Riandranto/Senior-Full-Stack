import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id: string;
      logger?: any;
    }
  }
}

export function requestId() {
  return (req: Request, res: Response, next: NextFunction) => {
    req.id = req.headers['x-request-id'] as string || randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  };
}