# Task 017 — Customer Request Ride Flow Implementation Plan

> **For Codex / agentic workers:** Execute task-by-task in order. Steps use checkbox (`- [ ]`) syntax for tracking. After each task: commit, run lint+test+type-check on touched workspaces, mark step complete, move on.
>
> **Spec source:** `docs/tasks/017-customer-request-ride.md`. The plan implements the spec verbatim — do not extend scope.

**Goal:** Customer mở app → chọn pickup + destination → thấy fare estimate (base + surge) → confirm → ride được tạo → navigate sang ride detail page. Web + mobile cùng flow. Backend addon: `POST /rides/quote`, `GET /rides/active`, dedup `RIDE_ALREADY_ACTIVE` ở `POST /rides`.

**Architecture:**
- Backend: thêm 1 controller endpoint `POST /rides/quote` mỏng (reuse `PricingFacade.computeFareEstimate` đã có), 1 endpoint `GET /rides/active`, và 1 check dedup trong `RidesService.createRide`. Không động schema DB.
- FE: shared `usePickupDestinationStore` (đã có từ T015) bổ sung `address`. TanStack mutation cho quote + create ride. Web dùng inline card; mobile dùng `@gorhom/bottom-sheet`. Sau confirm navigate sang `/rides/[id]` placeholder (T018 sẽ replace).
- Currency VND: round-up multiple 1000 chỉ ở display layer; raw `totalVnd` luôn integer từ backend.

**Tech Stack:**
- Backend: NestJS (đã có), reuse `PricingFacade`, `RidesService`
- FE web: TanStack Query v5 (đã có), Zustand (đã có), Sonner toast (đã có)
- FE mobile: `@gorhom/bottom-sheet@^5`, `react-native-reanimated` (peer), `react-native-gesture-handler` (peer)
- Test: Vitest jsdom (web), ts-jest (mobile), Jest cho NestJS

---

## File Structure

### Created

```
packages/shared-types/src/
  rides.ts                                # ADD: quoteRequestSchema, quoteResponseSchema (append)

apps/backend/src/rides/
  dto/quote-ride.dto.ts                   # QuoteRideDto (lat/lng pickup + destination)
  dto/quote-response.dto.ts               # QuoteResponseDto interface
  errors/ride-already-active.error.ts     # RideAlreadyActiveError (ConflictException)
  rides.quote.controller.spec.ts          # quote endpoint integration test
  rides.controller.active.spec.ts         # GET /rides/active test
  rides.service.dedup.spec.ts             # createRide dedup test

apps/web-customer/src/
  hooks/
    use-ride-quote.ts                     # TanStack mutation /rides/quote
  components/ride/
    fare-estimate-card.tsx                # Breakdown + surge badge
    confirm-ride-button.tsx               # Disabled-state aware button
  app/(app)/rides/[id]/page.tsx           # Placeholder tracking page (T018 replaces)
  hooks/__tests__/use-ride-quote.spec.tsx
  components/ride/__tests__/fare-estimate-card.spec.tsx

apps/mobile-customer/src/
  hooks/
    use-ride-quote.ts                     # Mobile mutation (same shape)
    use-create-ride.ts                    # Mobile mutation
  components/ride/
    pickup-destination-sheet.tsx          # @gorhom/bottom-sheet
    fare-estimate-card.tsx                # RN view
    confirm-button.tsx
  store/
    pickup-destination-store.ts           # Mobile Zustand store
  app/rides/[id].tsx                      # Expo router placeholder
```

### Modified

```
apps/backend/src/rides/
  rides.controller.ts                     # +quote(), +getActive()
  rides.module.ts                         # imports PricingModule
  rides.service.ts                        # createRide: throw RideAlreadyActiveError on dedup
  rides.facade.ts                         # +getActiveRide(customerId) passthrough

packages/api-client/src/rides.ts          # +getQuote, +getActiveRide

apps/web-customer/src/
  lib/use-pickup-destination-store.ts     # +address fields + setPickupAddress
  components/home/home-map.tsx            # Wire quote + confirm
  hooks/use-rides.ts                      # +useActiveRide

apps/mobile-customer/
  package.json                            # +@gorhom/bottom-sheet
  app/(tabs)/home.tsx                     # Wire sheet + quote + confirm
```

---

## Task 1 — Shared types: quote schemas + RIDE_ALREADY_ACTIVE code

**Files:**
- Modify: `packages/shared-types/src/rides.ts` (append below existing exports)
- Test: `packages/shared-types/src/__tests__/rides.spec.ts` (extend if exists, else create)

- [ ] **Step 1: Write the failing test for quote schemas**

Append to `packages/shared-types/src/__tests__/rides.spec.ts` (create file if missing):

```typescript
import { describe, it, expect } from "vitest";
import {
  quoteRequestSchema,
  quoteResponseSchema,
  RIDE_ERROR_ALREADY_ACTIVE
} from "../rides";

describe("quoteRequestSchema", () => {
  it("accepts valid pickup + destination lat/lng", () => {
    const parsed = quoteRequestSchema.parse({
      pickup: { lat: 10.7769, lng: 106.7009 },
      destination: { lat: 10.8231, lng: 106.6297 }
    });
    expect(parsed.pickup.lat).toBeCloseTo(10.7769);
  });

  it("rejects out-of-range lat", () => {
    expect(() =>
      quoteRequestSchema.parse({
        pickup: { lat: 91, lng: 0 },
        destination: { lat: 0, lng: 0 }
      })
    ).toThrow();
  });
});

describe("quoteResponseSchema", () => {
  it("validates full breakdown", () => {
    const parsed = quoteResponseSchema.parse({
      distanceMeters: 12500,
      durationSeconds: 1500,
      baseFareVnd: 12000,
      perKmVnd: 5000,
      perMinVnd: 500,
      surgeMultiplier: 1.2,
      totalVnd: 105000,
      currency: "VND",
      routeConfidence: "high",
      estimatedAt: "2026-05-23T05:00:00.000Z",
      expiresInSeconds: 60
    });
    expect(parsed.totalVnd).toBe(105000);
  });
});

describe("RIDE_ERROR_ALREADY_ACTIVE", () => {
  it("is the canonical error code", () => {
    expect(RIDE_ERROR_ALREADY_ACTIVE).toBe("RIDE_ALREADY_ACTIVE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd packages/shared-types
pnpm test
```
Expected: 3 tests fail with `quoteRequestSchema is not exported`.

- [ ] **Step 3: Add schemas to `packages/shared-types/src/rides.ts`**

Append at the bottom (after existing exports):

```typescript
const quoteCoordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export const quoteRequestSchema = z.object({
  pickup: quoteCoordinateSchema,
  destination: quoteCoordinateSchema
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export const routeConfidenceSchema = z.enum(["high", "low"]);
export type RouteConfidence = z.infer<typeof routeConfidenceSchema>;

export const quoteResponseSchema = z.object({
  distanceMeters: z.number().int().min(0),
  durationSeconds: z.number().int().min(0),
  baseFareVnd: z.number().int().min(0),
  perKmVnd: z.number().int().min(0),
  perMinVnd: z.number().int().min(0),
  surgeMultiplier: z.number().min(1),
  totalVnd: z.number().int().min(0),
  currency: z.literal("VND"),
  routeConfidence: routeConfidenceSchema,
  estimatedAt: isoDateTimeSchema,
  expiresInSeconds: z.number().int().positive()
});
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;

export const RIDE_ERROR_ALREADY_ACTIVE = "RIDE_ALREADY_ACTIVE" as const;
```

- [ ] **Step 4: Run tests to verify pass**

```
pnpm test
```
Expected: all pass.

- [ ] **Step 5: Type-check + commit**

```
pnpm -F @ridex/shared-types type-check
git add packages/shared-types
git commit -m "feat(017): add quote request/response schemas + RIDE_ALREADY_ACTIVE code"
```

