import { type MigrationInterface, type QueryRunner } from "typeorm";

export class AddRoutePolylineToPricingSnapshots1778952000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pricing_snapshots"
        ADD COLUMN "route_polyline" text NULL,
        ADD COLUMN "route_polyline_format" text NULL
          CHECK ("route_polyline_format" IS NULL OR "route_polyline_format" = 'polyline5')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pricing_snapshots"
        DROP COLUMN IF EXISTS "route_polyline_format",
        DROP COLUMN IF EXISTS "route_polyline"
    `);
  }
}
