import { env } from "../env";

describe("env", () => {
  it("parses expoConfig.extra successfully", () => {
    expect(env.apiBaseUrl).toBe("http://localhost:3000/api/v1");
    expect(env.wsUrl).toBe("http://localhost:3000");
  });
});
