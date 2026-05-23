import { getMetadataArgsStorage, type ValueTransformer } from "typeorm";

import { PricingSnapshot } from "./pricing-snapshot.entity";

describe("PricingSnapshot entity metadata", () => {
  it("does not declare a redundant ride_id index alongside the unique constraint", () => {
    const indexes = getMetadataArgsStorage().indices.filter(
      (index) => index.target === PricingSnapshot
    );

    expect(indexes).toEqual([]);
  });

  it("throws instead of masking null bigint values from the database", () => {
    const transformer = getColumnTransformer("baseFareVnd");

    expect(() => transformer.from(null)).toThrow(/column returned null/);
  });
});

function getColumnTransformer(propertyName: keyof PricingSnapshot): ValueTransformer {
  const column = getMetadataArgsStorage().columns.find(
    (entry) => entry.target === PricingSnapshot && entry.propertyName === propertyName
  );
  const transformer = column?.options.transformer;

  if (Array.isArray(transformer) || transformer === undefined) {
    throw new Error(`Expected one transformer for ${String(propertyName)}`);
  }

  return transformer;
}
