# Task 016: API Client + TanStack Query + 401 Refresh Flow

## Task Name

Implement typed API client (`packages/api-client`) với fetch wrapper, JWT attach, 401 auto-refresh, retry logic. Setup TanStack Query v5 trong 5 app với QueryClient + DevTools (web) + provider. Centralize error handling theo backend envelope.

## Goal

Mọi data fetch trong FE đi qua 1 client → tự attach access token → khi 401 thì auto-refresh (1 lần) → retry request → nếu refresh fail → emit auth event → app logout. TanStack Query handles caching, dedup, mutation invalidate. Error envelope từ backend `{ error: {code, message} }` map sang Toast.

## Context

- Backend Task 002 access TTL 15 phút, refresh TTL 7 ngày. Refresh rotation: mỗi lần refresh → token mới + revoke cũ.
- T014 đã có auth store + cookie/secure-store. T016 thêm refresh layer + TanStack Query.
- Backend WS gateway từ Task 004/007 dùng socket.io platform — connect cần JWT trong handshake `auth: { token }`.

## Scope

### packages/api-client expansion

`packages/api-client/src/client.ts`:
```typescript
import type { z } from "zod";

export type ApiClientConfig = {
  baseUrl: string;
  getAccessToken: () => string | null;
  onRefreshNeeded: () => Promise<string | null>;  // returns new access token or null
  onAuthFailure: () => void;                       // triggered when refresh fails
};

export class ApiClient {
  constructor(private config: ApiClientConfig) {}

  async request<TResponse>(opts: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    path: string;
    body?: unknown;
    schema: z.ZodType<TResponse>;
    skipAuth?: boolean;
  }): Promise<TResponse> {
    const url = `${this.config.baseUrl}${opts.path}`;
    const doFetch = async (token: string | null) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token !== null && !opts.skipAuth) headers["Authorization"] = `Bearer ${token}`;
      return fetch(url, {
        method: opts.method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
      });
    };

    let res = await doFetch(this.config.getAccessToken());
    if (res.status === 401 && !opts.skipAuth) {
      const newToken = await this.config.onRefreshNeeded();
      if (newToken === null) { this.config.onAuthFailure(); throw new ApiAuthError(); }
      res = await doFetch(newToken);
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new ApiClientError(res.status, errorBody);
    }

    const data = await res.json();
    return opts.schema.parse(data);
  }
}
```

`packages/api-client/src/auth.ts`:
```typescript
import { authTokensSchema } from "@ridex/shared-types";
export const createAuthApi = (client: ApiClient) => ({
  login: (input: { email: string; password: string }) =>
    client.request({ method: "POST", path: "/auth/login", body: input, schema: authTokensSchema, skipAuth: true }),
  register: (input) => /* similar */,
  refresh: (input: { refreshToken: string }) =>
    client.request({ method: "POST", path: "/auth/refresh", body: input, schema: authTokensSchema, skipAuth: true }),
  logout: (input: { refreshToken: string }) =>
    client.request({ method: "POST", path: "/auth/logout", body: input, schema: emptySchema })
});
```

Tương tự tạo `rides.ts`, `drivers.ts`, `payments.ts`, `admin.ts` cho từng endpoint backend đã có.

### 401 refresh flow (web)

Web không trực tiếp giữ refresh token (cookie httpOnly). Refresh đi qua Next.js route handler:
```typescript
// onRefreshNeeded (web)
async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();  // { accessToken, user, accessTokenExpiresInSeconds }
  authStore.setAuth(data);
  return data.accessToken;
}
```

Route handler `/api/auth/refresh/route.ts`:
- Đọc cookie `ridex_refresh`.
- Gọi backend `/auth/refresh` với refreshToken trong body.
- Set cookie mới với rotated refreshToken.
- Trả `{ accessToken, user, accessTokenExpiresInSeconds }` client.

### 401 refresh flow (mobile)

```typescript
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await secureStorage.get("refreshToken");
  if (refreshToken === null) return null;
  const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });
  if (!res.ok) return null;
  const data = await res.json();
  await secureStorage.set("accessToken", data.accessToken);
  await secureStorage.set("refreshToken", data.refreshToken);  // rotated
  authStore.setAuth(data);
  return data.accessToken;
}
```

### Concurrent 401 handling

Vấn đề: 5 request đồng thời → tất cả 401 → 5 refresh call song song → backend rotation race. Solution: singleton refresh promise:
```typescript
let refreshPromise: Promise<string | null> | null = null;
async function refresh(): Promise<string | null> {
  if (refreshPromise !== null) return refreshPromise;
  refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
  return refreshPromise;
}
```

### TanStack Query setup

Mỗi app:
```typescript
// providers/query-provider.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError && [400, 401, 403, 404].includes(error.status)) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: true
    },
    mutations: { retry: 0 }
  }
});

export function QueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}
```

