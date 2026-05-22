import { z } from "zod";

const schema = z.object({
  API_BASE_URL_INTERNAL: z.string().url()
});

const parsed = schema.safeParse({
  API_BASE_URL_INTERNAL:
    process.env.API_BASE_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_BASE_URL
});

if (!parsed.success) {
  console.warn(
    "[server-env] API_BASE_URL_INTERNAL not set — falling back to http://localhost:3000/api/v1"
  );
}

export const serverEnv = parsed.success
  ? parsed.data
  : { API_BASE_URL_INTERNAL: "http://localhost:3000/api/v1" };
