import pino from 'pino';
import pinoPretty from 'pino-pretty';
import { randomUUID } from 'crypto';

// Configuration des niveaux de log
const levels = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10
};

// Stream pour développement
const prettyStream = pinoPretty({
  colorize: true,
  translateTime: 'SYS:standard',
  ignore: 'pid,hostname',
  messageFormat: '{msg} {if context}(context={context}){end}'
});

// Configuration selon environnement
const getConfig = () => {
  const baseConfig = {
    level: process.env.LOG_LEVEL || 'info',
    base: {
      pid: process.pid,
      host: process.env.HOSTNAME,
      env: process.env.NODE_ENV
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label: string) => ({ level: label }),
      bindings: (bindings: any) => ({
        pid: bindings.pid,
        host: bindings.host
      })
    }
  };

  if (process.env.NODE_ENV === 'production') {
    return {
      ...baseConfig,
      // Format JSON pour production (collecte centralisée)
      transport: {
        target: 'pino/file',
        options: { destination: 1 } // stdout
      }
    };
  }

  return {
    ...baseConfig,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: true,
        ignore: 'pid,hostname'
      }
    }
  };
};

export const logger = pino(getConfig());

// Logger avec contexte (pour requêtes)
export function createContextLogger(context: string | Record<string, any>) {
  const childLogger = logger.child(
    typeof context === 'string' 
      ? { context } 
      : context
  );
  
  return {
    fatal: (msg: string, ...args: any[]) => childLogger.fatal(msg, ...args),
    error: (msg: string | Error, ...args: any[]) => {
      if (msg instanceof Error) {
        childLogger.error({
          err: {
            message: msg.message,
            stack: msg.stack,
            name: msg.name
          }
        }, msg.message);
      } else {
        childLogger.error(msg, ...args);
      }
    },
    warn: (msg: string, ...args: any[]) => childLogger.warn(msg, ...args),
    info: (msg: string, ...args: any[]) => childLogger.info(msg, ...args),
    debug: (msg: string, ...args: any[]) => childLogger.debug(msg, ...args),
    trace: (msg: string, ...args: any[]) => childLogger.trace(msg, ...args)
  };
}

//