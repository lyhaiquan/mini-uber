export interface DomainEvent<TPayload> {
  eventId: string;
  eventType: string;
  aggregateType: "driver" | "ride" | "offer" | "pricing-snapshot" | "payment" | "user";
  aggregateId: string;
  payload: TPayload;
  correlationId: string;
  occurredAt: string;
  emittedBy: "drivers" | "location" | "rides" | "matching" | "pricing" | "payments" | "auth";
}
