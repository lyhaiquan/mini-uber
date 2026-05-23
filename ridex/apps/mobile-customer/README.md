# RideX Customer Mobile

## Lần đầu chạy (sau khi clone)

`@rnmapbox/maps` yêu cầu native code - KHÔNG chạy trong Expo Go.

1. Đặt `RNMAPBOX_DOWNLOAD_TOKEN` (Mapbox secret token `sk.*`) làm env trước khi prebuild:
   ```bash
   export RNMAPBOX_DOWNLOAD_TOKEN=sk.xxxxx
   ```
2. Generate native folders:
   ```bash
   pnpm --filter @ridex/mobile-customer exec expo prebuild --clean
   ```
3. EAS dev client build (chỉ cần 1 lần / mỗi platform):
   ```bash
   pnpm --filter @ridex/mobile-customer exec eas build --profile development --platform ios
   pnpm --filter @ridex/mobile-customer exec eas build --profile development --platform android
   ```
4. Cài dev client trên thiết bị qua QR / link, sau đó:
   ```bash
   pnpm --filter @ridex/mobile-customer start
   ```
   Mở app dev client, scan QR, app load.

## Environment

`app.json` -> `expo.extra.mapboxToken`: dùng public token `pk.*` (không phải `sk.*`).

Expo (React Native) customer app. Bundles a Stack navigator with `(auth)` and `(tabs)` route groups; tabs are Home / Trips / Wallet / Profile.

## Run

```bash
pnpm --filter @ridex/mobile-customer start
```

Press `i` for iOS simulator, `a` for Android emulator, `w` for the web preview.

## Networking

`Constants.expoConfig.extra.apiBaseUrl` defaults to `http://localhost:3000/api/v1`. That works only inside the iOS simulator. To reach a backend on your dev machine from:

- **Android emulator** — swap to `http://10.0.2.2:3000/api/v1`.
- **Physical phone on the same Wi-Fi** — swap to `http://<your-LAN-ip>:3000/api/v1` and start backend with `HOST=0.0.0.0`.

Either edit `app.json > expo.extra` or use the `app.config.ts` / `EXPO_PUBLIC_*` approach added in T016.

## Lint / type-check / test

```bash
pnpm --filter @ridex/mobile-customer lint
pnpm --filter @ridex/mobile-customer type-check
pnpm --filter @ridex/mobile-customer test
```

## Mapbox setup (T015)

1. Register at <https://account.mapbox.com> (free tier: 50K loads/month).
2. Copy your public token (starts with `pk.`).
3. In `app.json`:
   - Set `expo.extra.mapboxToken` to that token (runtime usage).
   - Replace the `RNMapboxMapsDownloadToken` placeholder in the `@rnmapbox/maps` plugin entry (download-time auth, can be a secret `sk.` token restricted to "Downloads:Read" if preferred).
4. Restrict the token to your bundle ID (`com.ridex.customer`) and web origins in the Mapbox dashboard.
5. `@rnmapbox/maps` requires native code. **Expo Go won't work** — run a dev client:
   ```bash
   pnpm --filter @ridex/mobile-customer exec expo prebuild --clean
   # then EAS build a dev client, or build locally for Android:
   pnpm --filter @ridex/mobile-customer exec expo run:android
   ```

## Notes

- New Architecture (`newArchEnabled: true`) is on by default.
- HTTP cleartext is whitelisted for dev only; production must require HTTPS.
- Mapbox token wired in T015 (above).
