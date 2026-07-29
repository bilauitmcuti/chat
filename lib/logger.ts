type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  msg: string;
  correlationId?: string;
  [key: string]: unknown;
}

function log(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development" && level === "debug") return;
  const entry: LogEntry = { level, msg, ...meta };
  const out = JSON.stringify(entry);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
