import { Global, Module } from "@nestjs/common";

import { CryptoService } from "./crypto/crypto.service";
import { StructuredLogger } from "./logging/structured-logger";
import { CorrelationIdMiddleware } from "./middleware/correlation-id.middleware";
import { RequestLoggingMiddleware } from "./middleware/request-logging.middleware";

@Global()
@Module({
  providers: [StructuredLogger, CryptoService, CorrelationIdMiddleware, RequestLoggingMiddleware],
  exports: [StructuredLogger, CryptoService, CorrelationIdMiddleware, RequestLoggingMiddleware]
})
export class CommonModule {}
