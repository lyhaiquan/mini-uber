# Task 013: Mobile Shells (Customer + Driver Expo Apps)

## Task Name

Tạo 2 Expo (React Native) app skeleton: `mobile-customer`, `mobile-driver`. Cài expo-router, NativeWind v4, secure storage, theme provider, placeholder screen. Không implement business logic.

## Goal

Cho phép developer chạy Expo dev server cho 2 app, mỗi app render placeholder navigation stack (Home + Profile placeholder), share design tokens với web qua NativeWind, theme switching, secure storage helpers sẵn sàng cho T014 auth.

## Context

- T011 tạo `ui-tokens`. T013 tạo `packages/ui-mobile` cho RN primitives (Button, Card, Input...).
- Expo SDK 52+ (latest stable matching React Native 0.76+). Bridgeless mode + New Architecture default.
- Locked decisions: Expo managed workflow, expo-router v4, NativeWind v4, react-native-reanimated, expo-secure-store, expo-localization, react-native-mmkv (fast key-value store), expo-image cho image rendering.

## Scope

### Files / folders

```
apps/
  mobile-customer/
    package.json                       # @ridex/mobile-customer
    app.json                           # name, slug, scheme, icon, splash
    tsconfig.json                      # extends @ridex/config-typescript/expo.json
    .eslintrc.js
    babel.config.js                    # nativewind preset + reanimated
    metro.config.js                    # nativewind config
    tailwind.config.ts                 # extends ui-tokens preset
    app/                               # expo-router (file-based)
      _layout.tsx                      # root layout, ThemeProvider, Stack navigator
      index.tsx                        # landing screen
      (auth)/                          # group cho login/register (T014)
        _layout.tsx
        login.tsx                      # placeholder
      (tabs)/                          # main app tabs sau auth
        _layout.tsx                    # Tabs navigator: Home / Trips / Wallet / Profile
        home.tsx
        trips.tsx
        wallet.tsx
        profile.tsx
      +not-found.tsx
    src/
      lib/
        env.ts                         # Zod-validated env
        secure-storage.ts              # wrap expo-secure-store
        theme.ts                       # useColorScheme + tokens
      components/
        screen-container.tsx           # safe-area wrapper
    assets/
      icon.png                         # 1024x1024 placeholder
      splash.png
      adaptive-icon.png
  mobile-driver/                       # same structure, scheme "ridex-driver"
packages/
  ui-mobile/
    package.json                       # @ridex/ui-mobile
    tsconfig.json
    src/
      components/
        button.tsx                     # Pressable + variants
        card.tsx                       # View với shadow
        input.tsx                      # TextInput styled
        text.tsx                       # Text với variants
        screen.tsx                     # safe-area + scroll
        toast.tsx                      # via react-native-toast-message hoặc custom
        sheet.tsx                      # bottom sheet via @gorhom/bottom-sheet
        divider.tsx
      hooks/
        use-toast.ts
        use-theme.ts
      index.ts
```

### NativeWind setup

NativeWind v4 dùng Tailwind CSS classes trên RN. Setup:
- `babel.config.js` thêm `"nativewind/babel"` plugin.
- `metro.config.js` wrap `withNativeWind`.
- `tailwind.config.ts` content scan: `["./app/**/*.{ts,tsx}", "../../packages/ui-mobile/src/**/*.{ts,tsx}"]`.
- `app/_layout.tsx` import `"../global.css"` (Tailwind directives).

Tokens share giữa NativeWind config + web Tailwind config qua `@ridex/ui-tokens` preset.

### expo-router structure

File-based routing, mỗi `.tsx` trong `app/` là 1 screen. `_layout.tsx` define navigator (Stack hoặc Tabs).

`app/_layout.tsx`:
```tsx
import { Stack } from "expo-router";
import { ThemeProvider } from "@/src/lib/theme";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}
```

`app/(tabs)/_layout.tsx`:
```tsx
import { Tabs } from "expo-router";
export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="home" options={{ title: "Trang chủ" }} />
      <Tabs.Screen name="trips" options={{ title: "Chuyến đi" }} />
      <Tabs.Screen name="wallet" options={{ title: "Ví" }} />
      <Tabs.Screen name="profile" options={{ title: "Tôi" }} />
    </Tabs>
  );
}
```

Driver app: tabs `Home / Trips / Earnings / Profile`.

### Secure storage wrapper

`src/lib/secure-storage.ts`:
```typescript
import * as SecureStore from "expo-secure-store";

const KEYS = ["accessToken", "refreshToken", "userId", "userRole"] as const;
export type StorageKey = typeof KEYS[number];

export const secureStorage = {
  async get(key: StorageKey): Promise<string | null> { return SecureStore.getItemAsync(key); },
  async set(key: StorageKey, value: string): Promise<void> {
    if (value.length > 2048) throw new Error("secure-storage: value too large");
    return SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED });
  },
  async remove(key: StorageKey): Promise<void> { return SecureStore.deleteItemAsync(key); },
  async clear(): Promise<void> { await Promise.all(KEYS.map((k) => SecureStore.deleteItemAsync(k))); }
};
```

