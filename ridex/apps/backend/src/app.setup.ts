import { RequestMethod, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { StructuredLogger } from "./common/logging/structured-logger";
import { createGlobalValidationPipe } from "./common/pipes/validation-pipe.factory";
import type { EnvironmentVariables } from "./config/env.validation";
import { ConfiguredSocketIoAdapter } from "./infra/socket-io/configured-socket-io.adapter";

export function configureApp(app: INestApplication): void {
  const logger = app.get(StructuredLogger);
  const configService = app.get(ConfigService<EnvironmentVariables, true>);
  const apiPrefix = configService.get("API_PREFIX", { infer: true });
  const corsOrigins = configService.get("CORS_ORIGINS", { infer: true });

  app.useLogger(logger);
  app.enableCors({
    origin: corsOrigins,
    credentials: true
  });
  app.useWebSocketAdapter(new ConfiguredSocketIoAdapter(app, configService));
  // Health remains unprefixed for infrastructure probes; versioned APIs use API_PREFIX.
  app.setGlobalPrefix(apiPrefix, {
    exclude: [{ path: "health", method: RequestMethod.GET }]
  });
  app.useGlobalPipes(createGlobalValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter(logger));
}
