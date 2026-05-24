import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";

import { Ride } from "../../rides/entities/ride.entity";
import { Payment } from "../entities/payment.entity";
import { PaymentStatus } from "../enums/payment-status.enum";
import type { InsertPaymentInput } from "../payments.types";
import type {
  DriverEarningsAggregate,
  DriverEarningsByDayRow,
  PaymentHistoryResult,
  PaymentHistoryRow
} from "../payments.types";

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

interface CountRow {
  count: string;
}

interface EarningsTotalRow {
  trips: string;
  earnings: string;
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

  async getPaymentHistoryForUser(
    role: "CUSTOMER" | "DRIVER",
    userId: string,
    page: number,
    pageSize: number
  ): Promise<PaymentHistoryResult> {
    const offset = (page - 1) * pageSize;
    const ownerColumn =
      role === "CUSTOMER" ? "payment.customer_user_id" : "payment.driver_user_id";

    const items = (await this.repository
      .createQueryBuilder("payment")
      .innerJoin(Ride, "ride", "ride.id = payment.ride_id")
      .select("payment.id", "id")
      .addSelect("payment.ride_id", "rideId")
      .addSelect("payment.total_vnd::text", "totalVnd")
      .addSelect("payment.driver_share_vnd::text", "driverShareVnd")
      .addSelect("payment.status", "status")
      .addSelect("payment.created_at", "createdAt")
      .addSelect("payment.completed_at", "completedAt")
      .addSelect("payment.failure_reason", "failureReason")
      .addSelect("ride.pickup_address", "pickupAddress")
      .addSelect("ride.destination_address", "destinationAddress")
      .where(`${ownerColumn} = :userId`, { userId })
      .orderBy("payment.created_at", "DESC")
      .offset(offset)
      .limit(pageSize)
      .getRawMany()) as Array<
      Omit<PaymentHistoryRow, "totalVnd" | "driverShareVnd"> & {
        totalVnd: string;
        driverShareVnd: string;
      }
    >;

    const totalRow = (await this.repository
      .createQueryBuilder("payment")
      .select("COUNT(*)::text", "count")
      .where(`${ownerColumn} = :userId`, { userId })
      .getRawOne()) as CountRow | undefined;

    return {
      items: items.map((item) => ({
        ...item,
        totalVnd: Number(item.totalVnd),
        driverShareVnd: Number(item.driverShareVnd)
      })),
      total: Number(totalRow?.count ?? "0")
    };
  }

  async aggregateDriverEarnings(
    driverUserId: string,
    from: Date,
    to: Date
  ): Promise<DriverEarningsAggregate> {
    const totals = (await this.repository
      .createQueryBuilder("payment")
      .select("COUNT(*)::text", "trips")
      .addSelect("COALESCE(SUM(payment.driver_share_vnd), 0)::text", "earnings")
      .where("payment.driver_user_id = :driverUserId", { driverUserId })
      .andWhere("payment.status = :status", { status: PaymentStatus.SUCCEEDED })
      .andWhere("payment.created_at >= :from", { from })
      .andWhere("payment.created_at < :to", { to })
      .getRawOne()) as EarningsTotalRow | undefined;

    const byDayRows = (await this.repository
      .createQueryBuilder("payment")
      .select("TO_CHAR(DATE_TRUNC('day', payment.created_at), 'YYYY-MM-DD')", "date")
      .addSelect("COALESCE(SUM(payment.driver_share_vnd), 0)::text", "earningsVnd")
      .addSelect("COUNT(*)::text", "trips")
      .where("payment.driver_user_id = :driverUserId", { driverUserId })
      .andWhere("payment.status = :status", { status: PaymentStatus.SUCCEEDED })
      .andWhere("payment.created_at >= :from", { from })
      .andWhere("payment.created_at < :to", { to })
      .groupBy("DATE_TRUNC('day', payment.created_at)")
      .orderBy("DATE_TRUNC('day', payment.created_at)", "ASC")
      .getRawMany()) as Array<{ date: string; earningsVnd: string; trips: string }>;

    return {
      tripsCompleted: Number(totals?.trips ?? "0"),
      totalEarningsVnd: Number(totals?.earnings ?? "0"),
      byDay: byDayRows.map(
        (row): DriverEarningsByDayRow => ({
          date: row.date,
          earningsVnd: Number(row.earningsVnd),
          trips: Number(row.trips)
        })
      )
    };
  }

  private getRepository(manager?: EntityManager): Repository<Payment> {
    return manager?.getRepository(Payment) ?? this.repository;
  }
}
