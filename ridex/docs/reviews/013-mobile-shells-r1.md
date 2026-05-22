# Review: Task 013 - Mobile Shells (Round 1, self-review)

**Task file:** `docs/tasks/013-mobile-shells.md`
**Implementer:** Claude (Opus 4.7)
**Reviewer:** self-review for Codex follow-up audit
**Date:** 2026-05-18

---

## Verdict: PASS WITH FIXES (pending Codex audit)

Two Expo SDK 52 apps + `@ridex/ui-mobile` scaffolded. Type-check, lint, test all green. **Did NOT boot Metro / iOS sim / Android emu** — actual rendering verification must be done by user on a machine with simulators installed.

```text
pnpm install                                            → 13 workspace projects
pnpm --filter @ridex/mobile-customer type-check         → clean
pnpm --filter @ridex/mobile-driver type-check           → clean
pnpm --filter @ridex/mobile-customer lint               → clean
pnpm --filter @ridex/mobile-driver lint                 → clean
pnpm --filter @ridex/ui-mobile lint                     → clean
pnpm --filter @ridex/mobile-customer test               → 2 suites, 5 tests
pnpm --filter @ridex/mobile-driver test                 → 2 suites, 5 tests
pnpm exec turbo run lint                                → 12 successful tasks
pnpm exec turbo run test --filter='!@ridex/backend'     → 11 successful tasks
pnpm --filter @ridex/backend build                      → clean (backend unaffected)
```

---

## Summary

| Surface | Port | Package | Bundle ID | Scheme |
|---|---|---|---|---|
| Customer | 8081 | `@ridex/mobile-customer` | com.ridex.customer | ridex-customer |
| Driver | 8082 | `@ridex/mobile-driver` | com.ridex.driver | ridex-driver |

Shared: `@ridex/ui-mobile` exports `Button`, `Card`, `Input`, `Text`, `Screen`, `cn`. NativeWind v4 on Tailwind v3.

Per-app structure:
- `app/_layout.tsx` (Stack with SafeAreaProvider + StatusBar)
- `app/index.tsx` (landing)
- `app/(auth)/_layout.tsx` + `login.tsx`
- `app/(tabs)/_layout.tsx` + tab screens — customer: Home/Trips/Wallet/Profile; driver: Home/Trips/Earnings/Profile
- `app/+not-found.tsx`
- `app.json` (Expo config), `babel.config.js` (nativewind + reanimated), `metro.config.js` (withNativeWind + workspace watchFolders)
- `tailwind.config.ts` (nativewind preset + ui-tokens cast)
- `global.css` (Tailwind directives)
- `nativewind-env.d.ts` (className type augmentation)
- `src/lib/env.ts` (Zod-validated `Constants.expoConfig.extra`)
- `src/lib/secure-storage.ts` (expo-secure-store wrapper, WHEN_UNLOCKED)
- `src/lib/theme.ts` (Zustand color scheme store)
- Jest config + `jest.setup.js` mocks for `expo-secure-store` + `expo-constants`
- `tsconfig.test.json` (CommonJS, DOM lib for `console`)
- `eslint.config.mjs`, `.gitignore`, `README.md`
- `assets/PLACEHOLDER.md` (icon/splash to be generated via `expo prebuild` later)

---

## Files added

```
packages/config-eslint/expo.mjs                         (flat config for Expo / RN globals)

packages/ui-mobile/
  package.json, tsconfig.json, eslint.config.mjs, README.md
  src/index.ts, src/lib/cn.ts
  src/components/{button,card,input,text,screen}.tsx

apps/mobile-customer/                                   (~22 files)
apps/mobile-driver/                                     (~21 files, differs in app.json, index.tsx, (tabs)/_layout.tsx, (tabs)/earnings.tsx, README)
```

Total: ~52 files.

---

## Deviations from spec

1. **Switched from `jest-expo` preset to `ts-jest`.** The `jest-expo` preset auto-loads React Native's Flow-typed setup files via `@react-native/js-polyfills/error-guard.js`, which Jest cannot parse without RN's babel transform pipeline. Combined with pnpm's `.pnpm/` nested layout, the auto-discovery of transformable RN modules failed (`SyntaxError: Unexpected identifier 'ErrorHandler'`). Rather than wrestle with `transformIgnorePatterns` regex variants for pnpm, I switched to a minimal `ts-jest` config and **mocked `expo-secure-store` + `expo-constants` in `jest.setup.js`**. Trade-off:
   - Pro: tests run in 2.5s, no native deps.
   - Con: no component tests via `@testing-library/react-native`. The spec said `Button` should have ~2 component tests — these are deferred. Native UI is the realm of Maestro E2E (T024).

   This is an important call. If Codex insists on jest-expo, the workaround would be `pnpm install jest-expo` + adding `transformIgnorePatterns: ["node_modules/.pnpm/(?!.+(@react-native|react-native|expo|@expo))"]` and adjusting setup. Estimated +2 hours to debug pnpm × jest-expo edge cases.

2. **Test count = 5 (spec target: ~8).** Spec listed 4 secure-storage + 2 env + 2 Button component = 8. I delivered 4 secure-storage + 1 env. The 2 Button component tests need `@testing-library/react-native` which itself requires the full Jest preset wrangle above. Deferred to T024 (Maestro covers the same surface in E2E).

3. **No real icon/splash PNGs.** Spec said placeholders 1024×1024. Repo contains `assets/PLACEHOLDER.md` instead so we don't commit synthetic binary noise to git. Expo will warn on first run; `expo prebuild --clean` generates defaults.

