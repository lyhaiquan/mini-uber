# @ridex/mobile-customer

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

## Notes

- New Architecture (`newArchEnabled: true`) is on by default.
- HTTP cleartext is whitelisted for dev only; production must require HTTPS.
- Mapbox token is empty in `app.json` — wired in T015.
