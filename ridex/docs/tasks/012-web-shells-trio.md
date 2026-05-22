# Task 012: Web Shells Trio (Customer / Driver / Admin Next.js)

## Task Name

Tạo 3 Next.js 15 (App Router) app skeleton: `web-customer`, `web-driver`, `web-admin`. Cài shadcn/ui registry, layout shell, theme provider, route group, placeholder page. KHÔNG implement business logic.

## Goal

Cho phép developer chạy `pnpm dev` và mở 3 app trên 3 port khác nhau, mỗi app render placeholder page với layout shell (header + main + footer), dark mode toggle, shared Tailwind tokens từ `@ridex/ui-tokens`. Tasks sau (T014+) build trên 3 shell này.

## Context

- T011 đã tạo `packages/ui-tokens`. T012 tạo `packages/ui-web` cho shadcn/ui components share giữa 3 app.
- Tách 3 app riêng (không SSO sub-domain trong scope thesis) — mỗi app có domain hint riêng: customer.localhost:3001, driver.localhost:3002, admin.localhost:3003.
- Locked decisions: Next.js 15 App Router, React 18.3 (defer React 19 vì shadcn registry + ecosystem peer chưa stable cho thesis scope), Tailwind v3.4 (defer v4 vì @ridex/ui-tokens preset chưa port qua `@theme` directive), shadcn/ui copy-paste model (không import từ npm), next-themes cho dark mode.

## Scope

### Files / folders

```
apps/
  web-customer/
    package.json                       # @ridex/web-customer
    next.config.ts
    tsconfig.json                      # extends @ridex/config-typescript/nextjs.json
    .eslintrc.js                       # extends @ridex/config-eslint/next
    tailwind.config.ts                 # extends @ridex/ui-tokens preset
    postcss.config.mjs
    src/
      app/
        layout.tsx                     # root layout, ThemeProvider, font, metadata
        page.tsx                       # landing placeholder "RideX Customer"
        (auth)/                        # route group cho login/register sau (T014)
          layout.tsx                   # auth-specific layout (centered card)
        (app)/                         # route group cho authenticated screens
          layout.tsx                   # header + nav, container
          home/page.tsx                # placeholder
        not-found.tsx
        error.tsx
        globals.css                    # Tailwind directives + CSS vars
      lib/
        env.ts                         # validate public env vars qua Zod
        cn.ts                          # clsx + tailwind-merge helper
      components/
        theme-provider.tsx             # wraps next-themes
        site-header.tsx                # logo + nav + theme toggle + auth menu placeholder
        site-footer.tsx
    public/
      logo.svg
  web-driver/                          # same structure, port 3002
  web-admin/                           # same structure, port 3003
packages/
  ui-web/
    package.json                       # @ridex/ui-web
    tsconfig.json
    src/
      components/                      # shadcn-style primitives
        button.tsx
        card.tsx
        input.tsx
        label.tsx
        dialog.tsx
        toast.tsx
        toaster.tsx
        dropdown-menu.tsx
        skeleton.tsx
        badge.tsx
        avatar.tsx
        sonner.tsx                     # toast notification (sonner library)
      hooks/
        use-toast.ts
      index.ts
```

### shadcn/ui setup

Trong từng app, chạy `npx shadcn@latest init` 1 lần, sau đó components copy vào `packages/ui-web/src/components/`. Mỗi app import `import { Button } from "@ridex/ui-web"`.

Style: light + dark (CSS vars). Primary color = `colors.primary.500` từ ui-tokens. Border radius = 0.5rem (Uber-flat-ish).

### Theme provider

`next-themes` wrapped trong `app/layout.tsx`. Default `system`, toggle qua `ThemeToggle` component trong header.

### Port configuration

`package.json` mỗi app:
```json
{
  "scripts": {
    "dev": "next dev --turbo --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "lint": "next lint"
  }
}
```

Customer: 3001. Driver: 3002. Admin: 3003. Backend đang chạy 3000 (hoặc 3099 cho smoke).

### Env validation

