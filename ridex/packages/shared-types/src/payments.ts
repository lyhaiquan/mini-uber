import { z } from "zod";

import { isoDateTimeSchema } from "./common";

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
