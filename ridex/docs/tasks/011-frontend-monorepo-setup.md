# Task 011: Frontend Monorepo + Shared Packages

## Task Name

Bootstrap monorepo cho frontend phase: pnpm workspace, Turborepo, shared packages, ESLint/TS preset, design tokens. Không tạo app code, chỉ scaffold.

## Goal

Tạo nền tảng để 5 app frontend (3 web + 2 mobile) có thể share type definitions, API client, design tokens, ESLint config mà không duplicate code. Task này KHÔNG implement app — chỉ workspace setup.

## Context

- Backend đã có `apps/backend` (NestJS) trong pnpm workspace tại `ridex/`. `pnpm-workspace.yaml` hiện chỉ list `apps/*`.
- Frontend sẽ thêm 5 apps + 8 packages.
- Backend export Zod schemas hoặc DTO interfaces — frontend cần khớp shape. Approach: copy DTO TypeScript types vào `packages/shared-types` ban đầu, Zod schema cho runtime validate. Future có thể auto-gen từ backend OpenAPI.
- Locked decisions từ `FRONTEND_PLAN.md`: Next.js 15, Expo, Tailwind, shadcn/ui, Mapbox, socket.io-client, TanStack Query v5, Zustand, react-hook-form, Turborepo.

## Scope

### Workspace layout (mới)
```
ridex/
  pnpm-workspace.yaml                  # thêm "packages/*"
  turbo.json                           # mới
  package.json                         # thêm turbo + workspace scripts
  packages/
    config-eslint/
      package.json
      base.js                          # ESLint preset cho TS
      next.js                          # extend cho Next.js app
      expo.js                          # extend cho Expo app
      package.js                       # extend cho library packages
    config-typescript/
      package.json
      base.json
      nextjs.json
      expo.json
      package-lib.json
    shared-types/
      package.json
      src/
        index.ts                       # re-export tất cả
        auth.ts                        # User, Role, AuthTokens, RegisterDto, LoginDto
        rides.ts                       # Ride, RideStatus, CreateRideDto, RideResponseDto
        drivers.ts                     # DriverAvailability, DriverOnlineDto
        payments.ts                    # Wallet, Payment, LedgerEntry, PaymentStatus
        admin.ts                       # DashboardSummaryDto từ Task 010
        common.ts                      # ApiEnvelope, ApiError, Pagination
        events.ts                      # WS event types
      tsconfig.json
    ui-tokens/
      package.json
      tailwind.config.ts               # base config có thể extend
      tokens/
        colors.ts                      # primary, surface, text, error palette
        spacing.ts                     # 4-base scale
        typography.ts                  # font family, size, weight scale
        radius.ts                      # corner radius scale
      index.ts                         # export tokens
  apps/                                # giữ nguyên backend; placeholder cho web/mobile chưa tạo
```

Các package khác (`api-client`, `socket-client`, `ui-web`, `ui-mobile`) tạo ở task sau (T016, T012, T013) để không nhồi quá nhiều scaffolding vào 1 PR.

### Turborepo pipeline (`turbo.json`)
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "lint":  { "dependsOn": ["^build"], "outputs": [] },
    "test":  { "dependsOn": ["^build"], "outputs": [] },
    "dev":   { "cache": false, "persistent": true }
  }
}
```

Root `package.json` thêm:
```json
{
  "scripts": {
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "dev": "turbo dev --parallel"
  },
  "devDependencies": { "turbo": "^2.x" }
}
```

### shared-types content (T011 baseline)

`shared-types/src/common.ts`:
```typescript
import { z } from "zod";

export const apiEnvelopeSchema = <T>(dataSchema: z.ZodType<T>) =>
  z.object({
    data: dataSchema,
    meta: z.object({ requestId: z.string().optional() }).optional()
  });

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional()
  }),
  meta: z.object({ requestId: z.string().optional() }).optional()
});
export type ApiError = z.infer<typeof apiErrorSchema>;
```

`shared-types/src/auth.ts` map theo `auth/dto/` của backend:
```typescript
import { z } from "zod";

