import { cellKey, companionKey, lastSeenZsetKey } from "./h3-redis-keys";

describe("h3-redis-keys", () => {
  it("cellKey uses the expected pattern at r8 and r9", () => {
    expect(cellKey(8, "8928308280fffff")).toBe("h3:drivers:r8:8928308280fffff");
    expect(cellKey(9, "8928308280fffff")).toBe("h3:drivers:r9:8928308280fffff");
  });

  it("companionKey is per-driver", () => {
    expect(companionKey("driver-1")).toBe("h3:driver:cells:driver-1");
  });

  it("lastSeenZsetKey is global", () => {
    expect(lastSeenZsetKey()).toBe("h3:drivers:last-seen");
  });
});
