import type { INestApplicationContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { IoAdapter } from "@nestjs/platform-socket.io";
import type { ServerOptions } from "socket.io";

import type { EnvironmentVariables } from "../../config/env.validation";

export class ConfiguredSocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly configService: ConfigService<EnvironmentVariables, true>
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: Partial<ServerOptions>): unknown {
    const corsOrigins = this.configService.get("CORS_ORIGINS", { infer: true });
    const path = this.configService.get("WS_PATH", { infer: true });
    const serverOptions = {
      ...options,
      path,
      cors: {
        origin: corsOrigins,
        credentials: true
      }
    };

    return super.createIOServer(port, serverOptions);
  }
}
