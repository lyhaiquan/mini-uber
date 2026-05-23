export class PaymentSnapshotMissingError extends Error {
  constructor(rideId: string) {
    super(`Pricing snapshot missing for ride: ${rideId}`);
    this.name = "PaymentSnapshotMissingError";
  }
}

export class InsufficientBalanceError extends Error {
  constructor() {
    super("Customer wallet balance is insufficient.");
    this.name = "InsufficientBalanceError";
  }
}

export class WalletNotFoundError extends Error {
  constructor(message = "Wallet not found.") {
    super(message);
    this.name = "WalletNotFoundError";
  }
}
