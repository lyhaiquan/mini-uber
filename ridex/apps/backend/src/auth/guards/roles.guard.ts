import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { Role } from "../../users/dto/role.enum";
import type { AuthenticatedUser } from "../auth.types";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (requiredRoles === undefined || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (user === undefined) {
      throw new ForbiddenException({
        code: "AUTHORIZATION_REQUIRED",
        message: "Authenticated user is required for this resource."
      });
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        code: "INSUFFICIENT_ROLE",
        message: "Your role does not allow this action."
      });
    }

    return true;
  }
}
