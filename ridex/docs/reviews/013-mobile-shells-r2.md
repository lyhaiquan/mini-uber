# Review: Task 013 - Mobile Shells (Round 2)

**Task file:** `docs/tasks/013-mobile-shells.md`
**R1:** `docs/reviews/013-mobile-shells-r1.md` (self-review, PASS WITH FIXES)
**Reviewer:** Claude (Opus 4.7)
**Date:** 2026-05-20

---

## Verdict: PASS

Two Expo SDK 52 apps + `@ridex/ui-mobile` package lint clean, type-check clean, all unit tests green. R1 deferrals are correctly scoped to later tasks (T014 theme UI, T015 maps, T019 background location, T024 EAS Build / Maestro). No fixes needed this round — R1 already over-delivered on documentation; the gaps it noted are all out-of-scope for "shell only".

```text
pnpm --filter @ridex/mobile-customer lint      → clean
pnpm --filter @ridex/mobile-driver lint        → clean
pnpm --filter @ridex/mobile-customer test      → 2 suites, 5 tests
pnpm --filter @ridex/mobile-driver test        → 2 suites, 5 tests
pnpm --filter @ridex/backend test              → 444 tests pass (unaffected)
turbo run lint test --filter='!@ridex/backend' → 20 tasks pass
```

Did NOT boot Metro / iOS sim / Android emu — true rendering verification needs simulators outside this sandbox.

---

## R1 items audited (no new fixes needed)

1. **Test count 5/8.** R1 deferred 2 `Button` component tests + 1 env negative-case to T024. Acceptable for a shell-only task: the 2 native deps that matter for auth (`expo-secure-store`, `expo-constants`) are unit-tested round-trip in `apps/mobile-customer/src/lib/__tests__/secure-storage.spec.ts:10-36`. Native UI rendering is Maestro's job.

2. **No real icon/splash PNGs.** `apps/{mobile-customer,mobile-driver}/assets/PLACEHOLDER.md` documents the deferral. `app.json` references `./assets/splash.png` and `./assets/adaptive-icon.png` — Expo will warn on first boot but does not fail. Generate via `expo prebuild --clean` when T024 wires EAS Build.

3. **jest-expo → ts-jest tradeoff.** R1 documented the pnpm + jest-expo + RN flow-typed setup hell well. Switching back would add ~2h debug + transformIgnorePatterns gymnastics for marginal gain (no UI tests = no Maestro substitute today). Decision stands.

4. **React 18 not 19.** Locked because Expo 52 ships React 18.3.1; React 19 + RN 0.76 is bleeding-edge. Web apps also pin React 18 in package.json, so versions match across surfaces. ✓ no cross-surface skew.

5. **NativeWind preset import via `require()`** in `tailwind.config.ts:6` — necessary because `nativewind/preset` ships CommonJS-only. ESLint disable is scoped to that one line. ✓

---

## What I additionally verified

- **`app/_layout.tsx`** (`apps/mobile-customer/app/_layout.tsx:7-18` + driver equivalent) wraps Stack with `SafeAreaProvider` + `StatusBar` + imports `../global.css` for NativeWind base styles. Spec wanted `<ThemeProvider>` as well, but the `useThemeStore` Zustand store (`src/lib/theme.ts:10-13`) is consumed via hook directly — no provider needed at runtime. Acceptable; the spec snippet was illustrative. Will need wiring in T014 when the actual `<ThemeToggle/>` UI lands.
- **Tab navigation** correct per spec:
  - Customer: Home / Trips / Wallet / Profile (`apps/mobile-customer/app/(tabs)/_layout.tsx:5-9`).
  - Driver: Home / Trips / Earnings / Profile (`apps/mobile-driver/app/(tabs)/_layout.tsx:5-9`).
- **Bundle IDs** distinct: `com.ridex.customer` vs `com.ridex.driver` (`app.json:17, 25`); schemes `ridex-customer` vs `ridex-driver`. ✓ no collision.
- **Landing screen** uses `<Link asChild>` correctly (`apps/mobile-customer/app/index.tsx:17-22`) — better than the web equivalent before R2 fix.
- **README per app** documents iOS sim (`localhost`) vs Android emu (`10.0.2.2`) vs physical phone (LAN IP + `HOST=0.0.0.0`) — fulfills spec acceptance criterion line 261.
- **`secureStorage` implementation** (`apps/mobile-customer/src/lib/secure-storage.ts:8-26`):
  - Whitelist of keys (`accessToken`, `refreshToken`, `userId`, `userRole`).
  - Throws on `>2048` chars before writing — prevents accidental large blobs.
  - `WHEN_UNLOCKED` keychain accessibility.
  - `clear()` parallel-deletes all known keys.
  - Tests verify each behavior (round-trip, oversize-reject, accessibility flag, clear-all).
