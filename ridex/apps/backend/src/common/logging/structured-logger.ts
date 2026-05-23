import { Injectable, type LoggerService } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables, LogLevel } from "../../config/env.validation";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  verbose: 0,
  debug: 1,
  log: 2,
  warn: 3,
  error: 4
};

interface StructuredLogEntry {
  level: LogLevel;
  timestamp: string;
  context?: string;
  message?: string;
  trace?: string;
  [key: string]: unknown;
}

@Injectable()
export class StructuredLogger implements LoggerService {
  private readonly configuredLevel: LogLevel;

  constructor(private readonly configService: ConfigService<EnvironmentVariables, true>) {
    this.configuredLevel = this.configService.get("LOG_LEVEL", { infer: true });
  }

  log(message: unknown, context?: string): void {
    this.write("log", message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write("error", message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write("warn", message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write("debug", message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write("verbose", message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string): void {
    if (!this.shouldWrite(level)) {
      return;
    }

    const entry = this.toEntry(level, message, context, trace);
    const serializedEntry = JSON.stringify(entry);

    if (level === "error") {
      console.error(serializedEntry);
      return;
    }

    if (level === "warn") {
      console.warn(serializedEntry);
      return;
    }

    console.log(serializedEntry);
  }

  private toEntry(
    level: LogLevel,
    message: unknown,
    context?: string,
    trace?: string
  ): StructuredLogEntry {
    const baseEntry: StructuredLogEntry = {
      level,
      timestamp: new Date().toISOString()
    };

    if (context !== undefined) {
      baseEntry.context = context;
    }

    if (trace !== undefined) {
      baseEntry.trace = trace;
    }

    if (this.isRecord(message)) {
      return {
        ...baseEntry,
        ...message
      };
    }

    return {
      ...baseEntry,
      message: String(message)
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private shouldWrite(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.configuredLevel];
  }
}
