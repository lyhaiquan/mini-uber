import { z } from "zod";

import { isoDateTimeSchema, paginationSchema } from "./common";

export const walletKindSchema = z.enum(["CUSTOMER", "DRIVER", "PLATFORM"]);
export type WalletKind = z.infer<typeof walletKindSchema>;

export const paymentStatusSchema = z.enum([
  "PENDING",
  "SUCCEEDED",
  "FAILED_INSUFFICIENT_BALANCE",
  "FAILED_MISSING_SNAPSHOT"
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const ledgerEntryTypeSchema = z.enum(["DEBIT", "CREDIT"]);
export type LedgerEntryType = z.infer<typeof ledgerEntryTypeSchema>;

export const walletSchema = z.object({
  id: z.string().uuid(),
  ownerUserId: z.string().uuid().nullable(),
  kind: walletKindSchema,
  balanceVnd: z.number().int().min(0),
  updatedAt: isoDateTimeSchema
});
export type Wallet = z.infer<typeof walletSchema>;

export const paymentSchema = z.object({
  id: z.string().uuid(),
  rideId: z.string().uuid(),
  customerId: z.string().uuid(),
  driverUserId: z.string().uuid().nullable(),
  amountVnd: z.number().int().min(0),
  driverShareVnd: z.number().int().min(0),
  platformShareVnd: z.number().int().min(0),
  status: paymentStatusSchema,
  idempotencyKey: z.string().min(1),
  createdAt: isoDateTimeSchema,
  settledAt: isoDateTimeSchema.nullable()
});
export type Payment = z.infer<typeof paymentSchema>;

export const ledgerEntrySchema = z.object({
  id: z.string().uuid(),
  walletId: z.string().uuid(),
  paymentId: z.string().uuid().nullable(),
  type: ledgerEntryTypeSchema,
  amountVnd: z.number().int().min(0),
  balanceAfterVnd: z.number().int().min(0),
  description: z.string(),
  createdAt: isoDateTimeSchema
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

export const walletSummarySchema = z.object({
  kind: z.union([z.literal("CUSTOMER"), z.literal("DRIVER")]),
  balanceVnd: z.number().int().min(0),
  currency: z.literal("VND"),
  lastUpdatedAt: isoDateTimeSchema
});
export type WalletSummary = z.infer<typeof walletSummarySchema>;

export const paymentRideSummarySchema = z.object({
  pickupAddress: z.string().min(1),
  destinationAddress: z.string().min(1)
});
export type PaymentRideSummary = z.infer<typeof paymentRideSummarySchema>;

export const paymentHistoryItemSchema = z.object({
  id: z.string().uuid(),
  rideId: z.string().uuid(),
  totalVnd: z.number().int().min(0),
  driverShareVnd: z.number().int().min(0),
  status: paymentStatusSchema,
  createdAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.nullable(),
  failureReason: z.string().nullable(),
  rideSummary: paymentRideSummarySchema
});
export type PaymentHistoryItem = z.infer<typeof paymentHistoryItemSchema>;

export const paymentHistoryResponseSchema = z.object({
  data: z.array(paymentHistoryItemSchema),
  meta: paginationSchema
});
export type PaymentHistoryResponse = z.infer<typeof paymentHistoryResponseSchema>;

export const driverEarningsDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  earningsVnd: z.number().int().min(0),
  trips: z.number().int().min(0)
});
export type DriverEarningsDay = z.infer<typeof driverEarningsDaySchema>;

export const driverEarningsSummarySchema = z.object({
  windowFrom: isoDateTimeSchema,
  windowTo: isoDateTimeSchema,
  tripsCompleted: z.number().int().min(0),
  totalEarningsVnd: z.number().int().min(0),
  byDay: z.array(driverEarningsDaySchema)
});
export type DriverEarningsSummary = z.infer<typeof driverEarningsSummarySchema>;
