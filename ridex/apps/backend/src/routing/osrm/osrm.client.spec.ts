import type { ConfigService } from "@nestjs/config";

import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import { OsrmClient } from "./osrm.client";

const DEFAULT_CONFIG = {
  OSRM_BASE_URL: "http://osrm:5000",
  OSRM_TIMEOUT_MS: 1500
};
const PICKUP = { lat: 10.7, lng: 106.7 };
const DESTINATION = { lat: 10.8, lng: 106.8 };

describe("OsrmClient", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("returns the first parsed route for a successful Ok response", async () => {
    const { client } = createClient();
    jest.spyOn(global, "fetch").mockResolvedValue(
      createFetchResponse(200, {
        code: "Ok",
        routes: [{ distance: 1234.5, duration: 456.7, geometry: "encoded-polyline" }]
      })
    );

    await expect(client.fetchRoute(PICKUP, DESTINATION)).resolves.toEqual({
      distance: 1234.5,
      duration: 456.7,
      geometry: "encoded-polyline"
    });
  });

  it("returns null and warns when OSRM returns NoRoute", async () => {
    const { client, logger } = createClient();
    jest.spyOn(global, "fetch").mockResolvedValue(
      createFetchResponse(200, {
        code: "NoRoute",
        routes: []
      })
    );

    await expect(client.fetchRoute(PICKUP, DESTINATION)).resolves.toBeNull();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "routing.osrm.no_route",
        errorName: "OsrmNoRoute",
        osrmCode: "NoRoute"
      }),
      "OsrmClient"
    );
  });

  it("returns null when OSRM returns an empty routes array", async () => {
    const { client, logger } = createClient();
    jest.spyOn(global, "fetch").mockResolvedValue(
      createFetchResponse(200, {
        code: "Ok",
        routes: []
      })
    );

    await expect(client.fetchRoute(PICKUP, DESTINATION)).resolves.toBeNull();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "routing.osrm.empty_routes",
        errorName: "OsrmEmptyRoutes",
        osrmCode: "Ok"
      }),
      "OsrmClient"
    );
  });

  it("returns null and warns for 4xx responses", async () => {
    const { client, logger } = createClient();
    jest.spyOn(global, "fetch").mockResolvedValue(createFetchResponse(404, {}));

    await expect(client.fetchRoute(PICKUP, DESTINATION)).resolves.toBeNull();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "routing.osrm.http_error",
        errorName: "OsrmHttpError",
        httpStatus: 404
      }),
      "OsrmClient"
    );
  });

  it("returns null and warns for 5xx responses", async () => {
    const { client, logger } = createClient();
    jest.spyOn(global, "fetch").mockResolvedValue(createFetchResponse(503, {}));

    await expect(client.fetchRoute(PICKUP, DESTINATION)).resolves.toBeNull();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "routing.osrm.http_error",
        errorName: "OsrmHttpError",
        httpStatus: 503
      }),
      "OsrmClient"
    );
  });

  it("returns null and warns when the OSRM body cannot be parsed", async () => {
    const { client, logger } = createClient();
    jest.spyOn(global, "fetch").mockResolvedValue(createFetchResponseWithJsonError());

    await expect(client.fetchRoute(PICKUP, DESTINATION)).resolves.toBeNull();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "routing.osrm.parse_error",
        errorName: "SyntaxError"
      }),
      "OsrmClient"
    );
  });

  it("returns null and warns when OSRM returns a negative distance", async () => {
    const { client, logger } = createClient();
    jest.spyOn(global, "fetch").mockResolvedValue(
      createFetchResponse(200, {
        code: "Ok",
        routes: [{ distance: -1, duration: 1, geometry: "x" }]
      })
    );

    await expect(client.fetchRoute(PICKUP, DESTINATION)).resolves.toBeNull();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "routing.osrm.invalid_route",
        errorName: "OsrmInvalidRoute",
        osrmCode: "Ok"
      }),
      "OsrmClient"
    );
  });

  it("returns null and warns when fetch throws a network error", async () => {
    const { client, logger } = createClient();
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("connection refused"));

    await expect(client.fetchRoute(PICKUP, DESTINATION)).resolves.toBeNull();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "routing.osrm.network_error",
        errorName: "Error"
      }),
      "OsrmClient"
    );
  });

  it("returns null and warns with timeout event when fetch is aborted", async () => {
    jest.useFakeTimers();
    const { client, logger } = createClient({ OSRM_TIMEOUT_MS: 25 });
    jest.spyOn(global, "fetch").mockImplementation((_url, init) => {
      const requestInit = init as RequestInit;
      return new Promise<Response>((_resolve, reject) => {
        requestInit.signal?.addEventListener("abort", () => {
          const abortError = new Error("aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });

    const result = client.fetchRoute(PICKUP, DESTINATION);
    await jest.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "routing.osrm.timeout",
        errorName: "AbortError"
      }),
      "OsrmClient"
    );
  });

  it("builds the OSRM route URL with lng before lat and semicolon separator", async () => {
    const { client } = createClient();
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      createFetchResponse(200, {
        code: "Ok",
        routes: [{ distance: 1, duration: 1, geometry: "x" }]
      })
    );

    await client.fetchRoute(PICKUP, DESTINATION);

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://osrm:5000/route/v1/driving/106.7,10.7;106.8,10.8?overview=full&geometries=polyline&alternatives=false&steps=false",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});

function createClient(overrides: Partial<typeof DEFAULT_CONFIG> = {}): {
  client: OsrmClient;
  logger: jest.Mocked<StructuredLogger>;
} {
  const configValues = { ...DEFAULT_CONFIG, ...overrides };
  const configService = {
    get: jest.fn((key: keyof typeof DEFAULT_CONFIG) => configValues[key])
  } as unknown as ConfigService<EnvironmentVariables, true>;
  const logger = {
    warn: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;

  return {
    client: new OsrmClient(configService, logger),
    logger
  };
}

function createFetchResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body)
  } as unknown as Response;
}

function createFetchResponseWithJsonError(): Response {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockRejectedValue(new SyntaxError("Unexpected token"))
  } as unknown as Response;
}