---

## Task 2 — Backend: RideAlreadyActiveError + dedup in createRide

**Files:**
- Create: `apps/backend/src/rides/errors/ride-already-active.error.ts`
- Modify: `apps/backend/src/rides/errors/index.ts` (if exists, otherwise import directly)
- Modify: `apps/backend/src/rides/rides.service.ts` (createRide method)
- Test: `apps/backend/src/rides/rides.service.dedup.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/rides/rides.service.dedup.spec.ts`:

```typescript
import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { StructuredLogger } from "../common/logging/structured-logger";
import { Ride } from "./entities/ride.entity";
import { RideEvent } from "./entities/ride-event.entity";
import { RideStatus } from "./enums/ride-status.enum";
import { RidesService } from "./rides.service";
import { RideAlreadyActiveError } from "./errors/ride-already-active.error";

describe("RidesService.createRide dedup", () => {
  it("throws RideAlreadyActiveError when customer already has an active ride", async () => {
    const customerId = "00000000-0000-0000-0000-000000000001";
    const findOne = jest.fn().mockResolvedValueOnce({
      id: "ride-1",
      customerId,
      status: RideStatus.REQUESTED
    });

    const rideRepo = {
      manager: {
        transaction: jest.fn().mockImplementation(async (cb) => cb(rideRepo.manager))
      },
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: findOne
      })
    } as unknown as Repository<Ride>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        RidesService,
        { provide: getRepositoryToken(Ride), useValue: rideRepo },
        { provide: getRepositoryToken(RideEvent), useValue: {} },
        { provide: StructuredLogger, useValue: { log: jest.fn(), debug: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } }
      ]
    }).compile();

    const service = moduleRef.get(RidesService);

    await expect(
      service.createRide(customerId, {
        pickup: { lat: 10.7, lng: 106.7, address: "A" },
        destination: { lat: 10.8, lng: 106.6, address: "B" }
      })
    ).rejects.toBeInstanceOf(RideAlreadyActiveError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd apps/backend
pnpm test rides.service.dedup
```
Expected: fail with `Cannot find module './errors/ride-already-active.error'`.

- [ ] **Step 3: Create the error class**

`apps/backend/src/rides/errors/ride-already-active.error.ts`:

```typescript
import { ConflictException } from "@nestjs/common";

export class RideAlreadyActiveError extends ConflictException {
  constructor() {
    super({
      code: "RIDE_ALREADY_ACTIVE",
      message: "Bạn đang có chuyến đi đang diễn ra."
    });
  }
}
```

- [ ] **Step 4: Add dedup check in `RidesService.createRide`**

In `apps/backend/src/rides/rides.service.ts`, at the very top of `createRide` (before the `transaction`):

```typescript
async createRide(customerId: string, dto: CreateRideDto): Promise<RideResponseDto> {
  const existing = await this.findActiveByCustomer(customerId);
  if (existing !== null) {
    throw new RideAlreadyActiveError();
  }

  const response = await this.rideRepo.manager.transaction(async (manager) => {
    // ... existing code unchanged
```

Add import: `import { RideAlreadyActiveError } from "./errors/ride-already-active.error";`

- [ ] **Step 5: Run tests to verify pass**

```
pnpm test rides.service.dedup
pnpm test rides.service.spec    # Existing tests should still pass
```
Expected: all pass.

- [ ] **Step 6: Type-check + commit**

```
pnpm -F backend type-check
git add apps/backend/src/rides
git commit -m "feat(017): block createRide when customer has active ride (RIDE_ALREADY_ACTIVE)"
```

---

## Task 3 — Backend: GET /rides/active endpoint

**Files:**
- Modify: `apps/backend/src/rides/rides.facade.ts`
- Modify: `apps/backend/src/rides/rides.controller.ts`
- Test: `apps/backend/src/rides/rides.controller.active.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/rides/rides.controller.active.spec.ts`:

```typescript
import { Test } from "@nestjs/testing";

import { RidesController } from "./rides.controller";
import { RidesFacade } from "./rides.facade";
import { RideTransitionService } from "./ride-transition.service";
import { Role } from "../users/dto/role.enum";

describe("RidesController.getActive", () => {
  it("returns active ride wrapped in envelope when one exists", async () => {
    const ride = { id: "ride-1", customerId: "u-1", status: "REQUESTED" };
    const facade = { getActiveRide: jest.fn().mockResolvedValue(ride) };

    const moduleRef = await Test.createTestingModule({
      controllers: [RidesController],
      providers: [
        { provide: RidesFacade, useValue: facade },
        { provide: RideTransitionService, useValue: {} }
      ]
    }).compile();

    const controller = moduleRef.get(RidesController);
    const result = await controller.getActive({ userId: "u-1", role: Role.CUSTOMER });
    expect(result).toEqual({ data: ride });
    expect(facade.getActiveRide).toHaveBeenCalledWith("u-1");
  });

  it("returns { data: null } when no active ride", async () => {
    const facade = { getActiveRide: jest.fn().mockResolvedValue(null) };

    const moduleRef = await Test.createTestingModule({
      controllers: [RidesController],
      providers: [
        { provide: RidesFacade, useValue: facade },
        { provide: RideTransitionService, useValue: {} }
      ]
    }).compile();

    const controller = moduleRef.get(RidesController);
    const result = await controller.getActive({ userId: "u-1", role: Role.CUSTOMER });
    expect(result).toEqual({ data: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test rides.controller.active
```
Expected: fail with `controller.getActive is not a function`.

- [ ] **Step 3: Add `getActiveRide` to `RidesFacade`**

In `apps/backend/src/rides/rides.facade.ts`, add method:

```typescript
async getActiveRide(customerId: string): Promise<RideResponseDto | null> {
  const ride = await this.ridesService.findActiveByCustomer(customerId);
  return ride === null ? null : rideToResponseDto(ride);
}
```

Add import if missing: `import { rideToResponseDto } from "./rides.mapper";` and `import type { RideResponseDto } from "./dto/ride-response.dto";`

- [ ] **Step 4: Add `getActive` endpoint to `RidesController`**

In `apps/backend/src/rides/rides.controller.ts`, before `createRide`:

```typescript
@Get("active")
@Roles(Role.CUSTOMER)
async getActive(
  @CurrentUser() user: AuthenticatedUser
): Promise<{ data: RideResponseDto | null }> {
  const ride = await this.ridesFacade.getActiveRide(user.userId);
  return { data: ride };
}
```

Add imports: `Get` from `@nestjs/common`, ensure `RidesFacade` is injected (replace `RidesService` if needed; check existing constructor).

If constructor currently uses `RidesService` instead of `RidesFacade`, inject `RidesFacade` additionally — do NOT remove `RidesService` since it's still used.

- [ ] **Step 5: Run tests to verify pass**

```
pnpm test rides.controller.active
```
Expected: 2 tests pass.

- [ ] **Step 6: Type-check + commit**

```
pnpm -F backend type-check
git add apps/backend/src/rides
git commit -m "feat(017): GET /rides/active returns customer's active ride or null"
```

---

## Task 4 — Backend: POST /rides/quote endpoint

**Files:**
- Create: `apps/backend/src/rides/dto/quote-ride.dto.ts`
- Modify: `apps/backend/src/rides/rides.controller.ts`
- Modify: `apps/backend/src/rides/rides.module.ts`
- Test: `apps/backend/src/rides/rides.quote.controller.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/rides/rides.quote.controller.spec.ts`:

