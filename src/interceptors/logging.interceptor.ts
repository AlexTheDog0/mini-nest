import { performance } from "node:perf_hooks";

import type {
  ExecutionContext,
  Interceptor,
  Next,
} from "../lifecycle.js";

export type LogWriter = (message: string) => void;

export class LoggingInterceptor implements Interceptor {
  constructor(private readonly writeLog: LogWriter = console.log) {}

  async intercept(
    context: ExecutionContext,
    next: Next,
  ): Promise<unknown> {
    const startedAt = performance.now();

    try {
      return await next();
    } finally {
      const duration = performance.now() - startedAt;
      const pathname = new URL(
        context.request.url ?? "/",
        "http://localhost",
      ).pathname;

      this.writeLog(
        `${context.request.method ?? "UNKNOWN"} ${pathname} — ${duration.toFixed(1)} ms`,
      );
    }
  }
}
