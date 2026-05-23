import { apiEnvelopeSchema } from "@ridex/shared-types";
import { z } from "zod";

export const emptyResponseSchema = z.undefined();
export const okResponseSchema = z.object({ ok: z.literal(true) });

export const enveloped = <T extends z.ZodTypeAny>(schema: T) =>
  apiEnvelopeSchema(schema).transform(
    (envelope) => (envelope as unknown as { data: z.infer<T> }).data
  );
