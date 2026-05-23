# Task 022: Wallet + Payment History (Customer + Driver)

## Task Name

Implement Wallet screen + Payment/Earnings history trên customer & driver surfaces. Backend addons: `GET /me/wallet`, `GET /me/payments`, `GET /me/driver/earnings`.

## Goal

- Customer mở tab "Ví" → thấy balance VND + transaction history (rides paid).
- Driver mở tab "Thu nhập" → thấy balance + earnings history per ride + tổng theo ngày/tuần/tháng.
- Empty state thân thiện.
- Pagination 20/page.

## Context

- Backend Task 009 đã có `wallets`, `payments`, `ledger_entries`. PaymentsFacade exposes:
  - `getPaymentForRide(rideId)`
  - `getWalletForUser(userId, kind)`
- T021 admin dashboard đã consume aggregate. T022 cần per-user views.

## Backend addons cần thiết

### 1. `GET /me/wallet`
Auth: any authenticated user.
Response:
```json
{
  "data": {
    "kind": "CUSTOMER" | "DRIVER",
    "balanceVnd": 500000,
    "currency": "VND",
    "lastUpdatedAt": "2026-05-18T..."
  }
}
```
Logic: dựa role user → fetch wallet kind tương ứng (customer→CUSTOMER, driver→DRIVER). Nếu wallet chưa exist (edge case): return balance 0.

### 2. `GET /me/payments?page=1&pageSize=20`
Auth: customer or driver.
Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "rideId": "uuid",
      "totalVnd": 100000,
      "status": "SUCCEEDED",
      "createdAt": "...",
      "completedAt": "...",
      "rideSummary": { "pickupAddress": "...", "destinationAddress": "..." }
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 47 }
}
```
- Customer: trả về payment.customerUserId == self.
- Driver: trả về payment.driverUserId == self.
- Order DESC by createdAt.

### 3. `GET /me/driver/earnings?from=&to=`
Auth: driver only.
Response:
```json
{
  "data": {
    "windowFrom": "2026-05-11T00:00:00Z",
    "windowTo": "2026-05-18T00:00:00Z",
    "tripsCompleted": 23,
    "totalEarningsVnd": 1850000,
    "byDay": [
      { "date": "2026-05-17", "earnings": 280000, "trips": 4 }
    ]
  }
}
```
Aggregate sum `driver_share_vnd` from payments WHERE status=SUCCEEDED AND driver_user_id=self AND created_at BETWEEN.

### Tests cho backend addons
- Wallet me happy (customer + driver).
- Wallet me unauthenticated → 401.
- Payments me pagination.
- Payments me empty.
- Payments me chỉ self (customer A không thấy của B).
- Driver earnings happy.
- Earnings filter from/to.
- Driver earnings cho customer role → 403.

~10 backend tests.

## Scope

### Files FE

```
apps/web-customer/src/
  app/(app)/wallet/page.tsx
  components/wallet/
    balance-card.tsx
    transaction-list.tsx
    transaction-item.tsx
    empty-state.tsx
  hooks/
    use-wallet.ts
    use-payment-history.ts

apps/web-driver/src/
  app/(app)/earnings/page.tsx
  components/earnings/
    balance-card.tsx
    earnings-summary-card.tsx          # today / week / month tabs
    earnings-bar-chart.tsx             # simple recharts bar per day
    transaction-list.tsx
  hooks/
    use-earnings.ts
    use-payment-history.ts

apps/mobile-customer/
  app/(tabs)/wallet.tsx
  src/components/wallet/
    (same structure mobile)

apps/mobile-driver/
  app/(tabs)/earnings.tsx
  src/components/earnings/
    (same)
