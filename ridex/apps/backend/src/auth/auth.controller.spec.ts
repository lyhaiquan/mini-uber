import "reflect-metadata";

import { PUBLIC_ROUTE_KEY } from "../common/decorators/public.decorator";
import { AuthController } from "./auth.controller";

describe("AuthController", () => {
  it("marks logout as public because refresh token revocation must not require a live access token", () => {
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, AuthController.prototype.logout)).toBe(true);
  });
});
