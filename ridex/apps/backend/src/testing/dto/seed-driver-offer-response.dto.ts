export interface SeedDriverOfferResponseDto {
  mode: "prepare" | "dispatch-offer";
  testRunId: string;
  driver: {
    userId: string;
    email: string;
    password: string;
  };
  customer: {
    userId: string;
    email: string;
    password: string;
  };
  rideId: string | null;
  offerId: string | null;
}
