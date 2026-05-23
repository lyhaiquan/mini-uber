import type { Role } from "../users/dto/role.enum";

export interface AuthenticatedUser {
  userId: string;
  role: Role;
}

export interface JwtAccessPayload {
  sub: string;
  role: Role;
  iat?: number;
  exp?: number;
}