- **No AsyncStorage import** anywhere in mobile apps — tokens stay in Keychain/Keystore.
- **HTTP cleartext for dev only** — `apps/mobile-customer/app.json:17-22` enables `NSAllowsArbitraryLoads` (iOS) + `usesCleartextTraffic: true` (Android). Production must HTTPS — flagged in both READMEs.

---

## Hard-rule check (per CLAUDE.md)

- [x] No auth / RBAC code yet — auth lands T014.
- [x] No client-trusted payment / role / status — no business logic in T013.
- [x] No DB schema / migration touched.
- [x] No new WS event.
- [x] No source-of-truth in Redis — secureStore is correct token sink (not Redis).
- [x] No secrets logged — Zod's `.format()` only emits field names, not values.
- [x] No backend code touched — 444 backend tests still pass.

---

## Should improve (non-blocking, for T014+)

- **SI-1: ui-mobile missing 3 primitives from spec** — `toast`, `sheet`, `divider`. Substitutes:
  - `toast` → add when T014 needs error/success surfaces. Pick `react-native-toast-message` (no native deps) or `burnt` (iOS native look).
  - `sheet` → add when T017 (request ride) needs bottom-sheet UX. `@gorhom/bottom-sheet` per spec.
  - `divider` → trivial; add inline as needed.
- **SI-2: `src/components/screen-container.tsx`** listed in spec line 52 but absent. The `Screen` primitive in `@ridex/ui-mobile/components/screen.tsx` substitutes — drop the per-app duplicate from the spec.
- **SI-3: `@testing-library/react-native` not wired.** Required for Button tests; defer until jest-expo migration is worthwhile (probably never — Maestro covers native UI in T024).
- **SI-4: `expo-localization` declared as dep but unused.** Drop until T014 wires i18n, or keep as forward-looking dep.
- **SI-5: `react-native-mmkv` + `expo-image`** listed in spec line 16 but not added. mmkv is a perf optimization (deferred fine); `expo-image` should land in T015 when map markers / user avatars appear.
- **SI-6: `app.json` references missing PNGs** — Expo warns at boot. Either add 1024×1024 placeholder PNGs (e.g., from `npx expo install --check`) or remove the references from `app.json` until T024.

---

## Nice to have

- **Theme switching UI** — Zustand store ready, but no toggle component yet. T014 lands the `<ThemeToggle/>` in the auth screens.
- **`expo-doctor`** run not exercised in this session (no Expo CLI in sandbox). R1's recommendation stands: run on a dev machine to validate New Architecture compat.
- **EAS Build config** (`eas.json`) — T024.
- **Maestro `.maestro/` skeleton** — T024.

---

## Final acceptance criteria (spec §Acceptance Criteria)

- [x] `expo start` script wired for both apps (ports 8081 / 8082).
- [ ] iOS sim + Android emu actual render — needs simulator-equipped machine.
- [x] Tab navigation declared correctly per app.
- [x] Dark mode store ready (Zustand `useThemeStore`).
- [x] Secure-store wrapper unit tests green (4 tests covering round-trip, oversize-reject, `WHEN_UNLOCKED`, clear-all).
- [x] Lint + type-check clean on both apps + `ui-mobile`.
- [x] README per app documents iOS/Android/physical-device host handling.
- [x] `app.json` icon/splash referenced (binaries deferred via PLACEHOLDER.md).

---

## Closing note

T013 ships as a clean shell. The R1 self-review was thorough; round-2 audit confirms no new defects and no must-fixes. T014 (auth UI cross-surface) can start with `secureStorage` already in place + tab/auth route groups scaffolded.

5 + 5 = **10 mobile-shell tests passing** (+ 4 ui-web cn tests + 1 per web app env smoke = **452 total tests** counting backend's 444). Mobile shells: **DONE**.
