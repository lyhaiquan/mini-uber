# @ridex/mobile-driver

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