```

### Customer Wallet UX

```
┌──────────────────────────────┐
│ Ví RideX                      │
├──────────────────────────────┤
│  Số dư hiện tại               │
│                               │
│       500,000 ₫               │
│                               │
│  [Nạp tiền — defer]           │
├──────────────────────────────┤
│  Giao dịch gần đây            │
│                               │
│  ▼ Chuyến đi Bến Thành → TSN │
│     -84,701 ₫                 │
│     18/05/2026 12:30          │
│                               │
│  ▼ ...                        │
│                               │
│  [Xem thêm]                   │
└──────────────────────────────┘
```

### Driver Earnings UX

```
┌──────────────────────────────┐
│ Thu nhập                      │
├──────────────────────────────┤
│  [Hôm nay] [Tuần này] [Tháng]│
├──────────────────────────────┤
│       1,850,000 ₫             │
│       23 chuyến               │
│                               │
│  [Bar chart per day]          │
├──────────────────────────────┤
│  Chi tiết chuyến              │
│  ▼ Chuyến #abc                │
│     +67,761 ₫ (80%)           │
│     ...                       │
└──────────────────────────────┘
```

### Transaction item

- Customer view: pickup → destination summary, amount negative (debit), date.
- Driver view: pickup → destination, amount positive (credit driver share), date, badge "Hoàn thành".

### Pagination

Infinite scroll qua `useInfiniteQuery`:
```typescript
useInfiniteQuery({
  queryKey: ["payments", "me"],
  queryFn: ({ pageParam = 1 }) => paymentsApi.getMyPayments({ page: pageParam, pageSize: 20 }),
  getNextPageParam: (last) => last.meta.page * last.meta.pageSize < last.meta.total ? last.meta.page + 1 : undefined,
  initialPageParam: 1
});
```

### Empty state

Customer chưa có ride: "Đặt chuyến đầu tiên của bạn" + CTA Home.
Driver chưa có chuyến: "Bật trạng thái online để nhận chuyến" + CTA Home.

### Charts

Driver `earnings-bar-chart.tsx` dùng `recharts` (web) — bar per day, gradient brand. Mobile dùng `react-native-svg-charts` hoặc `victory-native`. Simple: 7 ngày gần nhất, height fix 160px.

## Out of Scope

- Topup wallet (theo spec Task 009: auto-seed only).
- Withdraw cash (driver payout flow).
- Tax invoice / receipt PDF.
- Currency conversion.
- Refund flow.
- Transaction filtering / search.
- Multi-currency.
- Export CSV.
- Tipping / bonus.

## Expected Files/Modules

~25 file (20 FE + 5 backend).

## Functional Requirements

- Customer wallet show balance + recent 20 transactions.
- Customer infinite scroll load more.
- Driver earnings 3 tabs (Today/Week/Month) load different range.
- Driver bar chart render 7 ngày.
- Empty state cho new user.
- Loading skeleton.
- Error retry.
- VND format vi-VN.
- Mobile pull-to-refresh.

## Security Requirements

- `/me/wallet`, `/me/payments`, `/me/driver/earnings` chỉ self.
- KHÔNG show `idempotency_key` hay platform IDs trên UI.
- KHÔNG show driver_user_id cho customer view.
- KHÔNG cache cross-user.
- Pagination: backend enforce max pageSize 100 (chống abuse).

## Database Requirements

- KHÔNG schema changes. Chỉ aggregate queries.
- `payments_customer_idx (customer_user_id, created_at DESC)` đã có (Task 009) — đủ cho /me/payments customer.
- `payments_driver_idx (driver_user_id, created_at DESC)` đã có — đủ cho driver.

## API/WebSocket Changes

- New REST: `/me/wallet`, `/me/payments`, `/me/driver/earnings`.

## Business Rules

- Customer view: amount negative (debit balance).
- Driver view: amount positive (credit balance).
- Driver share = `driver_share_vnd` from payment (đã computed Task 009).
- Date format: vi-VN locale.
- Driver earnings tabs:
  - Today: today 00:00 → now.
  - Week: last 7 days (rolling, không calendar week).
  - Month: last 30 days.
- Wallet balance từ `wallets` table (single source of truth, không re-aggregate ledger).

## Edge Cases

- Wallet balance âm: impossible (DB CHECK constraint Task 009). Defensive: render 0.
- Payment status FAILED: show in list với label "Lỗi thanh toán" + reason.
- Customer view 1 payment, driver view cùng payment: 2 cách render khác (customer thấy debit; driver thấy credit). Same payment ID.
- Large balance > 1B VND: format compact.
- Driver có 0 ride trong window: empty state + bar chart all zeros.
- Pagination edge: last page có thể < 20 items.

## Tests Required

- Backend addons (10 tests):
  - Wallet me customer + driver.
  - Wallet me 401.
  - Payments me customer only sees self.
  - Payments me pagination correct.
  - Driver earnings sum correct.
  - Driver earnings date filter.
  - Driver earnings customer role → 403.
- FE tests:
  - useWallet hook.
  - usePaymentHistory infinite scroll.
  - useEarnings tabs switch.
  - TransactionItem render customer vs driver.
- E2E:
  - Customer: home → wallet → see transactions.
  - Driver: home → earnings → tabs → bar chart.

Test target: ~20 tests.

## Acceptance Criteria

- [x] Customer wallet UI + history.
- [x] Driver earnings UI + tabs + chart.
- [x] Backend endpoints với auth + tests.
- [x] Pagination infinite scroll.
- [x] Empty states.
- [x] VND format đúng locale.
- [x] Mobile pull-to-refresh.
- [x] Lint + build + test xanh.

## Prompt for Codex

Implement Task 022. Backend addons: GET /me/wallet (self), /me/payments (paginated, self only), /me/driver/earnings (driver-only, date range). FE: customer wallet screen (balance + infinite scroll history), driver earnings (tabs today/week/month + bar chart + history). VND format vi-VN. Empty + loading + error states. Pull-to-refresh mobile. Tests backend self-only + pagination + earnings sum + FE hooks + E2E. Finish với Summary, Changed files, Tests run, Notes.
