import { Injectable } from "@nestjs/common";

import type { Role } from "../users/dto/role.enum";
import type { AuthenticatedUser } from "./auth.types";

@Injectable()
export class AuthFacade {
  /**
   * Public read API for other modules. Auth module is the source of truth for
   * the authenticated user identity carried on each request. Other modules must
   * not parse JWTs directly or read req.user — they query this facade.
   */
  matchesRole(user: AuthenticatedUser | undefined, allowed: Role[]): boolean {
    if (user === undefined || allowed.length === 0) {
      return false;
    }
    return allowed.includes(user.role);
  }

  belongsToUser(user: AuthenticatedUser | undefined, ownerId: string): boolean {
    return user !== undefined && user.userId === ownerId;
  }
}
