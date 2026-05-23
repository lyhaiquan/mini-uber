import {
  authTokensSchema,
  loginDtoSchema,
  logoutDtoSchema,
  refreshDtoSchema,
  registerDtoSchema,
  type LoginDto,
  type LogoutDto,
  type RefreshDto,
  type RegisterDto
} from "@ridex/shared-types";

import type { ApiClient } from "./client";
import { emptyResponseSchema } from "./schemas";

export function createAuthApi(client: ApiClient) {
  return {
    login(input: LoginDto) {
      return client.request({
        method: "POST",
        path: "/auth/login",
        body: loginDtoSchema.parse(input),
        schema: authTokensSchema,
        skipAuth: true
      });
    },

    register(input: RegisterDto) {
      return client.request({
        method: "POST",
        path: "/auth/register",
        body: registerDtoSchema.parse(input),
        schema: authTokensSchema,
        skipAuth: true
      });
    },

    refresh(input: RefreshDto) {
      return client.request({
        method: "POST",
        path: "/auth/refresh",
        body: refreshDtoSchema.parse(input),
        schema: authTokensSchema,
        skipAuth: true
      });
    },

    logout(input: LogoutDto) {
      return client.request({
        method: "POST",
        path: "/auth/logout",
        body: logoutDtoSchema.parse(input),
        schema: emptyResponseSchema
      });
    }
  };
}