`src/lib/env.ts` mỗi app:
```typescript
import { z } from "zod";
const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_WS_URL: z.string().url(),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().min(20).optional()  // optional cho T012, required T015
});
export const env = envSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN
});
```

`.env.local.example` mỗi app:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3000
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-token-here
```

### Landing pages

- `web-customer/page.tsx`: hero "Đi đâu cũng có RideX" + CTA "Đặt xe ngay" → link `/login`.
- `web-driver/page.tsx`: hero "Trở thành tài xế RideX" + CTA "Đăng nhập tài xế".
- `web-admin/page.tsx`: minimal login redirect "Admin Console" + CTA "Đăng nhập quản trị".

Không cần image, dùng gradient + typography từ tokens.

## Out of Scope

- Auth screens (T014).
- Map integration (T015).
- Real API calls (T016).
- Form validation (T014).
- i18n setup (defer hoặc minimal placeholder).
- Storybook.
- Image optimization beyond default.
- SEO meta beyond title/description.
- Analytics.

## Expected Files/Modules

~35 file mới. 3 app + 1 package + landing + layout + 10 shadcn primitives.

## Functional Requirements

- `pnpm dev` chạy 3 app cùng lúc (qua Turborepo `dev --parallel`).
- Mở `localhost:3001`, `3002`, `3003` render landing page.
- Dark mode toggle hoạt động, persist qua reload.
- 404 page render qua `not-found.tsx`.
- Lỗi runtime render qua `error.tsx`.
- Tailwind compile sạch, không warnings.
- TypeScript strict mode pass.

## Security Requirements

- KHÔNG có API key hard-code (Mapbox token sẽ env-based ở T015).
- `next.config.ts` không expose internal env vars qua build-time (`NEXT_PUBLIC_*` only client-side).
- `error.tsx` không leak stack trace ra UI production (Next.js default).

## Database Requirements

KHÔNG.

## API/WebSocket Changes

KHÔNG. T012 chưa gọi backend.

## Business Rules

- Mỗi app độc lập, không cross-import giữa 3 apps.
- shadcn components ở `@ridex/ui-web`, KHÔNG copy paste 3 lần.
- Theme tokens lấy từ `@ridex/ui-tokens`, không hard-code màu trong app code.

## Edge Cases

- Theme toggle khi JS chưa load: dùng `next-themes` flicker-prevention script.
- Server-side render landing page: phải work không cần backend chạy.
- Tailwind purge: phải scan paths trong `packages/ui-web` để không tree-shake nhầm.

## Tests Required

- Smoke E2E qua Playwright (tạo `apps/web-customer/e2e/landing.spec.ts`):
  - Load `/` → header + hero visible.
  - Click theme toggle → `html.dark` class apply.
  - Click "Đặt xe" → navigate `/login` (404 sẽ pass tạm vì T014 chưa làm route đó — accept 404 cho T012).
- Mỗi app 1 smoke test cùng pattern.
- Vitest unit test cho `cn.ts` helper (~3 tests).

Test target: ~9 tests (3 E2E + 3 per-app smoke + 3 unit).

## Acceptance Criteria

- [x] `pnpm dev` start 3 app, mỗi app accessible.
- [x] Lint + build + test xanh.
- [x] Dark mode toggle persist.
- [x] shadcn/ui Button, Card, Input render đúng tokens.
- [x] Tailwind config extends `@ridex/ui-tokens` preset.
- [x] Bundle size landing < 200KB gzipped (Next.js default ổn).
- [x] Lighthouse landing page ≥ 90 ở Performance + Accessibility (chạy local).

## Prompt for Codex

Implement Task 012 đúng spec. Tạo 3 Next.js 15 (App Router) apps + `packages/ui-web` với 10 shadcn primitives. Dark mode qua next-themes. Tailwind extends `@ridex/ui-tokens`. Landing placeholder per app. Playwright smoke E2E + Vitest unit. KHÔNG implement auth/map/API. Cổng 3001/3002/3003. Finish với Summary, Changed files, Tests run, Notes.
