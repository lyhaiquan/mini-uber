import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { EnvironmentVariables } from "../../config/env.validation";
import { ALL_ROLES, type Role } from "../../users/dto/role.enum";
import type { AuthenticatedUser, JwtAccessPayload } from "../auth.types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get("JWT_ACCESS_SECRET", { infer: true })
    });
  }

  validate(payload: JwtAccessPayload): AuthenticatedUser {
    if (typeof payload?.sub !== "string" || payload.sub.length === 0) {
      throw new UnauthorizedException({
        code: "INVALID_TOKEN",
        message: "Access token payload is invalid."
      });
    }

    if (!ALL_ROLES.includes(payload.role as Role)) {
      throw new UnauthorizedException({
        code: "INVALID_TOKEN",
        message: "Access token payload is invalid."
      });
    }

    return {
      userId: payload.sub,
      role: payload.role
    };
  }
}
