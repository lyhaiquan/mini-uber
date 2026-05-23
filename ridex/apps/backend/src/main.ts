import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";

import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { StructuredLogger } from "./common/logging/structured-logger";
import type { EnvironmentVariables } from "./config/env.validation";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });

  configureApp(app);

  const configService = app.get(ConfigService<EnvironmentVariables, true>);
  const logger = app.get(StructuredLogger);
  const port = configService.get("PORT", { infer: true });
  const apiPrefix = configService.get("API_PREFIX", { infer: true });

  await app.listen(port);

  logger.log(
    {
      event: "app.started",
      port,
      apiPrefix
    },
    "Bootstrap"
  );
}

void bootstrap();
