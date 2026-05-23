export class MatchingRideNotEligibleError extends Error {
  constructor(rideId: string) {
    super(`Ride is not eligible for matching: ${rideId}`);
    this.name = "MatchingRideNotEligibleError";
  }
}

export class OfferNotFoundError extends Error {
  constructor(offerId: string) {
    super(`Offer not found: ${offerId}`);
    this.name = "OfferNotFoundError";
  }
}

export class OfferNotOfferableError extends Error {
  constructor(offerId: string) {
    super(`Offer is no longer offerable: ${offerId}`);
    this.name = "OfferNotOfferableError";
  }
}

export class OfferNotForDriverError extends Error {
  constructor(offerId: string) {
    super(`Offer is not addressed to this driver: ${offerId}`);
    this.name = "OfferNotForDriverError";
  }
}

