import { SetMetadata } from "@nestjs/common";

import type { Role } from "../../users/dto/role.enum";

export const ROLES_KEY = "ridex:roles";

export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
