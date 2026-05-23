import type { Role } from "../../users/dto/role.enum";

export interface AuthUserPayload {
  id: string;
  email: string;
  role: Role;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
  user: AuthUserPayload;
}
