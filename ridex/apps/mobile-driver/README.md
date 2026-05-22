# @ridex/mobile-driver

Expo (React Native) driver app. Tabs: Home / Trips / Earnings / Profile.

## Run

```bash
pnpm --filter @ridex/mobile-driver start
```

## Notes

- Bundle identifier: `com.ridex.driver`. Scheme: `ridex-driver`. Runs on port 8082 to avoid collision with customer app.
- Networking conventions same as `mobile-customer` (see that README for iOS sim vs Android emu vs physical phone host setup).
- Driver app needs background-location capability in a later task (T019) — current shell only runs in foreground.
