# Mobile Driver Maestro

Regression coverage for the residual T019/T020 driver race conditions lives here.
The public testing seed endpoint is available only when `NODE_ENV != production`.

## Prerequisites

### macOS

```bash
brew tap mobile-dev-inc/tap
brew install maestro
```

### Linux

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

### Windows (PowerShell)

```powershell
iwr -useb https://get.maestro.mobile.dev/windows | iex
```

If PowerShell blocks the installer, run this first in the current user scope:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Or download the Maestro zip manually and add it to `PATH`.

JDK 17+ and Android SDK platform-tools must already be in `PATH`.

## Local app setup

```bash
cd ridex/apps/mobile-driver
pnpm expo prebuild --platform android
pnpm expo run:android
```

## Backend setup

```bash
cd ridex
pnpm --filter @ridex/backend start:dev
```

## Seed endpoint

Prepare identities only:

```bash
curl -X POST http://localhost:3000/api/v1/testing/seed-driver-offer \
  -H "Content-Type: application/json" \
  -d '{"mode":"prepare","testRunId":"demo-run","pickup":{"lat":10.77,"lng":106.70},"destination":{"lat":10.78,"lng":106.71}}'
```

Dispatch a real offer after the seeded driver is online:

```bash
curl -X POST http://localhost:3000/api/v1/testing/seed-driver-offer \
  -H "Content-Type: application/json" \
  -d '{"mode":"dispatch-offer","testRunId":"demo-run","pickup":{"lat":10.77,"lng":106.70},"destination":{"lat":10.78,"lng":106.71}}'
```

## Run flows

Pass the backend base URL explicitly. For the Android emulator this is usually `10.0.2.2`:

```bash
cd ridex/apps/mobile-driver
maestro test --env API_BASE_URL=http://10.0.2.2:3000/api/v1 .maestro/offer-leak-on-offline.yaml
maestro test --env API_BASE_URL=http://10.0.2.2:3000/api/v1 .maestro/complete-ride-redirect.yaml
```

## Cleanup

Seeded accounts use the `e2e-driver-*` and `e2e-customer-*` email prefixes.
Cleanup can be done with SQL against the local dev database:

```sql
DELETE FROM ledger_entries WHERE payment_id IN (
  SELECT id FROM payments WHERE ride_id IN (
    SELECT id FROM rides WHERE customer_id IN (
      SELECT id FROM users WHERE email LIKE 'e2e-customer-%@ridex.test'
    )
  )
);
DELETE FROM payments WHERE ride_id IN (
  SELECT id FROM rides WHERE customer_id IN (
    SELECT id FROM users WHERE email LIKE 'e2e-customer-%@ridex.test'
  )
);
DELETE FROM ride_offers WHERE driver_user_id IN (
  SELECT id FROM users WHERE email LIKE 'e2e-driver-%@ridex.test'
);
DELETE FROM rides WHERE customer_id IN (
  SELECT id FROM users WHERE email LIKE 'e2e-customer-%@ridex.test'
);
DELETE FROM drivers WHERE driver_id IN (
  SELECT id FROM users WHERE email LIKE 'e2e-driver-%@ridex.test'
);
DELETE FROM users WHERE email LIKE 'e2e-driver-%@ridex.test' OR email LIKE 'e2e-customer-%@ridex.test';
```