### Env validation

`src/lib/env.ts` mỗi app, dùng `expo-constants`:
```typescript
import Constants from "expo-constants";
import { z } from "zod";
const schema = z.object({
  apiBaseUrl: z.string().url(),
  wsUrl: z.string().url(),
  mapboxToken: z.string().min(20).optional()
});
export const env = schema.parse(Constants.expoConfig?.extra ?? {});
```

`app.json` `extra`:
```json
{
  "extra": {
    "apiBaseUrl": "http://localhost:3000/api/v1",
    "wsUrl": "http://localhost:3000",
    "mapboxToken": "pk.your-token"
  }
}
```

Hoặc `.env` + `expo-env`. Note: trên simulator iOS `localhost` work; trên Android emulator phải dùng `10.0.2.2`; trên physical device cần dùng IP máy dev. Document trong README.

### Theme

Light / dark via `useColorScheme()` từ RN + override manual. `next-themes` không có cho RN, dùng Zustand store nhỏ trong `src/lib/theme.ts`.

### Landing screen

`app/index.tsx` customer:
- Logo RideX center top.
- Headline "Đi đâu cũng có RideX" + sub-headline.
- 2 CTA button: "Đặt xe" → `/(auth)/login`, "Tạo tài khoản" → `/(auth)/register`.

Tương tự cho driver.

## Out of Scope

- Auth screens (T014).
- Map integration (T015) — note `@rnmapbox/maps` cần custom dev client; expo managed workflow cần `EAS Build` hoặc dev client tự build. Plan trong T015.
- API integration (T016).
- Push notification.
- Deep linking beyond Expo defaults.
- Biometric auth (Face ID / fingerprint).
- Offline storage / SQLite.
- Animations beyond basic.

## Expected Files/Modules

~30 file. 2 app skeleton + 1 package mới (ui-mobile).

## Functional Requirements

- `pnpm --filter @ridex/mobile-customer expo start` mở Metro bundler.
- iOS simulator load app, render landing screen.
- Android emulator load app cùng kết quả.
- Tab navigation hoạt động (Home/Trips/Wallet/Profile).
- Dark mode reflect system setting + override manual.
- Secure-store round-trip work (set → get → remove).
- Hot reload Metro work.

## Security Requirements

- Mapbox token KHÔNG hard-code (env-based).
- Secure-store dùng `WHEN_UNLOCKED` keychain access level.
- KHÔNG dùng AsyncStorage cho token.
- Network security:
  - iOS: `app.json` cho phép `localhost` HTTP qua `usesCleartextTraffic` + ATS exception cho dev.
  - Android: `usesCleartextTraffic: true` cho dev only.
  - Production sẽ require HTTPS — flag để T011-23 (deploy).

## Database Requirements

KHÔNG.

## API/WebSocket Changes

KHÔNG.

## Business Rules

- Mỗi app 1 bundle identifier riêng: `com.ridex.customer`, `com.ridex.driver`.
- 2 app share `packages/ui-mobile` + `packages/ui-tokens`.
- Không cross-import giữa 2 mobile app.

## Edge Cases

- Mất kết nối WiFi: app vẫn load placeholder, không crash.
- iOS simulator vs Android emulator host khác nhau (localhost vs 10.0.2.2) — document trong README mỗi app.
- Bridgeless mode RN 0.76: một số package có thể chưa support — verify với Expo doctor.

## Tests Required

- Jest unit test cho `secure-storage.ts` wrapper (mock expo-secure-store):
  - `set + get` round-trip.
  - `set` với value quá 2048 chars throw.
  - `clear` xóa hết keys.
- Jest unit test cho `env.ts`:
  - Schema parse success + fail cases.
- Component test cho Button qua `@testing-library/react-native` (~2 tests).
- Maestro E2E (defer cho T025) hoặc Detox — chỉ skeleton, không chạy CI cho T013.

Test target: ~8 tests (Jest only).

## Acceptance Criteria

- [x] `expo start` chạy ổn cả 2 app.
- [x] iOS sim + Android emu render placeholder.
- [x] Tab navigation work.
- [x] Dark mode toggle reflect.
- [x] Secure-store wrapper unit test xanh.
- [x] Lint + type check sạch.
- [x] README mỗi app document cách run trên sim/emu/physical device.
- [x] `app.json` icon/splash placeholder.

## Prompt for Codex

Implement Task 013 đúng spec. Tạo 2 Expo apps (mobile-customer port 8081, mobile-driver port 8082) + `packages/ui-mobile`. expo-router v4 với (auth) và (tabs) route groups. NativeWind v4 extending @ridex/ui-tokens. Secure storage wrapper qua expo-secure-store. Env validation Zod. Landing placeholder + tab navigation. Jest unit cho storage/env/button. KHÔNG implement auth/map/api. Document iOS vs Android localhost handling. Finish với Summary, Changed files, Tests run, Notes.
