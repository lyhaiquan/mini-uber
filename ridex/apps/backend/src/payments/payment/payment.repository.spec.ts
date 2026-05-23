import type { EntityManager, Repository, SelectQueryBuilder } from "typeorm";

import type { Payment } from "../entities/payment.entity";
import { PaymentStatus } from "../enums/payment-status.enum";
import { PaymentRepository } from "./payment.repository";

describe("PaymentRepository", () => {
  it("findByIdempotencyKey delegates to TypeORM", async () => {
    const { repository, typeormRepository } = createRepository();
    typeormRepository.findOne.mockResolvedValue(payment());

    await repository.findByIdempotencyKey("auto:ride:1");

    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      where: { idempotencyKey: "auto:ride:1" }
    });
  });

  it("findByIdempotencyKey can acquire a pessimistic lock", async () => {
    const { repository } = createRepository();
    const managerRepo = { findOne: jest.fn().mockResolvedValue(payment()) };
    const manager = {
      getRepository: jest.fn().mockReturnValue(managerRepo)
    } as unknown as EntityManager;

    await repository.findByIdempotencyKey("auto:ride:1", manager, true);

    expect(managerRepo.findOne).toHaveBeenCalledWith({
      where: { idempotencyKey: "auto:ride:1" },
      lock: { mode: "pessimistic_write" }
    });
  });

  it("insertPending creates a payment row", async () => {
    const { repository } = createRepository();
    const managerRepo = {
      create: jest.fn((value: Partial<Payment>) => value as Payment),
      save: jest.fn(async (value: Payment) => ({ ...value, id: "payment-1" }))
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(managerRepo)
    } as unknown as EntityManager;

    const result = await repository.insertPending(
      {
        rideId: "ride-1",
        pricingSnapshotId: "snapshot-1",
        idempotencyKey: "auto:ride:1",
        status: PaymentStatus.PENDING,
        customerUserId: "customer",
        driverUserId: "driver",
        totalVnd: 100_000,
        driverShareVnd: 80_000,
        platformShareVnd: 20_000,
        driverShareBps: 8000,
        platformShareBps: 2000
      },
      manager
    );

    expect(result.id).toBe("payment-1");
    expect(managerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "VND", status: PaymentStatus.PENDING })
    );
  });

  it("transitionStatus marks success with completedAt", async () => {
    const { repository } = createRepository();
    const managerRepo = { save: jest.fn(async (value: Payment) => value) };
    const manager = {
      getRepository: jest.fn().mockReturnValue(managerRepo)
    } as unknown as EntityManager;

    const result = await repository.transitionStatus(
      payment({ status: PaymentStatus.PENDING }),
      PaymentStatus.SUCCEEDED,
      manager
    );

    expect(result.status).toBe(PaymentStatus.SUCCEEDED);
    expect(result.completedAt).toBeInstanceOf(Date);
  });

  it("findByRideId returns payment for ride", async () => {
    const { repository, typeormRepository } = createRepository();
    typeormRepository.findOne.mockResolvedValue(payment());

    await repository.findByRideId("ride-1");

    expect(typeormRepository.findOne).toHaveBeenCalledWith({ where: { rideId: "ride-1" } });
  });

  it("aggregateDashboardStats maps SUCCEEDED + FAILED counts and revenue", async () => {
    const { repository, typeormRepository } = createRepository();
    const windowBuilder = createQueryBuilder([
      { status: PaymentStatus.SUCCEEDED, count: "138", revenue: "4250000" },
      { status: PaymentStatus.FAILED_INSUFFICIENT_BALANCE, count: "4", revenue: "0" },
      { status: PaymentStatus.FAILED_MISSING_SNAPSHOT, count: "2", revenue: "0" }
    ]);
    const allTimeBuilder = createQueryBuilder({ revenue: "18750000" });
    typeormRepository.createQueryBuilder
      .mockReturnValueOnce(windowBuilder.asTypeOrm)
      .mockReturnValueOnce(allTimeBuilder.asTypeOrm);

    const stats = await repository.aggregateDashboardStats(new Date("2026-05-17T00:00:00.000Z"));

    expect(stats).toEqual({
      successCountLast24h: 138,
      failureCountLast24h: 6,
      platformRevenueLast24hVnd: 4_250_000,
      platformRevenueAllTimeVnd: 18_750_000
    });
    expect(windowBuilder.groupBy).toHaveBeenCalledWith("payment.status");
    expect(allTimeBuilder.where).toHaveBeenCalledWith("payment.status = :status", {
      status: PaymentStatus.SUCCEEDED
    });
  });

  it("aggregateDashboardStats returns zeros when nothing matches", async () => {
    const { repository, typeormRepository } = createRepository();
    typeormRepository.createQueryBuilder
      .mockReturnValueOnce(createQueryBuilder([]).asTypeOrm)
      .mockReturnValueOnce(createQueryBuilder({ revenue: "0" }).asTypeOrm);

    await expect(
      repository.aggregateDashboardStats(new Date())
    ).resolves.toEqual({
      successCountLast24h: 0,
      failureCountLast24h: 0,
      platformRevenueLast24hVnd: 0,
      platformRevenueAllTimeVnd: 0
    });
  });

  it("aggregateDashboardStats treats unknown statuses as neither success nor failure", async () => {
    const { repository, typeormRepository } = createRepository();
    typeormRepository.createQueryBuilder
      .mockReturnValueOnce(
        createQueryBuilder([{ status: PaymentStatus.PENDING, count: "9", revenue: "0" }]).asTypeOrm
      )
      .mockReturnValueOnce(createQueryBuilder({ revenue: "0" }).asTypeOrm);

    const stats = await repository.aggregateDashboardStats(new Date());

    expect(stats.successCountLast24h).toBe(0);
    expect(stats.failureCountLast24h).toBe(0);
  });
});

interface QueryBuilderMock {
  select: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  groupBy: jest.Mock;
  getRawMany: jest.Mock;
  getRawOne: jest.Mock;
  asTypeOrm: SelectQueryBuilder<Payment>;
}

function createQueryBuilder(result: unknown): QueryBuilderMock {
  const builder: Partial<QueryBuilderMock> = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    groupBy: jest.fn(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn()
  };
  builder.select!.mockReturnValue(builder);
  builder.addSelect!.mockReturnValue(builder);
  builder.where!.mockReturnValue(builder);
  builder.groupBy!.mockReturnValue(builder);
  builder.getRawMany!.mockResolvedValue(result);
  builder.getRawOne!.mockResolvedValue(result);
  builder.asTypeOrm = builder as unknown as SelectQueryBuilder<Payment>;
  return builder as QueryBuilderMock;
}

function createRepository(): {
  repository: PaymentRepository;
  typeormRepository: jest.Mocked<Repository<Payment>>;
} {
  const typeormRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn()
  } as unknown as jest.Mocked<Repository<Payment>>;
  return {
    repository: new PaymentRepository(typeormRepository),
    typeormRepository
  };
}

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment",
    rideId: "ride-1",
    pricingSnapshotId: "snapshot-1",
    idempotencyKey: "auto:ride:1",
    status: PaymentStatus.PENDING,
    customerUserId: "customer",
    driverUserId: "driver",
    currency: "VND",
    totalVnd: 100_000,
    driverShareVnd: 80_000,
    platformShareVnd: 20_000,
    driverShareBps: 8000,
    platformShareBps: 2000,
    failureReason: null,
    createdAt: new Date("2026-05-17T00:00:00.000Z"),
    completedAt: null,
    ...overrides
  };
}
