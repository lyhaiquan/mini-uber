# Review: Task 005 — H3 Driver Discovery (Round 2)

**Task file:** `docs/tasks/005-h3-driver-discovery.md`
**Implementer (R2):** Codex (fix-up pass on Claude's self-implementation)
**Reviewer:** Claude
**Date:** 2026-05-17

---

## Verdict: **PASS**

Codex thực hiện một fix-up pass tập trung vào điểm yếu duy nhất Round 1 đã ghi nhận (R-3 TOCTOU). Sửa đúng hướng, không drift scope, không touch các module khác.

---

## What Codex changed (delta vs Round 1)

Files modified sau 2026-05-17 00:13 (review R1):

| File | Δ | Mục đích |
|---|---|---|
| `geo/redis/h3-redis-index.service.ts` | major | Thay `ZSCORE → removeDriver` 2-pha bằng **Lua EVAL atomic** |
| `geo/redis/h3-redis-index.service.spec.ts` | rewrite of sweepStale block | Test ARGV/KEYS của Lua script, +1 test |
| `geo/geo.facade.ts` | minor | Refactor clampRing nhỏ |
| `geo/geo.facade.spec.ts` | refresh | Test phù hợp với clampRing mới |
| `geo/geo.constants.ts` | additive | Thêm `H3_DRIVER_INDEX_RESOLUTIONS` + type |

Verify:
```
pnpm lint:    clean (0 errors)
pnpm build:   clean
pnpm test:    30 suites, 237 tests passed  (+1 từ R1: 236 → 237)
```

---

## Core fix: atomic stale-eviction

### Before (R1)

`sweepStale` chạy 2 round-trip:

```typescript
const score = await redis.zscore(zsetKey, driverId);   // round-trip 1
if (score >= threshold) return false;                  // fresh → skip
await removeDriver(driverId);                          // round-trip 2 (multi-step pipeline)
```

R1 đã ghi nhận: *"There is still a TOCTOU window between ZSCORE and removeDriver"*. Acceptable theo R1 verdict, nhưng strict improvement nếu đóng được.

### After (R2)

Một `EVAL` atomic chạy trên Redis:

```lua
local score = redis.call("ZSCORE", KEYS[1], ARGV[1])
if not score then return 0 end
if tonumber(score) >= tonumber(ARGV[2]) then return 0 end

local cells = redis.call("HMGET", KEYS[2], "r8", "r9")
if cells[1] then redis.call("SREM", ARGV[3] .. cells[1], ARGV[1]) end
if cells[2] then redis.call("SREM", ARGV[4] .. cells[2], ARGV[1]) end
redis.call("DEL", KEYS[2])
redis.call("ZREM", KEYS[1], ARGV[1])
return 1
```

→ Score check + SREM + DEL + ZREM trong cùng 1 EVAL → **TOCTOU window = 0** giữa check và evict. R-3 bây giờ đóng tuyệt đối.

### Verify Lua correctness

- `if not score then return 0` — ZSCORE trả nil (đã evict) → no-op ✅
- `tonumber(score) >= tonumber(ARGV[2])` — fresh write landed → skip ✅
- HMGET trả `false` cho field missing trong Lua, `if cells[1] then` xử lý đúng → no SREM nếu companion thiếu cell ✅
- DEL companion + ZREM zset luôn chạy nếu qua được 2 guard đầu — đúng intent ✅
- Return code 0/1 đếm chính xác evictions ở caller ✅

---

## New issues raised in R2

### NTH-1 (Nice to have): Lua script không cluster-safe

Cell-set keys (`h3:drivers:r8:{cellId}`) được build động bằng `ARGV[3] .. cells[1]` thay vì pass qua `KEYS[]`. Trong Redis Cluster mode, Lua scripts yêu cầu tất cả key truy cập phải khai báo trong `KEYS` để đảm bảo slot-locality; pattern hiện tại sẽ raise `Lua script attempted to access a non local key in a cluster node`.

- **Impact:** Zero cho thesis (docker-compose dùng Redis standalone single-node).
- **Resolution path nếu scale:** Cần redesign companion HASH dùng hash tag (e.g. `h3:driver:cells:{driverId}` and `h3:drivers:r8:{driverId}` cùng tag) hoặc chia eviction thành 2 EVAL.
- **Action:** Note only. Không fix.

### NTH-2 (Nice to have): Tests trùng path

`skips drivers whose score refreshed during the atomic stale remove` và `skips drivers whose score is null (already evicted)` cùng dùng `eval.mockResolvedValue(0)` → chung path nhánh, không distinguish 2 trường hợp script handle khác nhau (score null vs score >= threshold). Có thể bỏ 1 hoặc add fixture lib để mock Lua execution chi tiết hơn. Acceptable.

---

## Compliance recheck

| Rule | Status |
|---|---|
| `geo` không thay đổi module dependency direction | ✅ no new imports |
| `geo` vẫn không own PostgreSQL table | ✅ no migration |
| Redis remain authoritative-free, Postgres `drivers.is_online` là source of truth | ✅ |
| Test count delta ≥ 0 | ✅ +1 |
| Lint / build clean | ✅ |

---

## Updated R1 post-mortem entries

- **R-3 (TOCTOU):** ❌ R1 "acceptable" → ✅ R2 **eliminated** via atomic Lua.

Các risk khác (R-1 pipeline ordering, R-2 sweeper drift, R-4 h3-js drift, R-5 event const refactor) không thay đổi — vẫn green.

---

## Closing

Task 005 kết thúc dứt điểm sau R2. Có thể move sang Task 006 (OSRM Route Estimate). Codex's fix nâng chất lượng sweeper từ "acceptable for thesis MVP" lên "atomic and provably correct" — tốt hơn baseline R1.

**Status:** ✅ PASS — 237 tests, lint clean, build clean, R-3 đóng, 2 nice-to-have notes.
