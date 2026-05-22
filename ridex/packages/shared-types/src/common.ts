import { z } from "zod";

export const apiMetaSchema = z
  .object({
    requestId: z.string().optional()
  })
  .optional();

export const apiEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: apiMetaSchema
  });

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional()
  }),
  meta: apiMetaSchema
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  total: z.number().int().min(0)
});
export type Pagination = z.infer<typeof paginationSchema>;

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(1).max(512)
});
export type GeoPoint = z.infer<typeof geoPointSchema>;

export const isoDateTimeSchema = z.string().datetime({ offset: true });
