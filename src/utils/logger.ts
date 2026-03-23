// ============================================================
// BridgeForge – Structured Logger
// Lightweight logger with levels, timestamps, and JSON output.
// No external dependencies.
// ============================================================

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel = LEVELS[(process.env.LOG_LEVEL as LogLevel) || "info"] ?? LEVELS.info;

function formatLog(level: LogLevel, tag: string, message: string, data?: Record<string, unknown>): string {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    tag,
    msg: message,
  };
  if (data) Object.assign(entry, data);
  return JSON.stringify(entry);
}

function createLogger(tag: string) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => {
      if (LEVELS.debug >= minLevel) console.debug(formatLog("debug", tag, msg, data));
    },
    info: (msg: string, data?: Record<string, unknown>) => {
      if (LEVELS.info >= minLevel) console.log(formatLog("info", tag, msg, data));
    },
    warn: (msg: string, data?: Record<string, unknown>) => {
      if (LEVELS.warn >= minLevel) console.warn(formatLog("warn", tag, msg, data));
    },
    error: (msg: string, data?: Record<string, unknown>) => {
      if (LEVELS.error >= minLevel) console.error(formatLog("error", tag, msg, data));
    },
  };
}

export { createLogger };
export type Logger = ReturnType<typeof createLogger>;