```typescript
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";

import { PricingFacade } from "../pricing/pricing.facade";
import { RidesController } from "./rides.controller";
import { RidesFacade } from "./rides.facade";
import { RideTransitionService } from "./ride-transition.service";
import { Role } from "../users/dto/role.enum";

describe("RidesController.quote", () => {
  it("returns full quote breakdown for valid pickup/destination", async () => {
    const pricingFacade = {
      computeFareEstimate: jest.fn().mockResolvedValue({
        baseFareVnd: 12000,
        distanceMeters: 12500,
        distanceFeeVnd: 62500,
        durationSeconds: 1500,
        durationFeeVnd: 12500,
        subtotalVnd: 87000,
        surgeMultiplier: 1.2,
        surgeAmountVnd: 17400,
        minimumFareVnd: 15000,
        totalVnd: 104400,
        routeConfidence: "high",
        currency: "VND",
        pickupH3R8: "8828308281fffff",
        surge: { cellR8: "8828308281fffff", demand: 5, supply: 4, ratio: 1.25, multiplier: 1.2 }
      })
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "PRICING_PER_KM_VND") return 5000;
        if (key === "PRICING_PER_MIN_VND") return 500;
        if (key === "PRICING_QUOTE_TTL_SECONDS") return 60;
        return 0;
      })
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [RidesController],
      providers: [
        { provide: RidesFacade, useValue: { getActiveRide: jest.fn() } },
        { provide: RideTransitionService, useValue: {} },
        { provide: PricingFacade, useValue: pricingFacade },
        { provide: ConfigService, useValue: configService }
      ]
    }).compile();

    const controller = moduleRef.get(RidesController);
    const result = await controller.quote(
      {
        pickup: { lat: 10.7769, lng: 106.7009 },
        destination: { lat: 10.8231, lng: 106.6297 }
      },
      { userId: "u-1", role: Role.CUSTOMER }
    );

    expect(result.data.totalVnd).toBe(104400);
    expect(result.data.surgeMultiplier).toBe(1.2);
    expect(result.data.currency).toBe("VND");
    expect(result.data.routeConfidence).toBe("high");
    expect(result.data.expiresInSeconds).toBe(60);
    expect(typeof result.data.estimatedAt).toBe("string");
  });

  it("rejects identical pickup and destination", async () => {
    const pricingFacade = {
      computeFareEstimate: jest.fn()
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [RidesController],
      providers: [
        { provide: RidesFacade, useValue: { getActiveRide: jest.fn() } },
        { provide: RideTransitionService, useValue: {} },
        { provide: PricingFacade, useValue: pricingFacade },
        { provide: ConfigService, useValue: { get: jest.fn(() => 60) } }
      ]
    }).compile();

    const controller = moduleRef.get(RidesController);
    await expect(
      controller.quote(
        { pickup: { lat: 10, lng: 106 }, destination: { lat: 10, lng: 106 } },
        { userId: "u-1", role: Role.CUSTOMER }
      )
    ).rejects.toMatchObject({ response: { code: "QUOTE_INVALID_COORDINATES" } });
    expect(pricingFacade.computeFareEstimate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test rides.quote.controller
```
Expected: fail with `controller.quote is not a function`.

- [ ] **Step 3: Create the DTO**

`apps/backend/src/rides/dto/quote-ride.dto.ts`:

```typescript
import { Type } from "class-transformer";
import { IsDefined, IsNumber, Max, Min, ValidateNested } from "class-validator";

export class QuoteCoordinateDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class QuoteRideDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => QuoteCoordinateDto)
  pickup!: QuoteCoordinateDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => QuoteCoordinateDto)
  destination!: QuoteCoordinateDto;
}
```

- [ ] **Step 4: Add `quote` endpoint to `RidesController`**

In `apps/backend/src/rides/rides.controller.ts`:

```typescript
@Post("quote")
@Roles(Role.CUSTOMER)
@HttpCode(HttpStatus.OK)
async quote(
  @Body() dto: QuoteRideDto,
  @CurrentUser() user: AuthenticatedUser
): Promise<{ data: QuoteResponseDto }> {
  if (dto.pickup.lat === dto.destination.lat && dto.pickup.lng === dto.destination.lng) {
    throw new BadRequestException({
      code: "QUOTE_INVALID_COORDINATES",
      message: "Pickup và destination phải khác nhau."
    });
  }

  const estimate = await this.pricingFacade.computeFareEstimate({
    pickup: { lat: dto.pickup.lat, lng: dto.pickup.lng },
    destination: { lat: dto.destination.lat, lng: dto.destination.lng }
  });

  return {
    data: {
      distanceMeters: estimate.distanceMeters,
      durationSeconds: estimate.durationSeconds,
      baseFareVnd: estimate.baseFareVnd,
      perKmVnd: this.configService.get("PRICING_PER_KM_VND", { infer: true }),
      perMinVnd: this.configService.get("PRICING_PER_MIN_VND", { infer: true }),
      surgeMultiplier: estimate.surgeMultiplier,
      totalVnd: estimate.totalVnd,
      currency: "VND" as const,
      routeConfidence: estimate.routeConfidence,
      estimatedAt: new Date().toISOString(),
      expiresInSeconds: 60
    }
  };
}
```

Add imports: `Body, HttpCode, HttpStatus, BadRequestException` from `@nestjs/common`. Add `import { ConfigService } from "@nestjs/config";`. Add `import { PricingFacade } from "../pricing/pricing.facade";`. Add `import { QuoteRideDto } from "./dto/quote-ride.dto";`.

Inject in constructor:

```typescript
constructor(
  private readonly ridesService: RidesService,           // existing
  private readonly transitionService: RideTransitionService, // existing
  private readonly ridesFacade: RidesFacade,             // from Task 3
  private readonly pricingFacade: PricingFacade,         // NEW
  private readonly configService: ConfigService          // NEW
) {}
```

Create response type alias above the controller class (or in a separate `dto/quote-response.dto.ts`):

```typescript
export interface QuoteResponseDto {
  distanceMeters: number;
  durationSeconds: number;
  baseFareVnd: number;
  perKmVnd: number;
  perMinVnd: number;
  surgeMultiplier: number;
  totalVnd: number;
  currency: "VND";
  routeConfidence: "high" | "low";
  estimatedAt: string;
  expiresInSeconds: number;
}
```

- [ ] **Step 5: Wire `PricingModule` into `RidesModule`**

In `apps/backend/src/rides/rides.module.ts`:

```typescript
import { PricingModule } from "../pricing/pricing.module";

@Module({
  imports: [TypeOrmModule.forFeature([Ride, RideEvent]), PricingModule],
  // ... rest unchanged
})
```

- [ ] **Step 6: Run tests + integration**

```
pnpm test rides
```
Expected: all rides tests pass (including new quote + active + dedup).

- [ ] **Step 7: Type-check + commit**

```
pnpm -F backend type-check
git add apps/backend/src/rides
git commit -m "feat(017): POST /rides/quote returns fare estimate via PricingFacade"
```

---

## Task 5 — api-client: add `getQuote` + `getActiveRide`

**Files:**
- Modify: `packages/api-client/src/rides.ts`
- Test: `packages/api-client/src/client.spec.ts` (extend)

- [ ] **Step 1: Add to `packages/api-client/src/rides.ts`**

Replace the file with:

```typescript
import {
  createRideDtoSchema,
  quoteRequestSchema,
  quoteResponseSchema,
  rideResponseSchema,
  transitionRideDtoSchema,
  type CreateRideDto,
  type QuoteRequest,
  type TransitionRideDto
} from "@ridex/shared-types";
import { z } from "zod";

import type { ApiClient } from "./client";
import { enveloped } from "./schemas";

const activeRideEnvelopeSchema = enveloped(z.union([rideResponseSchema, z.null()]));

export function createRidesApi(client: ApiClient) {
  return {
    createRide(input: CreateRideDto) {
      return client.request({
        method: "POST",
        path: "/rides",
        body: createRideDtoSchema.parse(input),
        schema: enveloped(rideResponseSchema)
      });
    },

    transitionRide(rideId: string, input: TransitionRideDto) {
      return client.request({
        method: "POST",
        path: `/rides/${encodeURIComponent(rideId)}/transitions`,
        body: transitionRideDtoSchema.parse(input),
        schema: enveloped(rideResponseSchema)
      });
    },

    getActiveRide() {
      return client.request({
        method: "GET",
        path: "/rides/active",
        schema: activeRideEnvelopeSchema
      });
    },

    getQuote(input: QuoteRequest) {
      return client.request({
        method: "POST",
        path: "/rides/quote",
        body: quoteRequestSchema.parse(input),
        schema: enveloped(quoteResponseSchema)
      });
    }
  };
}
```

