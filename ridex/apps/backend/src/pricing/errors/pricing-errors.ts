export class PricingSnapshotNotFoundError extends Error {
  constructor(rideId: string) {
    super(`Pricing snapshot not found for ride: ${rideId}`);
    this.name = "PricingSnapshotNotFoundError";
  }
}

export class InvalidPricingInputError extends Error {
  constructor(message: string) {
    super(`Invalid pricing input: ${message}`);
    this.name = "InvalidPricingInputError";
  }
}
