import { randomUUID } from 'crypto';

// Logger simple avec console
export const logger = {
  info: (...args: any[]) => console.log('[INFO]', new Date().toISOString(), ...args),
  error: (...args: any[]) => console.error('[ERROR]', new Date().toISOString(), ...args),
  warn: (...args: any[]) => console.warn('[WARN]', new Date().toISOString(), ...args),
  debug: (...args: any[]) => console.debug('[DEBUG]', new Date().toISOString(), ...args),
  fatal: (...args: any[]) => console.error('[FATAL]', new Date().toISOString(), ...args),
  trace: (...args: any[]) => console.trace('[TRACE]', new Date().toISOString(), ...args),
};

// Logger avec contexte
export function createContextLogger(context: string | Record<string, any>) {
  const requestId = randomUUID();
  const contextStr = typeof context === 'string' ? context : JSON.stringify(context);
  
  return {
    fatal: (msg: string, ...args: any[]) => logger.fatal(`[${contextStr}] ${msg}`, ...args),
    error: (msg: string | Error, ...args: any[]) => {
      if (msg instanceof Error) {
        logger.error(`[${contextStr}] ${msg.message}`, msg.stack, ...args);
      } else {
        logger.error(`[${contextStr}] ${msg}`, ...args);
      }
    },
    warn: (msg: string, ...args: any[]) => logger.warn(`[${contextStr}] ${msg}`, ...args),
    info: (msg: string, ...args: any[]) => logger.info(`[${contextStr}] ${msg}`, ...args),
    debug: (msg: string, ...args: any[]) => logger.debug(`[${contextStr}] ${msg}`, ...args),
    trace: (msg: string, ...args: any[]) => logger.trace(`[${contextStr}] ${msg}`, ...args),
    getRequestId: () => requestId
  };
}

// Logger d'erreur
export function logError(error: Error | string, context?: Record<string, any>) {
  const errorMsg = typeof error === 'string' ? error : error.message;
  logger.error(`[ERROR] ${errorMsg}`, context || {});
}

// Performance logging
export function logPerformance(operation: string, duration: number, metadata?: Record<string, any>) {
  logger.info(`[PERF] ${operation} took ${duration}ms`, metadata);
}

export default {
  logger,
  createContextLogger,
  logError,
  logPerformance
};