- [ ] **Step 2: Run api-client tests**

```
cd packages/api-client
pnpm test
pnpm type-check
```
Expected: existing 10 tests still pass; types check.

- [ ] **Step 3: Commit**

```
git add packages/api-client/src/rides.ts
git commit -m "feat(017): api-client adds getQuote and getActiveRide"
```

---

## Task 6 — Web-customer: extend pickup-destination store with `address`

**Files:**
- Modify: `apps/web-customer/src/lib/use-pickup-destination-store.ts`
- Test: `apps/web-customer/src/lib/__tests__/use-pickup-destination-store.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create the test file:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { usePickupDestinationStore } from "../use-pickup-destination-store";

describe("usePickupDestinationStore", () => {
  beforeEach(() => {
    usePickupDestinationStore.getState().reset();
  });

  it("setPickup stores coord and address together", () => {
    usePickupDestinationStore.getState().setPickup(
      { lat: 10.7, lng: 106.7 },
      "Bến Thành"
    );
    const state = usePickupDestinationStore.getState();
    expect(state.pickup).toEqual({ lat: 10.7, lng: 106.7 });
    expect(state.pickupAddress).toBe("Bến Thành");
  });

  it("setDestination stores coord and address", () => {
    usePickupDestinationStore.getState().setDestination(
      { lat: 10.8, lng: 106.6 },
      "Thủ Thiêm"
    );
    expect(usePickupDestinationStore.getState().destinationAddress).toBe("Thủ Thiêm");
  });

  it("reset clears all fields", () => {
    const s = usePickupDestinationStore.getState();
    s.setPickup({ lat: 1, lng: 1 }, "A");
    s.setDestination({ lat: 2, lng: 2 }, "B");
    s.reset();
    const after = usePickupDestinationStore.getState();
    expect(after.pickup).toBeNull();
    expect(after.destination).toBeNull();
    expect(after.pickupAddress).toBeNull();
    expect(after.destinationAddress).toBeNull();
  });
});
```

Add to `apps/web-customer/vitest.config.ts` includePatterns if `__tests__` not already covered (check).

- [ ] **Step 2: Run test (expect fail)**

```
cd apps/web-customer
pnpm test use-pickup-destination-store
```
Expected: fail — `pickupAddress` doesn't exist on state.

- [ ] **Step 3: Update the store**

Replace `apps/web-customer/src/lib/use-pickup-destination-store.ts`:

```typescript
"use client";

import type { LatLng } from "@ridex/ui-web";
import { create } from "zustand";

export interface PickupDestinationState {
  pickup: LatLng | null;
  destination: LatLng | null;
  pickupAddress: string | null;
  destinationAddress: string | null;
  setPickup: (coord: LatLng, address?: string) => void;
  setDestination: (coord: LatLng, address?: string) => void;
  reset: () => void;
}

export const usePickupDestinationStore = create<PickupDestinationState>((set) => ({
  pickup: null,
  destination: null,
  pickupAddress: null,
  destinationAddress: null,
  setPickup: (coord, address) => set({ pickup: coord, pickupAddress: address ?? null }),
  setDestination: (coord, address) =>
    set({ destination: coord, destinationAddress: address ?? null }),
  reset: () =>
    set({
      pickup: null,
      destination: null,
      pickupAddress: null,
      destinationAddress: null
    })
}));
```

- [ ] **Step 4: Update existing home-map.tsx references**

In `apps/web-customer/src/components/home/home-map.tsx`, rename `pickupLabel` → `pickupAddress`, `destinationLabel` → `destinationAddress` everywhere:

```typescript
const {
  pickup,
  destination,
  pickupAddress,
  destinationAddress,
  setPickup,
  setDestination,
  reset
} = usePickupDestinationStore();
```

And in the JSX, replace `pickupLabel` → `pickupAddress`, `destinationLabel` → `destinationAddress`.

- [ ] **Step 5: Run tests + type-check**

```
pnpm test
pnpm type-check
```
Expected: all pass.

- [ ] **Step 6: Commit**

```
git add apps/web-customer/src/lib apps/web-customer/src/components/home
git commit -m "feat(017): pickup-destination store stores address alongside coord"
```

---

## Task 7 — Web-customer: useRideQuote hook + useActiveRide

