import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";

import { Payment } from "../entities/payment.entity";
import { PaymentStatus } from "../enums/payment-status.enum";
import type { InsertPaymentInput } from "../payments.types";

export interface PaymentDashboardStats {
  successCountLast24h: number;
  failureCountLast24h: number;
  platformRevenueLast24hVnd: number;
  platformRevenueAllTimeVnd: number;
}

interface StatusAggregateRow {
  status: PaymentStatus;
  count: string;
  revenue: string | null;
}

interface RevenueRow {
  revenue: string | null;
}

@Injectable()
export class PaymentRepository {
  constructor(
    @InjectRepository(Payment)
    private readonly repository: Repository<Payment>
  ) {}

  async findByIdempotencyKey(
    idempotencyKey: string,
    manager?: EntityManager,
    lock = false
  ): Promise<Payment | null> {
    return this.getRepository(manager).findOne({
      where: { idempotencyKey },
      lock: lock ? { mode: "pessimistic_write" } : undefined
    });
  }

  async findByRideId(rideId: string, manager?: EntityManager): Promise<Payment | null> {
    return this.getRepository(manager).findOne({ where: { rideId } });
  }

  async insertPending(input: InsertPaymentInput, manager: EntityManager): Promise<Payment> {
    const repository = this.getRepository(manager);
    return repository.save(
      repository.create({
        rideId: input.rideId,
        pricingSnapshotId: input.pricingSnapshotId,
        idempotencyKey: input.idempotencyKey,
        status: input.status,
        customerUserId: input.customerUserId,
        driverUserId: input.driverUserId,
        currency: "VND",
        totalVnd: input.totalVnd,
        driverShareVnd: input.driverShareVnd,
        platformShareVnd: input.platformShareVnd,
        driverShareBps: input.driverShareBps,
        platformShareBps: input.platformShareBps,
        failureReason: input.failureReason ?? null,
        completedAt: null
      })
    );
  }

  async transitionStatus(
    payment: Payment,
    status: PaymentStatus,
    manager: EntityManager,
    failureReason?: string
  ): Promise<Payment> {
    payment.status = status;
    payment.failureReason = failureReason ?? null;
    payment.completedAt = status === PaymentStatus.SUCCEEDED ? new Date() : null;
    return this.getRepository(manager).save(payment);
  }

  async aggregateDashboardStats(since: Date): Promise<PaymentDashboardStats> {
    const windowRows = (await this.repository
      .createQueryBuilder("payment")
      .select("payment.status", "status")
      .addSelect("COUNT(*)::text", "count")
      .addSelect("COALESCE(SUM(payment.platform_share_vnd), 0)::text", "revenue")
      .where("payment.created_at >= :since", { since })
      .groupBy("payment.status")
      .getRawMany()) as StatusAggregateRow[];

    const allTimeRow = (await this.repository
      .createQueryBuilder("payment")
      .select("COALESCE(SUM(payment.platform_share_vnd), 0)::text", "revenue")
      .where("payment.status = :status", { status: PaymentStatus.SUCCEEDED })
      .getRawOne()) as RevenueRow | undefined;

    let successCount = 0;
    let failureCount = 0;
    let revenueWindow = 0;

    for (const row of windowRows) {
      const count = Number(row.count);
      const revenue = Number(row.revenue ?? "0");
      if (row.status === PaymentStatus.SUCCEEDED) {
        successCount += count;
        revenueWindow += revenue;
      } else if (
        row.status === PaymentStatus.FAILED_INSUFFICIENT_BALANCE ||
        row.status === PaymentStatus.FAILED_MISSING_SNAPSHOT
      ) {
        failureCount += count;
      }
    }

    return {
      successCountLast24h: successCount,
      failureCountLast24h: failureCount,
      platformRevenueLast24hVnd: revenueWindow,
      platformRevenueAllTimeVnd: Number(allTimeRow?.revenue ?? "0")
    };
  }

  private getRepository(manager?: EntityManager): Repository<Payment> {
    return manager?.getRepository(Payment) ?? this.repository;
  }
}
