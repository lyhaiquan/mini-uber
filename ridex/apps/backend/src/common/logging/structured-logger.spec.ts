import type { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables, LogLevel } from "../../config/env.validation";
import { StructuredLogger } from "./structured-logger";

describe("StructuredLogger", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("filters entries below the configured level", () => {
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const logger = createLogger("warn");

    logger.debug("hidden debug");
    logger.log("hidden log");
    logger.warn("visible warning", "TestContext");

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0]?.[0]).toContain("\"level\":\"warn\"");
    expect(consoleWarnSpy.mock.calls[0]?.[0]).toContain("\"context\":\"TestContext\"");
  });

  it("logs error entries when configured level is error", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const logger = createLogger("error");

    logger.warn("hidden warning");
    logger.error("visible error", "stack trace", "TestContext");

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toContain("\"level\":\"error\"");
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toContain("\"trace\":\"stack trace\"");
  });
});

function createLogger(logLevel: LogLevel): StructuredLogger {
  const configService = {
    get: jest.fn().mockReturnValue(logLevel)
  } as unknown as ConfigService<EnvironmentVariables, true>;

  return new StructuredLogger(configService);
}