**Files:**
- Create: `apps/web-customer/src/hooks/use-ride-quote.ts`
- Modify: `apps/web-customer/src/hooks/use-rides.ts` (add useActiveRide back)
- Test: `apps/web-customer/src/hooks/__tests__/use-ride-quote.spec.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `apps/web-customer/src/hooks/__tests__/use-ride-quote.spec.tsx`:

```typescript
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useRideQuote } from "../use-ride-quote";
import { ridesApi } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  ridesApi: {
    getQuote: vi.fn()
  }
}));

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useRideQuote", () => {
  beforeEach(() => {
    vi.mocked(ridesApi.getQuote).mockReset();
  });

  it("does not fetch when pickup or destination missing", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useRideQuote({ pickup: null, destination: null }),
      { wrapper: wrapper(qc) }
    );
    expect(result.current.isFetching).toBe(false);
    expect(ridesApi.getQuote).not.toHaveBeenCalled();
  });

  it("fetches quote when both pickup and destination present", async () => {
    vi.mocked(ridesApi.getQuote).mockResolvedValue({
      distanceMeters: 12500,
      durationSeconds: 1500,
      baseFareVnd: 12000,
      perKmVnd: 5000,
      perMinVnd: 500,
      surgeMultiplier: 1.2,
      totalVnd: 105000,
      currency: "VND",
      routeConfidence: "high",
      estimatedAt: "2026-05-23T05:00:00.000Z",
      expiresInSeconds: 60
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () =>
        useRideQuote({
          pickup: { lat: 10.7, lng: 106.7 },
          destination: { lat: 10.8, lng: 106.6 }
        }),
      { wrapper: wrapper(qc) }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalVnd).toBe(105000);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

```
pnpm test use-ride-quote
```
Expected: fail (file doesn't exist).

- [ ] **Step 3: Create `use-ride-quote.ts`**

```typescript
"use client";

import type { LatLng } from "@ridex/ui-web";
import { useQuery } from "@tanstack/react-query";

import { ridesApi } from "@/lib/api";

export const quoteKey = (pickup: LatLng, destination: LatLng) =>
  ["quote", pickup.lat, pickup.lng, destination.lat, destination.lng] as const;

interface Input {
  pickup: LatLng | null;
  destination: LatLng | null;
}

export function useRideQuote({ pickup, destination }: Input) {
  const enabled = pickup !== null && destination !== null;
  return useQuery({
    queryKey: enabled ? quoteKey(pickup, destination) : ["quote", "idle"],
    queryFn: () => ridesApi.getQuote({ pickup: pickup!, destination: destination! }),
    enabled,
    staleTime: 30_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false
  });
}
```

- [ ] **Step 4: Add `useActiveRide` to `use-rides.ts`**

In `apps/web-customer/src/hooks/use-rides.ts`, add (do not re-add the 5s poll — fetch on mount only; T018 will replace with WS):

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ... existing rideKeys + useCreateRide ...

export function useActiveRide(enabled = true) {
  return useQuery({
    queryKey: rideKeys.active(),
    queryFn: () => ridesApi.getActiveRide(),
    enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });
}
```

- [ ] **Step 5: Run tests**

```
pnpm test
```
Expected: all pass including new hook test.

- [ ] **Step 6: Commit**

```
git add apps/web-customer/src/hooks
git commit -m "feat(017): web-customer useRideQuote + useActiveRide hooks"
```

---

## Task 8 — Web-customer: FareEstimateCard component

**Files:**
- Create: `apps/web-customer/src/components/ride/fare-estimate-card.tsx`
- Test: `apps/web-customer/src/components/ride/__tests__/fare-estimate-card.spec.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web-customer/src/components/ride/__tests__/fare-estimate-card.spec.tsx`:

```typescript
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { FareEstimateCard } from "../fare-estimate-card";

const baseQuote = {
  distanceMeters: 12500,
  durationSeconds: 1500,
  baseFareVnd: 12000,
  perKmVnd: 5000,
  perMinVnd: 500,
  surgeMultiplier: 1.0,
  totalVnd: 87000,
  currency: "VND" as const,
  routeConfidence: "high" as const,
  estimatedAt: "2026-05-23T05:00:00.000Z",
  expiresInSeconds: 60
};

describe("FareEstimateCard", () => {
  it("renders total rounded up to nearest 1000 VND", () => {
    render(<FareEstimateCard quote={{ ...baseQuote, totalVnd: 87100 }} />);
    expect(screen.getByText(/88\.000/)).toBeInTheDocument();
  });

  it("renders surge badge when multiplier > 1", () => {
    render(<FareEstimateCard quote={{ ...baseQuote, surgeMultiplier: 1.2 }} />);
    expect(screen.getByText(/Giờ cao điểm ×1\.2/)).toBeInTheDocument();
  });

  it("hides surge badge when multiplier = 1.0", () => {
    render(<FareEstimateCard quote={baseQuote} />);
    expect(screen.queryByText(/Giờ cao điểm/)).not.toBeInTheDocument();
  });

  it("shows low-confidence notice when routeConfidence='low'", () => {
    render(<FareEstimateCard quote={{ ...baseQuote, routeConfidence: "low" }} />);
    expect(screen.getByText(/Ước tính có thể chênh/)).toBeInTheDocument();
  });

  it("renders loading skeleton when loading=true", () => {
    render(<FareEstimateCard loading />);
    expect(screen.getByTestId("fare-card-skeleton")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

```
pnpm test fare-estimate-card
```
Expected: fail (component missing).

- [ ] **Step 3: Create the component**

`apps/web-customer/src/components/ride/fare-estimate-card.tsx`:

```typescript
"use client";

import { Card, CardContent, Skeleton } from "@ridex/ui-web";
import type { QuoteResponse } from "@ridex/shared-types";

interface Props {
  quote?: QuoteResponse;
  loading?: boolean;
}

export function roundUpVnd(vnd: number): number {
  return Math.ceil(vnd / 1000) * 1000;
}

export function formatVnd(vnd: number): string {
  return new Intl.NumberFormat("vi-VN").format(vnd) + " ₫";
}

export function FareEstimateCard({ quote, loading }: Props) {
  if (loading || !quote) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4" data-testid="fare-card-skeleton">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  const display = roundUpVnd(quote.totalVnd);
  const distanceKm = (quote.distanceMeters / 1000).toFixed(1);
  const durationMin = Math.round(quote.durationSeconds / 60);

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-semibold tabular-nums">
            {formatVnd(display)}
          </span>
          {quote.surgeMultiplier > 1 ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              Giờ cao điểm ×{quote.surgeMultiplier.toFixed(1)}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          {distanceKm} km · ~{durationMin} phút · Base {formatVnd(quote.baseFareVnd)}
        </p>
        {quote.routeConfidence === "low" ? (
          <p className="text-xs italic text-surface-500">
            Ước tính có thể chênh do dịch vụ định tuyến tạm thời gián đoạn.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

If `@ridex/ui-web` doesn't re-export `Skeleton`, verify and add to `packages/ui-web/src/index.ts` if missing (check existing exports).

- [ ] **Step 4: Run tests**

```
pnpm test fare-estimate-card
```
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```
git add apps/web-customer/src/components/ride
git commit -m "feat(017): FareEstimateCard with surge badge + low-confidence notice"
```

---

## Task 9 — Web-customer: integrate quote + confirm in home-map + placeholder ride page

**Files:**
- Create: `apps/web-customer/src/components/ride/confirm-ride-button.tsx`
- Create: `apps/web-customer/src/app/(app)/rides/[id]/page.tsx`
- Modify: `apps/web-customer/src/components/home/home-map.tsx`
- Modify: `apps/web-customer/src/hooks/use-rides.ts` (extend useCreateRide for active redirect)

- [ ] **Step 1: Create ConfirmRideButton**

`apps/web-customer/src/components/ride/confirm-ride-button.tsx`:

```typescript
"use client";

import { Button, Spinner } from "@ridex/ui-web";

import { formatVnd, roundUpVnd } from "./fare-estimate-card";

interface Props {
  totalVnd: number | null;
  disabled?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmRideButton({ totalVnd, disabled, loading, onConfirm }: Props) {
  const label =
    totalVnd === null ? "Đặt xe" : `Đặt xe — ${formatVnd(roundUpVnd(totalVnd))}`;
  return (
    <Button
      type="button"
      className="w-full"
      size="lg"
      disabled={disabled === true || loading === true || totalVnd === null}
      onClick={onConfirm}
    >
      {loading === true ? <Spinner className="h-5 w-5" /> : label}
    </Button>
  );
}
```

If `Spinner` not exported from `@ridex/ui-web`, replace with plain text "Đang xử lý...".

- [ ] **Step 2: Create placeholder /rides/[id] page**

`apps/web-customer/src/app/(app)/rides/[id]/page.tsx`:

```typescript
"use client";

import { useParams } from "next/navigation";

export default function RideDetailPlaceholderPage() {
  const params = useParams<{ id: string }>();
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Chuyến xe</h1>
      <p className="text-sm text-surface-700 dark:text-surface-300">
        Ride ID: <code>{params.id}</code>
      </p>
      <p className="text-sm italic text-surface-500">
        Trang theo dõi chuyến đi sẽ được triển khai ở Task 018.
      </p>
    </section>
  );
}
```

- [ ] **Step 3: Wire quote + confirm + active-redirect into home-map.tsx**

Replace `apps/web-customer/src/components/home/home-map.tsx` (keep imports of MapView/LocationSearch unchanged; add):

```typescript
"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  LocationSearch,
  MapView,
  SAIGON_FALLBACK,
  toast,
  useCurrentLocation,
  type LatLng,
  type MapMarkerData
} from "@ridex/ui-web";
import { useRouter } from "next/navigation";
import * as React from "react";

import { ConfirmRideButton } from "@/components/ride/confirm-ride-button";
import { FareEstimateCard } from "@/components/ride/fare-estimate-card";
import { useActiveRide, useCreateRide } from "@/hooks/use-rides";
import { useRideQuote } from "@/hooks/use-ride-quote";
import { apiErrorToMessage } from "@/lib/api-error";
import { usePickupDestinationStore } from "@/lib/use-pickup-destination-store";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const MIN_DISTANCE_METERS = 100;
const MAX_DISTANCE_METERS = 50_000;

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function HomeMap() {
  const router = useRouter();
  const { coords, isFallback } = useCurrentLocation();
  const {
    pickup,
    destination,
    pickupAddress,
    destinationAddress,
    setPickup,
    setDestination,
    reset
  } = usePickupDestinationStore();

  // Redirect to active ride if customer already has one
  const activeRideQuery = useActiveRide();
  React.useEffect(() => {
    const active = activeRideQuery.data;
    if (active !== null && active !== undefined) {
      router.replace(`/rides/${active.id}`);
    }
  }, [activeRideQuery.data, router]);

  const quote = useRideQuote({ pickup, destination });
  const createRide = useCreateRide();

  const handleMapClick = React.useCallback(
    (point: LatLng) => {
      if (!pickup) setPickup(point);
      else if (!destination) setDestination(point);
    },
    [pickup, destination, setPickup, setDestination]
  );

  const markers = React.useMemo<MapMarkerData[]>(() => {
    const out: MapMarkerData[] = [];
    if (pickup) out.push({ id: "pickup", coord: pickup, variant: "pickup", label: "Đón" });
    if (destination)
      out.push({
        id: "destination",
        coord: destination,
        variant: "destination",
        label: "Đến"
      });
    return out;
  }, [pickup, destination]);

  const route = React.useMemo<GeoJSON.LineString | undefined>(() => {
    if (!pickup || !destination) return undefined;
    return {
      type: "LineString",
      coordinates: [
        [pickup.lng, pickup.lat],
        [destination.lng, destination.lat]
      ]
    };
  }, [pickup, destination]);

  const distanceMeters =
    pickup && destination ? haversineMeters(pickup, destination) : null;

  const validationError = React.useMemo(() => {
    if (distanceMeters === null) return null;
    if (distanceMeters < MIN_DISTANCE_METERS) return "Pickup và đến quá gần.";
    if (distanceMeters > MAX_DISTANCE_METERS) return "Vượt quá phạm vi phục vụ.";
    return null;
  }, [distanceMeters]);

  const handleConfirm = React.useCallback(() => {
    if (!pickup || !destination) return;
    createRide.mutate(
      {
        pickup: {
          lat: pickup.lat,
          lng: pickup.lng,
          address: pickupAddress ?? `${pickup.lat.toFixed(5)}, ${pickup.lng.toFixed(5)}`
        },
        destination: {
          lat: destination.lat,
          lng: destination.lng,
          address:
            destinationAddress ??
            `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`
        }
      },
      {
        onSuccess: (ride) => {
          reset();
          router.push(`/rides/${ride.id}`);
        },
        onError: (err) => {
          // Active ride redirect handled via useActiveRide refetch below
          const message = apiErrorToMessage(err);
          const isAlreadyActive =
            err instanceof Error && /RIDE_ALREADY_ACTIVE/.test(err.message);
          if (isAlreadyActive) {
            void activeRideQuery.refetch();
            toast.error("Bạn đang có chuyến đi. Đang chuyển hướng...");
          } else {
            toast.error(message);
          }
        }
      }
    );
  }, [
    pickup,
    destination,
    pickupAddress,
    destinationAddress,
    createRide,
    reset,
    router,
    activeRideQuery
  ]);

  if (!MAPBOX_TOKEN) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6">
          <CardTitle>Cần Mapbox token</CardTitle>
          <CardDescription>
            Đặt biến môi trường <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> trong{" "}
            <code>.env.local</code> để bật map.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <LocationSearch
            token={MAPBOX_TOKEN}
            placeholder="Tìm điểm đón hoặc điểm đến..."
            onSelect={(r) => {
              if (!pickup) setPickup(r.coord, r.name);
              else if (!destination) setDestination(r.coord, r.name);
            }}
          />
        </div>
        <Button variant="outline" type="button" onClick={() => reset()}>
          Đặt lại
        </Button>
      </div>
      <div className="text-xs text-surface-600 dark:text-surface-400">
        {pickup ? (
          <>
            <strong>Đón:</strong>{" "}
            {pickupAddress ?? `${pickup.lat.toFixed(5)}, ${pickup.lng.toFixed(5)}`}
          </>
        ) : (
          <>Bấm trên bản đồ hoặc tìm để đặt điểm đón.</>
        )}
        {destination ? (
          <>
            {" · "}
            <strong>Đến:</strong>{" "}
            {destinationAddress ??
              `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`}
          </>
        ) : null}
        {isFallback ? (
          <span className="ml-2 italic">(dùng vị trí mặc định Sài Gòn)</span>
        ) : null}
      </div>
      <div className="h-[420px] w-full overflow-hidden rounded-lg border border-surface-200 dark:border-surface-700">
        <MapView
          token={MAPBOX_TOKEN}
          initialCenter={coords ?? SAIGON_FALLBACK}
          markers={markers}
          route={route}
          onMapClick={handleMapClick}
        />
      </div>
      {pickup && destination ? (
        <div className="space-y-3">
          {validationError !== null ? (
            <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
          ) : (
            <FareEstimateCard quote={quote.data} loading={quote.isLoading} />
          )}
          <ConfirmRideButton
            totalVnd={quote.data?.totalVnd ?? null}
            disabled={validationError !== null || quote.isError}
            loading={createRide.isPending}
            onConfirm={handleConfirm}
          />
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Update useCreateRide to extract error code if needed**

In `apps/web-customer/src/hooks/use-rides.ts`, `useCreateRide` already exists. No change needed; the error propagates and handleConfirm handles RIDE_ALREADY_ACTIVE.

- [ ] **Step 5: Run lint + tests + type-check**

```
pnpm lint
pnpm test
pnpm type-check
```
Expected: all pass.

- [ ] **Step 6: Commit**

```
git add apps/web-customer/src
git commit -m "feat(017): web-customer wires quote + confirm + active-ride redirect"
```

---

## Task 10 — Mobile-customer: install @gorhom/bottom-sheet + extend store + hooks

**Files:**
- Modify: `apps/mobile-customer/package.json`
- Create: `apps/mobile-customer/src/store/pickup-destination-store.ts`
- Create: `apps/mobile-customer/src/hooks/use-ride-quote.ts`
- Create: `apps/mobile-customer/src/hooks/use-create-ride.ts`

- [ ] **Step 1: Install @gorhom/bottom-sheet**

```
cd apps/mobile-customer
pnpm add @gorhom/bottom-sheet@^5
```

Verify `react-native-reanimated` and `react-native-gesture-handler` are present (they should be from Expo SDK). If missing:

```
pnpm add react-native-reanimated react-native-gesture-handler
```

- [ ] **Step 2: Create pickup-destination store**

`apps/mobile-customer/src/store/pickup-destination-store.ts`:

```typescript
import type { LatLng } from "@ridex/ui-mobile";
import { create } from "zustand";

export interface PickupDestinationState {
  pickup: LatLng | null;
  destination: LatLng | null;
  pickupAddress: string | null;
  destinationAddress: string | null;
  setPickup: (coord: LatLng, address?: string) => void;
  setDestination: (coord: LatLng, address?: string) => void;
  reset: () => void;
}

export const usePickupDestinationStore = create<PickupDestinationState>((set) => ({
  pickup: null,
  destination: null,
  pickupAddress: null,
  destinationAddress: null,
  setPickup: (coord, address) => set({ pickup: coord, pickupAddress: address ?? null }),
  setDestination: (coord, address) =>
    set({ destination: coord, destinationAddress: address ?? null }),
  reset: () =>
    set({
      pickup: null,
      destination: null,
      pickupAddress: null,
      destinationAddress: null
    })
}));
```

- [ ] **Step 3: Create useRideQuote hook**

`apps/mobile-customer/src/hooks/use-ride-quote.ts`:

```typescript
import type { LatLng } from "@ridex/ui-mobile";
import { useQuery } from "@tanstack/react-query";

import { ridesApi } from "../lib/api";

interface Input {
  pickup: LatLng | null;
  destination: LatLng | null;
}

export function useRideQuote({ pickup, destination }: Input) {
  const enabled = pickup !== null && destination !== null;
  return useQuery({
    queryKey: enabled
      ? (["quote", pickup.lat, pickup.lng, destination.lat, destination.lng] as const)
      : (["quote", "idle"] as const),
    queryFn: () => ridesApi.getQuote({ pickup: pickup!, destination: destination! }),
    enabled,
    staleTime: 30_000,
    gcTime: 60_000
  });
}
```

- [ ] **Step 4: Create useCreateRide hook**

`apps/mobile-customer/src/hooks/use-create-ride.ts`:

```typescript
import type { CreateRideDto } from "@ridex/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ridesApi } from "../lib/api";

export function useCreateRide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRideDto) => ridesApi.createRide(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rides", "active"] });
    }
  });
}

// Mobile uses a lightweight on-mount query; no polling per spec.
import { useQuery } from "@tanstack/react-query";
export function useActiveRide(enabled = true) {
  return useQuery({
    queryKey: ["rides", "active"] as const,
    queryFn: () => ridesApi.getActiveRide(),
    enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });
}
```

- [ ] **Step 5: Write a quick store test**

Create `apps/mobile-customer/src/store/__tests__/pickup-destination-store.spec.ts`:

```typescript
import { usePickupDestinationStore } from "../pickup-destination-store";

describe("usePickupDestinationStore (mobile)", () => {
  beforeEach(() => usePickupDestinationStore.getState().reset());

  it("setPickup persists coord + address", () => {
    usePickupDestinationStore.getState().setPickup({ lat: 1, lng: 2 }, "X");
    const s = usePickupDestinationStore.getState();
    expect(s.pickup).toEqual({ lat: 1, lng: 2 });
    expect(s.pickupAddress).toBe("X");
  });

  it("reset clears all", () => {
    const s = usePickupDestinationStore.getState();
    s.setPickup({ lat: 1, lng: 2 }, "X");
    s.setDestination({ lat: 3, lng: 4 }, "Y");
    s.reset();
    expect(usePickupDestinationStore.getState().pickup).toBeNull();
    expect(usePickupDestinationStore.getState().destinationAddress).toBeNull();
  });
});
```

- [ ] **Step 6: Run tests + type-check**

```
pnpm test pickup-destination-store
pnpm type-check
```
Expected: pass.

- [ ] **Step 7: Commit**

```
git add apps/mobile-customer/package.json apps/mobile-customer/src
git commit -m "feat(017): mobile-customer adds @gorhom/bottom-sheet + pickup/destination store + ride hooks"
```

---

## Task 11 — Mobile-customer: PickupDestinationSheet bottom-sheet component

**Files:**
- Create: `apps/mobile-customer/src/components/ride/pickup-destination-sheet.tsx`

- [ ] **Step 1: Create component**

```typescript
import { LocationSearch, type LatLng } from "@ridex/ui-mobile";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import * as React from "react";
import { StyleSheet, Text, View } from "react-native";

import { usePickupDestinationStore } from "../../store/pickup-destination-store";

interface Props {
  mapboxToken: string;
  onComplete: () => void;
}

export const PickupDestinationSheet = React.forwardRef<BottomSheet, Props>(
  ({ mapboxToken, onComplete }, ref) => {
    const snapPoints = React.useMemo(() => ["25%", "80%"], []);
    const { pickup, destination, setPickup, setDestination } = usePickupDestinationStore();
    const [stage, setStage] = React.useState<"pickup" | "destination">(
      pickup === null ? "pickup" : "destination"
    );

    const handleSelect = React.useCallback(
      (r: { coord: LatLng; name: string }) => {
        if (stage === "pickup") {
          setPickup(r.coord, r.name);
          setStage("destination");
        } else {
          setDestination(r.coord, r.name);
          onComplete();
        }
      },
      [stage, setPickup, setDestination, onComplete]
    );

    return (
      <BottomSheet ref={ref} index={-1} snapPoints={snapPoints} enablePanDownToClose>
        <BottomSheetView style={styles.content}>
          <Text style={styles.label}>
            {stage === "pickup" ? "Điểm đón" : "Điểm đến"}
          </Text>
          <LocationSearch
            token={mapboxToken}
            placeholder={stage === "pickup" ? "Bạn đang ở đâu?" : "Đi đâu?"}
            onSelect={handleSelect}
          />
          {pickup !== null && stage === "destination" ? (
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                Đón: {pickup.lat.toFixed(5)}, {pickup.lng.toFixed(5)}
              </Text>
            </View>
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    );
  }
);
PickupDestinationSheet.displayName = "PickupDestinationSheet";

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  summary: { backgroundColor: "#f1f5f9", padding: 8, borderRadius: 8 },
  summaryText: { fontSize: 12, color: "#475569" }
});
```

- [ ] **Step 2: Type-check + commit**

```
pnpm type-check
git add apps/mobile-customer/src/components/ride
git commit -m "feat(017): mobile PickupDestinationSheet bottom-sheet picker"
```

---

## Task 12 — Mobile-customer: FareEstimateCard + ConfirmButton + integrate home + placeholder ride screen

**Files:**
- Create: `apps/mobile-customer/src/components/ride/fare-estimate-card.tsx`
- Create: `apps/mobile-customer/src/components/ride/confirm-button.tsx`
- Create: `apps/mobile-customer/app/rides/[id].tsx`
- Modify: `apps/mobile-customer/app/(tabs)/home.tsx`
- Modify: `apps/mobile-customer/app/_layout.tsx` (wrap with GestureHandlerRootView + BottomSheetModalProvider)

- [ ] **Step 1: Create FareEstimateCard (mobile)**

`apps/mobile-customer/src/components/ride/fare-estimate-card.tsx`:

```typescript
import { Card, CardContent, Text } from "@ridex/ui-mobile";
import type { QuoteResponse } from "@ridex/shared-types";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export function roundUpVnd(vnd: number): number {
  return Math.ceil(vnd / 1000) * 1000;
}

export function formatVnd(vnd: number): string {
  return new Intl.NumberFormat("vi-VN").format(vnd) + " ₫";
}

interface Props {
  quote?: QuoteResponse;
  loading?: boolean;
}

export function FareEstimateCard({ quote, loading }: Props) {
  if (loading || !quote) {
    return (
      <Card>
        <CardContent>
          <ActivityIndicator />
        </CardContent>
      </Card>
    );
  }
  const total = roundUpVnd(quote.totalVnd);
  const km = (quote.distanceMeters / 1000).toFixed(1);
  const min = Math.round(quote.durationSeconds / 60);
  return (
    <Card>
      <CardContent>
        <View style={styles.row}>
          <Text variant="h2">{formatVnd(total)}</Text>
          {quote.surgeMultiplier > 1 ? (
            <View style={styles.badge}>
              <Text variant="caption" style={styles.badgeText}>
                ×{quote.surgeMultiplier.toFixed(1)}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="caption">
          {km} km · ~{min} phút · Base {formatVnd(quote.baseFareVnd)}
        </Text>
        {quote.routeConfidence === "low" ? (
          <Text variant="caption" style={styles.lowConfidence}>
            Ước tính có thể chênh.
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { backgroundColor: "#fde68a", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: "#78350f", fontWeight: "600" },
  lowConfidence: { fontStyle: "italic", color: "#64748b", marginTop: 4 }
});
```

- [ ] **Step 2: Create ConfirmButton**

`apps/mobile-customer/src/components/ride/confirm-button.tsx`:

```typescript
import { Button } from "@ridex/ui-mobile";
import { formatVnd, roundUpVnd } from "./fare-estimate-card";

interface Props {
  totalVnd: number | null;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function ConfirmButton({ totalVnd, loading, disabled, onPress }: Props) {
  const label =
    totalVnd === null ? "Đặt xe" : `Đặt xe — ${formatVnd(roundUpVnd(totalVnd))}`;
  return (
    <Button
      loading={loading}
      onPress={onPress}
      disabled={disabled === true || totalVnd === null}
    >
      {label}
    </Button>
  );
}
```

- [ ] **Step 3: Create placeholder ride detail screen**

`apps/mobile-customer/app/rides/[id].tsx`:

```typescript
import { Screen, Text } from "@ridex/ui-mobile";
import { useLocalSearchParams } from "expo-router";

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen>
      <Text variant="h2">Chuyến xe</Text>
      <Text variant="body">Ride ID: {id}</Text>
      <Text variant="caption">Trang theo dõi sẽ có ở Task 018.</Text>
    </Screen>
  );
}
```

- [ ] **Step 4: Wrap root layout for gesture handler**

In `apps/mobile-customer/app/_layout.tsx`, add `GestureHandlerRootView` wrapping the entire tree (must be outermost):

```typescript
import { GestureHandlerRootView } from "react-native-gesture-handler";
// ... other imports

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryProvider>
          {/* ... existing children unchanged ... */}
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 5: Integrate into home tab**

Replace `apps/mobile-customer/app/(tabs)/home.tsx` `CustomerMap` function with quote/confirm wiring:

```typescript
// At top of file, add imports:
import BottomSheet from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { Alert } from "react-native";

import { ConfirmButton } from "../../src/components/ride/confirm-button";
import { FareEstimateCard } from "../../src/components/ride/fare-estimate-card";
import { PickupDestinationSheet } from "../../src/components/ride/pickup-destination-sheet";
import { useCreateRide } from "../../src/hooks/use-create-ride";
import { useRideQuote } from "../../src/hooks/use-ride-quote";
import { usePickupDestinationStore } from "../../src/store/pickup-destination-store";

// Replace the existing CustomerMap function body:
function CustomerMap({ mapboxToken }: { mapboxToken: string }) {
  const router = useRouter();
  const { coords, isFallback } = useCurrentLocation({ autoRequest: false });
  const sheetRef = React.useRef<BottomSheet>(null);
  const { pickup, destination, setPickup, setDestination, reset } =
    usePickupDestinationStore();
  const quote = useRideQuote({ pickup, destination });
  const createRide = useCreateRide();

  const markers = React.useMemo<MapMarkerData[]>(() => {
    const out: MapMarkerData[] = [];
    if (pickup) out.push({ id: "pickup", coord: pickup, variant: "pickup" });
    if (destination)
      out.push({ id: "destination", coord: destination, variant: "destination" });
    return out;
  }, [pickup, destination]);

  const handleConfirm = React.useCallback(() => {
    if (!pickup || !destination) return;
    createRide.mutate(
      {
        pickup: {
          lat: pickup.lat,
          lng: pickup.lng,
          address: `${pickup.lat.toFixed(5)}, ${pickup.lng.toFixed(5)}`
        },
        destination: {
          lat: destination.lat,
          lng: destination.lng,
          address: `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`
        }
      },
      {
        onSuccess: (ride) => {
          reset();
          router.push(`/rides/${ride.id}`);
        },
        onError: (err) => {
          const isAlreadyActive =
            err instanceof Error && /RIDE_ALREADY_ACTIVE/.test(err.message);
          Alert.alert(
            "Đặt xe thất bại",
            isAlreadyActive
              ? "Bạn đang có chuyến đi."
              : "Vui lòng thử lại."
          );
        }
      }
    );
  }, [pickup, destination, createRide, reset, router]);

  return (
    <View style={styles.container}>
      <View style={styles.searchOverlay}>
        <Button onPress={() => sheetRef.current?.expand()}>
          {destination ? "Đổi điểm" : "Bạn đi đâu?"}
        </Button>
        {isFallback ? (
          <Text variant="caption" style={{ color: "#64748b", marginTop: 4 }}>
            Đang dùng vị trí mặc định Sài Gòn
          </Text>
        ) : null}
      </View>
      <MapView
        token={mapboxToken}
        initialCenter={coords ?? SAIGON_FALLBACK}
        markers={markers}
        onMapClick={(point) => {
          if (!pickup) setPickup(point);
          else if (!destination) setDestination(point);
        }}
        style={styles.map}
      />
      {pickup && destination ? (
        <View style={styles.bottomOverlay}>
          <FareEstimateCard quote={quote.data} loading={quote.isLoading} />
          <ConfirmButton
            totalVnd={quote.data?.totalVnd ?? null}
            loading={createRide.isPending}
            onPress={handleConfirm}
          />
        </View>
      ) : null}
      <PickupDestinationSheet
        ref={sheetRef}
        mapboxToken={mapboxToken}
        onComplete={() => sheetRef.current?.close()}
      />
    </View>
  );
}
```

Extend `styles` at the bottom of the file:

```typescript
const styles = StyleSheet.create({
  container: { flex: 1 },
  searchOverlay: { position: "absolute", top: 12, left: 12, right: 12, zIndex: 10 },
  bottomOverlay: {
    position: "absolute",
    bottom: 24,
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 10
  },
  map: { flex: 1 }
});
```

- [ ] **Step 6: Run lint + type-check + test**

```
cd apps/mobile-customer
pnpm type-check
pnpm test
pnpm lint
```
Expected: all pass.

- [ ] **Step 7: Smoke test on dev (optional but recommended)**

```
pnpm start
```
Verify: home loads, sheet opens, can search destination, fare card appears (will 404 against backend if not running — that's expected for plan execution).

- [ ] **Step 8: Commit**

```
git add apps/mobile-customer
git commit -m "feat(017): mobile-customer wires bottom-sheet picker + fare card + confirm + ride placeholder"
```

---

## Final Verification

- [ ] **All tests + lint + type-check across workspace**

```
cd ridex
pnpm -r test
pnpm -r type-check
pnpm -r lint
```
Expected: all pass. Note: backend tests must include the 3 new spec files (dedup, active controller, quote controller).

- [ ] **Manual integration smoke (if backend + web running)**

1. Backend up (`pnpm -F backend start:dev`)
2. Web-customer up (`pnpm -F web-customer dev`)
3. Login as customer → home → tap map twice → fare card appears → Confirm → redirected to `/rides/[id]` placeholder
4. Refresh home → useActiveRide detects ride → auto-redirects to placeholder (dedup verified)

- [ ] **Update spec acceptance checkboxes**

In `docs/tasks/017-customer-request-ride.md`, leave the existing `[x]` markers as-is (they were the spec author's intent). Add review note in `docs/reviews/017-customer-request-ride-r1.md` after Codex finishes.

---

## Notes for the implementer

- **Do NOT** add a `POST /rides/quote` rate limiter in T017 — spec defers it to phase 8.
- **Do NOT** persist quote responses to DB — quotes are stateless.
- **Snapshots**: `pricing_snapshots` is still locked by the existing `RideRequestedPricingListener` when ride enters REQUESTED. The quote endpoint must NOT write to that table.
- **VND rounding**: backend returns raw `totalVnd` (integer). Round-up to multiple of 1000 happens only in the display layer (`roundUpVnd`). The ride is created and charged at the raw amount (no client-side fare manipulation).
- **Skeleton component**: if `@ridex/ui-web` doesn't export `Skeleton`, check `packages/ui-web/src/index.ts`. The file `skeleton.tsx` exists, so it should be exported; if not, add `export * from "./components/skeleton";` to the index.
- **GestureHandlerRootView**: must be the OUTERMOST wrapper in `_layout.tsx` for `@gorhom/bottom-sheet` to work on Android.
- **Jest mocks for @gorhom/bottom-sheet**: if mobile tests import the sheet component, add `jest.mock("@gorhom/bottom-sheet", () => require("@gorhom/bottom-sheet/mock"))` to `jest.setup.js` per the library's official mock guide.
