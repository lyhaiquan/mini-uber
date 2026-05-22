import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_WS_URL: z.string().url(),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().min(20).optional()
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN
});

if (!parsed.success && process.env.NODE_ENV !== "test") {
  console.error("Invalid environment variables:", parsed.error.format());
}

export const env = parsed.success
  ? parsed.data
  : {
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:3000/api/v1",
      NEXT_PUBLIC_WS_URL: "http://localhost:3000",
      NEXT_PUBLIC_MAPBOX_TOKEN: undefined
    };
