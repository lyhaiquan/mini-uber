import type { Role } from "./role.enum";

export interface UserAuthDto {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  isLocked: boolean;
  lockedUntil: string | null;
}