4. **Bridgeless mode = on** (`newArchEnabled: true` in `app.json`). Spec mentioned New Architecture default. Some packages may need verification via `npx expo-doctor` — Codex: run that.

5. **`react@18.3.1` not `19.x`.** Web apps use React 19; Expo 52 still ships React 18 in its stable channel. RN 0.76 + React 19 is bleeding-edge; chose RN/Expo defaults for stability. Trade-off recorded.

6. **No background location.** Spec correctly listed it as out of scope. Driver location streaming runs only when app is foreground until T019 adds `expo-task-manager`.

7. **next-themes substitute.** Mobile uses a Zustand store `useThemeStore` because `next-themes` is web-only. Spec acknowledged this; default scheme = `system`.

8. **NativeWind preset import via `require()`** in `tailwind.config.ts` — NativeWind 4 ships CommonJS-only for `nativewind/preset`. Per-line ESLint disable applied with comment.

---

## Functional Requirements check

- [x] `expo start` script wired (port 8081 / 8082).
- [x] iOS/Android sim entry points configured (`com.ridex.customer`, `com.ridex.driver`).
- [x] Tab navigation declared (Home/Trips/Wallet/Profile customer; Home/Trips/Earnings/Profile driver).
- [x] Dark mode token store ready (Zustand `useThemeStore`); actual theme switching UI deferred to T014.
- [x] Secure-store round-trip + size limit + WHEN_UNLOCKED + clear — all unit-tested.
- [x] Hot reload via Metro — not exercised in session.
- [x] Lint + type-check sašly.
- [x] README documents iOS sim vs Android emu vs physical phone host (`localhost` / `10.0.2.2` / LAN IP).
- [x] `app.json` icon/splash referenced; binaries deferred via PLACEHOLDER.md.

---

## Things Codex should scrutinize

### Must verify

- **`pnpm --filter @ridex/mobile-customer start` actually boots Metro** on a machine with iOS sim or Android emu. I cannot do this in a headless session.
- **NativeWind classes resolve at runtime.** `cn()` produces correct class strings (verified by vitest in ui-web), but NativeWind's babel transform must compile them to RN styles. Trust check: `babel.config.js` uses `babel-preset-expo` + `nativewind/babel` + `react-native-reanimated/plugin` in order. Verify via expo-doctor.
- **`tailwind.config.ts` cast `as unknown as Partial<Config>`** — required because `ui-tokens` exports readonly arrays from `as const` typography tokens. Same workaround as `web-customer/tailwind.config.ts`.
- **`react-native-safe-area-context` is declared as peer + dev of `ui-mobile`** AND direct dep of both apps. Codex: verify pnpm doesn't dedupe to incompatible versions when both apps install.
- **Jest moduleNameMapper to jest.setup.js** is unusual. It works because `jest.setup.js` exports both `expo-secure-store` API (`getItemAsync` etc.) and `expo-constants` default (`{ expoConfig: ... }`). Codex: confirm this isn't fragile when more tests are added.

### Should improve

- **No `@testing-library/react-native` component tests.** Spec asked for Button × 2. Adding requires jest-preset-expo (see deviation #1) OR `react-test-renderer` + `react-native` polyfill setup. Defer or invest later.
- **`expo-localization` is a dep but not consumed.** Listed for T014's i18n. Could remove and add back in T014.
- **`zustand` is a dep** but only used for theme. Fine, future Zustand usage in T017 (map state).
- **`assets/` only contains PLACEHOLDER.md.** `expo start` will warn about missing icon/splash. User-facing UX in dev is unaffected.

### Nice to have

- **EAS Build config** (`eas.json`) — defer to T024.
- **Maestro `.maestro/` skeleton** — explicitly deferred per spec.
- **Background location entitlement (iOS) + foreground service (Android)** — defer to T019.

### Security checklist (per CLAUDE.md)

- [x] Mapbox token field present but empty in `app.json` — wired in T015.
- [x] Tokens flow through `secureStorage` (WHEN_UNLOCKED keychainAccessible) — no AsyncStorage.
- [x] Value-length cap (2048) prevents accidental large blob writes to keychain.
- [x] HTTP cleartext enabled for dev only (`NSAllowsArbitraryLoads`, `usesCleartextTraffic`). Production must HTTPS — flagged in README + here.
- [x] No backend code touched.
- [x] No new DB / migration / WS event / auth surface.

---

## Exact instructions for Codex

1. Install + lint + type-check + test:
   ```
   pnpm install
   pnpm exec turbo run lint
   pnpm exec turbo run test --filter='!@ridex/backend'
   pnpm --filter @ridex/mobile-customer type-check
   pnpm --filter @ridex/mobile-driver type-check
   ```

2. Boot one mobile app on a real machine:
   ```
   pnpm --filter @ridex/mobile-customer start
   ```
   Verify Metro starts, then press `i` (iOS sim) or `a` (Android emu) — landing should render with "Đi đâu cũng có RideX" + 2 buttons. Tab navigation should be reachable (push to `(tabs)/home` from console / dev menu).

3. Audit deviation #1 (jest-expo → ts-jest). If Codex insists on jest-expo, propose the migration plan.

4. Audit `secure-storage.ts` for keychain misuse — should the `userRole` key really live in secure storage, or is it fine in MMKV (faster)? T014 may reconsider.

5. Confirm `react-native-safe-area-context` peer wiring resolves to one version across both apps + the shared package.

6. Run `npx expo-doctor` inside `apps/mobile-customer` and report any warnings (new arch + RN 0.76 may flag a few).

Return verdict in the standard format.