Wrap trong `app/layout.tsx` (web) hoặc `app/_layout.tsx` (mobile).

### Typed hooks per domain

`apps/web-customer/src/hooks/use-rides.ts`:
```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ridesApi } from "@/lib/api";

export function useCreateRide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ridesApi.createRide,
    onSuccess: (ride) => {
      qc.invalidateQueries({ queryKey: ["rides", "active"] });
      qc.setQueryData(["rides", ride.id], ride);
    }
  });
}

export function useActiveRide() {
  return useQuery({
    queryKey: ["rides", "active"],
    queryFn: ridesApi.getActiveRide,
    refetchInterval: 5_000  // poll while waiting for WS push
  });
}
```

### Error → Toast mapping

```typescript
import { toast } from "sonner";  // web
export function showApiError(error: unknown) {
  if (error instanceof ApiClientError) {
    const code = error.body?.error?.code;
    const msg = error.body?.error?.message ?? "Có lỗi xảy ra";
    toast.error(msg, { description: code !== undefined ? `Mã: ${code}` : undefined });
  } else if (error instanceof ApiAuthError) {
    toast.error("Phiên đăng nhập hết hạn");
  } else {
    toast.error("Lỗi kết nối, vui lòng thử lại");
  }
}
```

## Out of Scope

- WebSocket client wrapper (T019 / T018 tùy first use).
- Offline mutation queue (defer).
- Optimistic updates (per-task as needed).
- Request cancellation chi tiết (TanStack handles automatically).
- API response caching server-side (Next.js cache, defer).
- Sentry / error reporting integration.

## Expected Files/Modules

~25 file mới + update auth flows trong T014 files để dùng client mới.

## Functional Requirements

- Login → access token attach Authorization header tự động.
- Access token expire trong session → request 401 → auto refresh → retry → success transparent với user.
- Refresh fail → auth store clear → redirect login.
- 5 concurrent requests cùng 401 → chỉ 1 refresh call.
- TanStack Query cache: fetch lần 1 → 30s sau fetch lần 2 → cache hit, không network.
- Mutation success → related queries invalidate.
- Error toast hiển thị message từ backend envelope.

## Security Requirements

- Token KHÔNG log.
- Refresh token KHÔNG lưu trong memory web (chỉ cookie).
- Refresh rotation: client phải store token mới sau mỗi refresh (cũ đã revoked backend).
- 401 → refresh → 401 lần 2: stop refresh, force logout (chống infinite loop).
- Mỗi request có 30s timeout (`AbortController`).

## Database Requirements

KHÔNG.

## API/WebSocket Changes

KHÔNG.

## Business Rules

- Refresh chỉ thử 1 lần per request.
- Logout call backend `/auth/logout` để revoke server-side refresh.
- 5 second buffer: nếu access token sắp expire (<5s còn lại), proactive refresh trước request thay vì đợi 401.

## Edge Cases

- Backend trả 401 không phải vì token expired (e.g., role mismatch) → refresh attempt vô ích nhưng acceptable (1 refresh extra request).
- Network offline: TanStack Query "isOffline" state, không retry.
- Backend 500: retry tối đa 2 lần với exponential backoff (TanStack Query default).
- Concurrent refresh race: singleton promise resolve.
- User clear cookie mid-session: next request 401 → refresh 401 → force logout.

## Tests Required

- Vitest unit:
  - `ApiClient.request` happy path.
  - 401 → refresh → retry success.
  - 401 → refresh fail → ApiAuthError.
  - 401 → refresh → 401 lần 2 → ApiAuthError (no loop).
  - Concurrent 401 → 1 refresh call.
  - Schema validation rejects malformed response.
- TanStack Query hook tests (`@testing-library/react`):
  - `useActiveRide` returns data.
  - `useCreateRide` invalidates `["rides", "active"]`.
- Mobile (Jest):
  - Refresh round-trip với secure-storage mock.

Test target: ~15 tests.

## Acceptance Criteria

- [x] `packages/api-client` exports `ApiClient` + per-domain factories.
- [x] 5 apps wired QueryClientProvider.
- [x] T014 auth flows refactor dùng api-client.
- [x] 401 auto-refresh works trên web + mobile.
- [x] Concurrent 401 không gây race.
- [x] Toast hiển thị backend error message.
- [x] Lint + build + test xanh.

## Prompt for Codex

Implement Task 016 đúng spec. ApiClient với fetch wrapper, JWT attach, 401 auto-refresh singleton, schema validation Zod. TanStack Query v5 setup 5 apps với devtools dev. Refresh flow: web qua /api/auth/refresh route handler + cookie; mobile gọi backend trực tiếp + secure-store rotate. Per-domain api factories (auth/rides/drivers/payments/admin). Refactor T014 auth flows dùng client. Toast error envelope mapping. Test refresh edge cases (concurrent, double-401, schema fail). Finish với Summary, Changed files, Tests run, Notes.
