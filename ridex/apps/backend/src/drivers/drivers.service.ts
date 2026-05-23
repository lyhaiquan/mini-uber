import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import type { DomainEvent } from "../common/domain-event";
import { Role } from "../users/dto/role.enum";
import { UsersFacade } from "../users/users.facade";
import type { DriverAvailabilityDto } from "./dto/driver-availability.dto";
import { Driver } from "./entities/driver.entity";
import { DriverNotEligibleError } from "./errors/driver-errors";
import {
  DRIVER_WENT_OFFLINE_EVENT,
  DRIVER_WENT_ONLINE_EVENT,
  type DriverWentOfflinePayload,
  type DriverWentOnlinePayload
} from "./events/driver-events";

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver) private readonly driverRepository: Repository<Driver>,
    private readonly usersFacade: UsersFacade,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async setOnline(driverId: string, correlationId: string = randomUUID()): Promise<void> {
    await this.ensureDriverEligible(driverId);

    const existing = await this.driverRepository.findOne({ where: { driverId } });
    const shouldEmitOnline = existing === null || !existing.isOnline;
    const now = new Date();

    await this.driverRepository.query(
      `
        INSERT INTO "drivers" (
          "driver_id",
          "is_online",
          "online_since",
          "last_seen_at",
          "created_at",
          "updated_at"
        )
        VALUES ($1, true, $2, $2, $2, $2)
        ON CONFLICT ("driver_id") DO UPDATE
        SET
          "is_online" = true,
          "online_since" = CASE
            WHEN "drivers"."is_online" = true THEN "drivers"."online_since"
            ELSE EXCLUDED."online_since"
          END,
          "last_seen_at" = EXCLUDED."last_seen_at",
          "updated_at" = EXCLUDED."updated_at"
      `,
      [driverId, now]
    );

    if (shouldEmitOnline) {
      const onlineSince = existing?.isOnline === true && existing.onlineSince !== null
        ? existing.onlineSince
        : now;
      this.eventEmitter.emit(
        DRIVER_WENT_ONLINE_EVENT,
        this.createDomainEvent<DriverWentOnlinePayload>(
          DRIVER_WENT_ONLINE_EVENT,
          driverId,
          { driverId, onlineSince: onlineSince.toISOString() },
          correlationId
        )
      );
    }
  }

  async setOffline(driverId: string, correlationId: string = randomUUID()): Promise<void> {
    const existing = await this.driverRepository.findOne({ where: { driverId } });

    if (existing === null || !existing.isOnline) {
      return;
    }

    const now = new Date();
    await this.driverRepository.update(driverId, {
      isOnline: false,
      onlineSince: null,
      lastSeenAt: now
    });

    this.eventEmitter.emit(
      DRIVER_WENT_OFFLINE_EVENT,
      this.createDomainEvent<DriverWentOfflinePayload>(
        DRIVER_WENT_OFFLINE_EVENT,
        driverId,
        { driverId, offlineAt: now.toISOString() },
        correlationId
      )
    );
  }

  async isOnline(driverId: string): Promise<boolean> {
    const driver = await this.driverRepository.findOne({ where: { driverId } });
    return driver?.isOnline === true;
  }

  async countOnline(): Promise<number> {
    return this.driverRepository.count({ where: { isOnline: true } });
  }

  async countTotal(): Promise<number> {
    return this.driverRepository.count();
  }

  async getAvailability(driverId: string): Promise<DriverAvailabilityDto> {
    const driver = await this.driverRepository.findOne({ where: { driverId } });

    if (driver === null) {
      return {
        isOnline: false,
        onlineSince: null,
        lastSeenAt: null
      };
    }

    return {
      isOnline: driver.isOnline,
      onlineSince: driver.onlineSince?.toISOString() ?? null,
      lastSeenAt: driver.lastSeenAt?.toISOString() ?? null
    };
  }

  private async ensureDriverEligible(driverId: string): Promise<void> {
    const eligible = await this.usersFacade.existsWithRole(driverId, Role.DRIVER);

    if (!eligible) {
      throw new DriverNotEligibleError();
    }
  }

  private createDomainEvent<TPayload>(
    eventType: string,
    driverId: string,
    payload: TPayload,
    correlationId: string
  ): DomainEvent<TPayload> {
    return {
      eventId: randomUUID(),
      eventType,
      aggregateType: "driver",
      aggregateId: driverId,
      payload,
      correlationId,
      occurredAt: new Date().toISOString(),
      emittedBy: "drivers"
    };
  }
}

