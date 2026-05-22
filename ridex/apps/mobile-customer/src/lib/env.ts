import Constants from "expo-constants";
import { z } from "zod";

const envSchema = z.object({
  apiBaseUrl: z.string().url(),
  wsUrl: z.string().url(),
  mapboxToken: z.string().min(20).optional().or(z.literal(""))
});

const raw = Constants.expoConfig?.extra ?? {};

const parsed = envSchema.safeParse(raw);

export const env = parsed.success
  ? parsed.data
  : {
      apiBaseUrl: "http://localhost:3000/api/v1",
      wsUrl: "http://localhost:3000",
      mapboxToken: ""
    };

if (!parsed.success) {
  console.warn("[env] using fallback values; expo extra missing or invalid:", parsed.error.format());
}
