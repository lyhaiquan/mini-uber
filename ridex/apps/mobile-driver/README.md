# RideX Driver Mobile

## Lần đầu chạy (sau khi clone)

`@rnmapbox/maps` yêu cầu native code - KHÔNG chạy trong Expo Go.

1. Đặt `RNMAPBOX_DOWNLOAD_TOKEN` (Mapbox secret token `sk.*`) làm env trước khi prebuild:
   ```bash
   export RNMAPBOX_DOWNLOAD_TOKEN=sk.xxxxx
   ```
2. Generate native folders:
   ```bash
   pnpm --filter @ridex/mobile-driver exec expo prebuild --clean
   ```
3. EAS dev client build (chỉ cần 1 lần / mỗi platform):
   ```bash
   pnpm --filter @ridex/mobile-driver exec eas build --profile development --platform ios
   pnpm --filter @ridex/mobile-driver exec eas build --profile development --platform android
   ```
4. Cài dev client trên thiết bị qua QR / link, sau đó:
   ```bash
   pnpm --filter @ridex/mobile-driver start
   ```
   Mở app dev client, scan QR, app load.

## Environment

`app.json` -> `expo.extra.mapboxToken`: dùng public token `pk.*` (không phải `sk.*`).

Expo (React Native) driver app. Tabs: Home / Trips / Earnings / Profile.

## Run

```bash
pnpm --filter @ridex/mobile-driver start
```

## Mapbox setup (T015)

Same as `mobile-customer`. Restrict the token to bundle ID `com.ridex.driver`. Set:
- `app.json > expo.extra.mapboxToken` (runtime).
- `app.json > expo.plugins > @rnmapbox/maps > RNMapboxMapsDownloadToken` (download-time).

`@rnmapbox/maps` needs a dev client (no Expo Go support):

```bash
pnpm --filter @ridex/mobile-driver exec expo prebuild --clean
pnpm --filter @ridex/mobile-driver exec expo run:android
```

## Notes

- Bundle identifier: `com.ridex.driver`. Scheme: `ridex-driver`. Runs on port 8082 to avoid collision with customer app.
- Networking conventions same as `mobile-customer` (see that README for iOS sim vs Android emu vs physical phone host setup).
- Driver app needs background-location capability in a later task (T019) — current shell only runs in foreground.
