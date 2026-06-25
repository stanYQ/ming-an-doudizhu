export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  roomId?: string;
  userId?: number;
  event?: string;
  [key: string]: unknown;
}

const MAX_BYTES = 65536; // 64 KB — [BATTLE] 战报完整输出

export class Logger {
  static debug(msg: string, ctx?: LogContext): void {
    // AC-4: DEBUG suppressed in production
    if (process.env.NODE_ENV === "production") return;
    Logger._emit("debug", msg, ctx);
  }

  static info(msg: string, ctx?: LogContext): void  { Logger._emit("info",  msg, ctx); }
  static warn(msg: string, ctx?: LogContext): void  { Logger._emit("warn",  msg, ctx); }
  static error(msg: string, ctx?: LogContext & { error?: Error }): void {
    Logger._emit("error", msg, ctx);
  }

  private static _emit(level: LogLevel, msg: string, ctx?: LogContext & { error?: Error }): void {
    try {
      const entry: Record<string, unknown> = {
        level,
        timestamp: new Date().toISOString(), // AC-1: ISO 8601
        msg,
      };

      if (ctx) {
        const { error, ...rest } = ctx as LogContext & { error?: Error };
        Object.assign(entry, rest);
        if (error instanceof Error) {
          // serialize Error — JSON.stringify drops Error properties otherwise
          entry.error = error.message;
          if (error.stack) entry.stack = error.stack;
        }
      }

      let line = JSON.stringify(entry);

      // AC-14: truncate to 4 KB; shorten stack first if present
      if (line.length > MAX_BYTES && entry.stack) {
        entry.stack = (entry.stack as string).slice(0, 200) + "…";
        line = JSON.stringify(entry);
      }
      if (line.length > MAX_BYTES) {
        line = line.slice(0, MAX_BYTES);
      }

      // AC-13: write to stdout only (PM2 captures it)
      process.stdout.write(line + "\n");
    } catch {
      // AC: Logger self-exception must never crash caller (silent degradation)
    }
  }
}
