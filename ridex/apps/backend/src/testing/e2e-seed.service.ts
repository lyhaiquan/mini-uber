import { randomUUID } from "node:crypto";

import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { hash as argon2Hash } from "@node-rs/argon2";
import { Repository } from "typeorm";

import { DRIVER_LOCATION_UPDATED_EVENT } from "../common/events/event-types";
import { DriversFacade } from "../drivers/drivers.facade";
import { DriverLocationCacheService } from "../location/cache/driver-location-cache.service";
import { RideOffer } from "../matching/entities/ride-offer.entity";
import { OfferStatus } from "../matching/enums/offer-status.enum";
import { RidesService } from "../rides/rides.service";
import { Role } from "../users/dto/role.enum";
import { UsersFacade } from "../users/users.facade";
import type { SeedDriverOfferRequestDto } from "./dto/seed-driver-offer-request.dto";
import type { SeedDriverOfferResponseDto } from "./dto/seed-driver-offer-response.dto";

const E2E_PASSWORD = "E2eMaestroTest!2026";
const OFFER_WAIT_TIMEOUT_MS = 8_000;
const OFFER_WAIT_POLL_MS = 200;

@Injectable()
export class E2ESeedService {
  constructor(
    private readonly usersFacade: UsersFacade,
    private readonly driversFacade: DriversFacade,
    private readonly locationCache: DriverLocationCacheService,
    private readonly eventEmitter: EventEmitter2,
    private readonly moduleRef: ModuleRef,
    @InjectRepository(RideOffer)
    private readonly offerRepository: Repository<RideOffer>
  ) {}

  async seedDriverOffer(input: SeedDriverOfferRequestDto): Promise<SeedDriverOfferResponseDto> {
    if (process.env.NODE_ENV === "production") {
      throw new NotFoundException();
    }

    const mode = input.mode ?? "prepare";
    const testRunId = normalizeRunId(input.testRunId);
    const driverEmail = `e2e-driver-${testRunId}@ridex.test`;
    const customerEmail = `e2e-customer-${testRunId}@ridex.test`;

    const driver = await this.ensureUser(driverEmail, Role.DRIVER);
    const customer = await this.ensureUser(customerEmail, Role.CUSTOMER);

    if (mode === "prepare") {
      return this.buildResponse(mode, testRunId, driver, customer, null, null);
    }

    await this.driversFacade.setOnline(driver.id);
    await this.seedDriverLocation(driver.id, input.pickup.lat, input.pickup.lng);

    const existingOffer = await this.offerRepository.findOne({
      where: {
        driverUserId: driver.id,
        status: OfferStatus.OFFERED
      },
      order: { offeredAt: "DESC" }
    });
    if (existingOffer !== null) {
      return this.buildResponse(
        mode,
        testRunId,
        driver,
        customer,
        existingOffer.rideId,
        existingOffer.id
      );
    }

    const ride = await this.ridesService.createRide(customer.id, {
      pickup: {
        lat: input.pickup.lat,
        lng: input.pickup.lng,
        address: `E2E Pickup ${testRunId}`
      },
      destination: {
        lat: input.destination.lat,
        lng: input.destination.lng,
        address: `E2E Destination ${testRunId}`
      }
    });

    const offer = await this.waitForActiveOffer(driver.id, ride.id);
    if (offer === null) {
      throw new ServiceUnavailableException({
        code: "E2E_OFFER_TIMEOUT",
        message: "Matching did not create a driver offer before the timeout."
      });
    }

    return this.buildResponse(mode, testRunId, driver, customer, offer.rideId, offer.id);
  }

  private get ridesService(): RidesService {
    return this.moduleRef.get(RidesService, { strict: false });
  }

  private buildResponse(
    mode: "prepare" | "dispatch-offer",
    testRunId: string,
    driver: SeedUser,
    customer: SeedUser,
    rideId: string | null,
    offerId: string | null
  ): SeedDriverOfferResponseDto {
    return {
      mode,
      testRunId,
      driver: {
        userId: driver.id,
        email: driver.email,
        password: E2E_PASSWORD
      },
      customer: {
        userId: customer.id,
        email: customer.email,
        password: E2E_PASSWORD
      },
      rideId,
      offerId
    };
  }

  private async ensureUser(email: string, role: Role): Promise<SeedUser> {
    const existing = await this.usersFacade.findAuthByEmail(email);
    if (existing !== null) {
      return { id: existing.id, email: existing.email, role: existing.role };
    }

    const passwordHash = await argon2Hash(E2E_PASSWORD, {
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1
    });
    const created = await this.usersFacade.createUser({
      email,
      passwordHash,
      role
    });

    return { id: created.id, email: created.email, role: created.role };
  }

  private async seedDriverLocation(driverId: string, lat: number, lng: number): Promise<void> {
    const now = new Date();
    const recordedAt = now.toISOString();
    const receivedAt = now.toISOString();

    await this.locationCache.set(driverId, {
      lat,
      lng,
      recordedAt,
      receivedAt
    });

    this.eventEmitter.emit(DRIVER_LOCATION_UPDATED_EVENT, {
      eventId: randomUUID(),
      eventType: DRIVER_LOCATION_UPDATED_EVENT,
      aggregateType: "driver",
      aggregateId: driverId,
      payload: {
        driverId,
        lat,
        lng,
        recordedAt,
        receivedAt
      },
      correlationId: randomUUID(),
      occurredAt: recordedAt,
      emittedBy: "testing"
    });
  }

  private async waitForActiveOffer(
    driverUserId: string,
    rideId: string
  ): Promise<RideOffer | null> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < OFFER_WAIT_TIMEOUT_MS) {
      const offer = await this.offerRepository.findOne({
        where: {
          driverUserId,
          rideId,
          status: OfferStatus.OFFERED
        },
        order: { offeredAt: "DESC" }
      });
      if (offer !== null) {
        return offer;
      }
      await sleep(OFFER_WAIT_POLL_MS);
    }

    return null;
  }
}

interface SeedUser {
  id: string;
  email: string;
  role: Role;
}

function normalizeRunId(value: string | undefined): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 64);
  }
  return randomUUID().slice(0, 8);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
