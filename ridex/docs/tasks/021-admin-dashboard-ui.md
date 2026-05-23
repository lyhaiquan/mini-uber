# Task 021: Admin Dashboard UI

## Task Name

Implement web-admin dashboard consume `GET /admin/dashboard/summary` (Task 010): cards metrics, auto-refresh, role-gated, placeholder skeleton. KHÔNG cần mobile-admin (out of scope).

## Goal

Admin login → admin layout với sidebar + top bar → `/dashboard` page → grid 4 sections (Rides, Drivers, Payments, Placeholders) hiển thị số liệu từ backend Task 010. Auto-refresh mỗi 30s. Loading skeleton + error retry.

## Context

- Backend Task 010 endpoint `GET /admin/dashboard/summary` đã verified hoạt động (live smoke test).
- T012 đã có web-admin shell.
- T014 đã có auth login. T016 đã có api-client + TanStack Query.
- Admin chỉ có ADMIN role; non-admin login redirect / về login.

## Scope

### Files

```
apps/web-admin/src/
  app/(app)/
    layout.tsx                         # update: sidebar + top bar
    dashboard/
      page.tsx                         # main dashboard
    rides/page.tsx                     # placeholder list (defer T024)
    drivers/page.tsx                   # placeholder
    payments/page.tsx                  # placeholder
  components/admin/
    metric-card.tsx                    # label + big number + sub
    rides-section.tsx
    drivers-section.tsx
    payments-section.tsx
    placeholder-section.tsx
    last-updated-pill.tsx              # show "Cập nhật 5s trước"
    sidebar.tsx
    top-bar.tsx
  hooks/
    use-dashboard-summary.ts           # TanStack Query với refetchInterval 30s
  lib/
    format.ts                          # VND format, number compact
```

### Sidebar nav

```
Logo RideX Admin
├─ Tổng quan       /dashboard           ← active T021
├─ Chuyến đi        /rides              placeholder
├─ Tài xế           /drivers            placeholder
├─ Thanh toán       /payments           placeholder
└─ Đăng xuất                            POST /api/auth/logout
```

### Dashboard layout

```
┌─────────────────────────────────────────────────┐
│ Tổng quan vận hành          [Cập nhật 5s trước]│
├─────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐              │
│ │  Chuyến đi   │ │  Tài xế      │              │
│ │  Active:  7  │ │  Online: 23  │              │
│ │  24h:  142   │ │  Total: 95   │              │
│ │  Hủy:  11    │ │              │              │
│ └──────────────┘ └──────────────┘              │
│ ┌──────────────────────────────┐                │
│ │  Thanh toán                  │                │
│ │  Doanh thu 24h: 4,250,000 ₫  │                │
│ │  Doanh thu all-time: 18.75M ₫│                │
│ │  Thành công: 138 / Lỗi: 6    │                │
│ └──────────────────────────────┘                │
│ ┌──────────────────────────────┐                │
│ │  Placeholders                │                │
│ │  ⏳ Matching duration:        │                │
│ │     (sẽ có sau)              │                │
│ │  ⏳ Fraud alerts:             │                │
│ │     (sẽ có sau)              │                │
│ └──────────────────────────────┘                │
└─────────────────────────────────────────────────┘
```

### MetricCard component

```tsx
type MetricCardProps = {
  title: string;
  metrics: Array<{ label: string; value: string | number; emphasis?: boolean }>;
  badge?: string;
  loading?: boolean;
};
```

Big number cho first emphasis metric. Smaller list cho rest.

### Auto-refresh

`useDashboardSummary` query với `refetchInterval: 30_000` + `refetchOnWindowFocus: true`. Last updated pill compute from `dataUpdatedAt`.

### Format helpers

```typescript
export const formatVND = (n: number) => new Intl.NumberFormat("vi-VN", {
  style: "currency", currency: "VND", maximumFractionDigits: 0
}).format(n);

export const formatCompactVND = (n: number) => {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M ₫`;
  if (n >= 1_000) return `${(n/1_000).toFixed(0)}K ₫`;
  return formatVND(n);
};

export const formatNumber = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
```

### Empty state

Khi all counts == 0 (system mới setup): "Chưa có dữ liệu vận hành. Khi customer / driver bắt đầu sử dụng, số liệu sẽ xuất hiện ở đây."

### Error state

Network error → error card với retry button. 401 → redirect login (handled by api-client). 403 (non-admin somehow) → redirect login với toast "Cần quyền quản trị".

### Loading skeleton

Khi loading: 4 card skeleton qua shadcn `Skeleton` component.

## Out of Scope

- Charts / time-series visualization (defer phase observability).
- List endpoints (rides, drivers, payments pages chỉ placeholder).
- Filtering / time range picker.
- Export CSV.
- Real-time WS updates (chỉ polling 30s).
- Multi-tenant support.
- Audit log viewer (defer audit module).
- Admin actions (cancel ride, ban user, etc.) — defer T024+.
- Mobile-admin app.
- i18n EN (VN only).

## Expected Files/Modules

~12 file FE.

## Functional Requirements

- Admin login → redirect /dashboard.
- Dashboard render < 1s sau login.
- Auto-refresh 30s.
- Last updated pill update real-time.
- Format VND đúng locale vi-VN.
- 4 sections luôn render (placeholders với label "Sẽ có sau").
- Non-admin → 403 → redirect.
- Loading skeleton trên initial.
- Empty system → empty state message.

## Security Requirements

- Page-level role guard: middleware kiểm role ADMIN qua cookie hoặc API call.
- API client tự attach JWT (T016).
- KHÔNG show individual user IDs / emails trên dashboard.
- KHÔNG log dashboard data vào console hay analytics.

## Database Requirements

KHÔNG.

## API/WebSocket Changes

KHÔNG.

## Business Rules

- Refresh interval 30s default (configurable trong env nếu cần).
- Placeholder sections luôn show với label "Tính năng sắp ra mắt" để không gây nhầm "data thiếu".
- VND format đúng locale, không có ".00".

## Edge Cases

- Backend trả `placeholders.matchingDurationMs.value: number` (future Task 023): UI render real value thay placeholder text.
- Window inactive >5 phút: pause refetch (TanStack Query auto).
- Multi-tab: mỗi tab fetch riêng (OK).
- Admin logout từ tab khác: cookie cleared → next refetch 401 → redirect.
- Backend slow (>3s): show "Đang tải..." không freeze.

## Tests Required

- Component tests:
  - MetricCard render emphasis.
  - RidesSection display metrics.
  - LastUpdatedPill compute time.
  - Format helpers VND.
- Hook test:
  - useDashboardSummary refetchInterval 30s.
- E2E:
  - Admin login → dashboard load → verify data.
  - Non-admin login → redirect.
  - Logout → redirect login.

Test target: ~12 tests.

## Acceptance Criteria

- [x] Admin login → dashboard với 4 sections.
- [x] Auto-refresh 30s.
- [x] VND format vi-VN.
- [x] Loading + error + empty states.
- [x] Role guard ADMIN.
- [x] Placeholder sections rõ ràng.
- [x] Lint + build + test xanh.

## Prompt for Codex

Implement Task 021. Web-admin dashboard consume GET /admin/dashboard/summary. 4 metric cards (rides, drivers, payments, placeholders). Auto-refresh 30s TanStack Query. Last updated pill. VND format vi-VN. Sidebar nav + top bar. Role guard ADMIN qua middleware. Loading skeleton + error retry + empty state. Placeholder rides/drivers/payments pages stub. Tests components + hooks + E2E. Finish với Summary, Changed files, Tests run, Notes.
