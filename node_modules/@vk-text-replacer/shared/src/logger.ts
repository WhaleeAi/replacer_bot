import pino, { type Logger, type LoggerOptions } from "pino";

export function createLogger(name: string, options?: LoggerOptions): Logger {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? "info",
    transport:
      process.env.NODE_ENV === "production"
        ? undefined
        : {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              singleLine: true
            }
          },
    ...options
  });
}
