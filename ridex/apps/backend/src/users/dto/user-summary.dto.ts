import type { Role } from "./role.enum";

export interface UserSummaryDto {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}
