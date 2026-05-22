import { z } from "zod";

export const roleSchema = z.enum(["CUSTOMER", "DRIVER", "ADMIN"]);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: roleSchema
});
export type User = z.infer<typeof userSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  accessTokenExpiresInSeconds: z.number().int().positive(),
  user: userSchema
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const registerDtoSchema = z
  .object({
    email: z.string().email().max(254),
    password: z.string().min(8).max(128)
  })
  .strict();
export type RegisterDto = z.infer<typeof registerDtoSchema>;

export const loginDtoSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128)
});
export type LoginDto = z.infer<typeof loginDtoSchema>;

export const refreshDtoSchema = z.object({
  refreshToken: z.string().min(1)
});
export type RefreshDto = z.infer<typeof refreshDtoSchema>;

export const logoutDtoSchema = z.object({
  refreshToken: z.string().min(1)
});
export type LogoutDto = z.infer<typeof logoutDtoSchema>;