export const roleSchema = z.enum(["CUSTOMER", "DRIVER", "ADMIN"]);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({ id: z.string().uuid(), email: z.string().email(), role: roleSchema });
export type User = z.infer<typeof userSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresInSeconds: z.number(),
  user: userSchema
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const registerDtoSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128)
});
```

Tương tự cho `rides.ts`, `payments.ts`, `admin.ts`. Mỗi domain: schema + inferred type.

### ESLint preset

`packages/config-eslint/base.js`: TypeScript + `@typescript-eslint`, `eslint-config-prettier`, `import/order`.
`packages/config-eslint/next.js`: extends base + `eslint-plugin-react` + `eslint-config-next`.
`packages/config-eslint/expo.js`: extends base + `eslint-plugin-react-native`.
`packages/config-eslint/package.js`: chỉ base + `import` rules.

### TS preset

`packages/config-typescript/base.json`: strict mode true, target ES2022, lib ES2023, types node.
`nextjs.json`: extends base, JSX preserve, moduleResolution bundler, paths cho `@/*`.
`expo.json`: extends base, JSX react-native, target ESNext.
`package-lib.json`: extends base, declaration true, emitDeclarationOnly false, outDir dist.

### Design tokens

`ui-tokens/tokens/colors.ts`:
```typescript
export const colors = {
  primary: { 50: "#eef9ff", 500: "#0a84ff", 900: "#0b3a8a" },  // Uber-like blue
  surface: { 0: "#ffffff", 100: "#f5f5f7", 900: "#0b0b0d" },
  text: { primary: "#0b0b0d", secondary: "#6c6c70", inverse: "#ffffff" },
  state: { success: "#10b981", warning: "#f59e0b", error: "#ef4444" },
  brand: { uberBlack: "#000000", uberWhite: "#ffffff" }
};
```

`tailwind.config.ts` consume tokens, export preset.

## Out of Scope

- Tạo apps Next.js / Expo (defer T012, T013).
- API client implementation (T016).
- shadcn/ui registry (T012).
- NativeWind setup (T013).
- Test framework setup (T011 chỉ ESLint).
- Storybook / component playground.
- CI workflow update — defer cho phase 8.

## Expected Files/Modules

~20 file mới. Không touch backend.

## Functional Requirements

- `pnpm install` thành công root.
- `pnpm turbo lint` chạy được (chưa có app, nhưng workspace phải parse OK).
- `pnpm --filter @ridex/shared-types build` produces `dist/index.d.ts`.
- `import { authTokensSchema } from "@ridex/shared-types"` resolve được trong sample TS file.
- ESLint preset import được: `extends: ["@ridex/config-eslint/base"]`.
- TS preset import được: `"extends": "@ridex/config-typescript/base.json"`.

## Security Requirements

- Không có secret hard-code trong package code.
- `shared-types` validate input data bằng Zod khi parse response từ backend (FE side validation).

## Database Requirements

KHÔNG. Frontend phase không động database.

## API/WebSocket Changes

KHÔNG. Task này không động backend.

## Business Rules

- Tên package phải prefix `@ridex/`.
- Package versioning bắt đầu `0.0.1`, không publish npm.
- Tất cả package private: `"private": true` trong package.json.

## Edge Cases

- Khi developer mới clone repo + `pnpm install`: phải work không cần env vars.
- Khi backend chưa build: workspace lint vẫn pass (không cross-import backend).
- Khi xóa package: turbo invalidate cache đúng.

## Tests Required

- Unit test cho 2-3 Zod schema trong shared-types (`shared-types/src/__tests__/auth.spec.ts`):
  - `authTokensSchema.parse(validPayload)` succeed.
  - `authTokensSchema.parse({email: "x"})` fail.
  - `registerDtoSchema.parse({ email: "bad", password: "short" })` throws.
- Setup Vitest hoặc Jest cho `shared-types`. Recommend Vitest (lightweight, sync với Next.js / Vite ecosystem).
- Test target: ~6 tests cho phase này.

## Acceptance Criteria

- [x] `pnpm-workspace.yaml` include `packages/*`.
- [x] `turbo.json` valid + `turbo run lint` chạy.
- [x] 4 package mới (`config-eslint`, `config-typescript`, `shared-types`, `ui-tokens`) build sạch.
- [x] `pnpm --filter @ridex/shared-types test` xanh với 6+ test.
- [x] Backend `apps/backend` không ảnh hưởng — `pnpm test` backend vẫn 444 tests pass.
- [x] README ngắn `packages/README.md` giải thích structure.

## Prompt for Codex

Implement Task 011 đúng spec. Tạo monorepo scaffolding cho frontend: pnpm workspace + Turborepo + 4 packages (config-eslint, config-typescript, shared-types, ui-tokens). KHÔNG tạo app, KHÔNG động backend. Zod schemas cho auth, rides, drivers, payments, admin, common, events. ESLint preset 4 variants (base/next/expo/package). TS preset 4 variants. Design tokens Uber-like color palette. Vitest cho shared-types với 6+ test. Finish với Summary, Changed files, Tests run, Notes.
