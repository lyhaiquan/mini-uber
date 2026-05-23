import type { z } from "zod";

import { ApiAuthError, ApiClientError } from "./errors";

export type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken: () => string | null;
  getAccessTokenExpiresAt?: () => number | null;
  onRefreshNeeded: () => Promise<string | null>;
  onAuthFailure: () => void;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  credentials?: RequestInit["credentials"];
}

export interface ApiRequestOptions<TResponse> {
  method: ApiMethod;
  path: string;
  body?: unknown;
  schema: z.ZodType<TResponse, z.ZodTypeDef, unknown>;
  skipAuth?: boolean;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const REFRESH_BUFFER_MS = 5_000;

export class ApiClient {
  private refreshPromise: Promise<string | null> | null = null;

  constructor(private readonly config: ApiClientConfig) {}

  async request<TResponse>(opts: ApiRequestOptions<TResponse>): Promise<TResponse> {
    const token = opts.skipAuth === true ? null : await this.resolveToken();
    let res = await this.doFetch(opts, token);

    if (res.status === 401 && opts.skipAuth !== true) {
      const refreshedToken = await this.refreshOnce();
      if (refreshedToken === null) {
        this.config.onAuthFailure();
        throw new ApiAuthError();
      }

      res = await this.doFetch(opts, refreshedToken);
      if (res.status === 401) {
        this.config.onAuthFailure();
        throw new ApiAuthError("Authentication retry failed");
      }
    }

    return this.parseResponse(res, opts.schema);
  }

  private async resolveToken(): Promise<string | null> {
    const token = this.config.getAccessToken();
    if (token === null) return null;

    const expiresAt = this.config.getAccessTokenExpiresAt?.() ?? null;
    if (expiresAt !== null && expiresAt - Date.now() < REFRESH_BUFFER_MS) {
      const refreshedToken = await this.refreshOnce();
      if (refreshedToken === null) {
        // Proactive refresh failed and the stored token is known to be (or
        // about to be) invalid. Fail fast instead of firing a doomed request
        // that would just trigger a second refresh on 401.
        this.config.onAuthFailure();
        throw new ApiAuthError();
      }
      return refreshedToken;
    }

    return token;
  }

  private refreshOnce(): Promise<string | null> {
    if (this.refreshPromise !== null) return this.refreshPromise;

    this.refreshPromise = this.config.onRefreshNeeded().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async doFetch<TResponse>(
    opts: ApiRequestOptions<TResponse>,
    token: string | null
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
    const abortListener = () => controller.abort();
    // addEventListener does not fire for signals already in the aborted state,
    // so propagate the abort eagerly before subscribing.
    if (opts.signal?.aborted === true) controller.abort();
    opts.signal?.addEventListener("abort", abortListener, { once: true });

    try {
      const headers: Record<string, string> = {};
      if (opts.body !== undefined) headers["Content-Type"] = "application/json";
      if (token !== null && opts.skipAuth !== true) {
        headers.Authorization = `Bearer ${token}`;
      }

      return await (this.config.fetchImpl ?? fetch)(this.buildUrl(opts.path), {
        method: opts.method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
        credentials: this.config.credentials
      });
    } finally {
      clearTimeout(timeout);
      opts.signal?.removeEventListener("abort", abortListener);
    }
  }

  private buildUrl(path: string): string {
    if (/^https?:\/\//.test(path)) return path;
    return `${this.config.baseUrl}${path}`;
  }

  private async parseResponse<TResponse>(
    res: Response,
    schema: z.ZodType<TResponse, z.ZodTypeDef, unknown>
  ): Promise<TResponse> {
    const body = await readJson(res);
    if (!res.ok) {
      throw new ApiClientError(res.status, body);
    }
    return schema.parse(body);
  }
}

async function readJson(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}
