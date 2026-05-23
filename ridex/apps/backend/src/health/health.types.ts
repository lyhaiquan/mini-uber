import type { ApiSuccessResponse } from "../common/api-response";

export interface HealthStatus {
  status: "ok";
  service: string;
  timestamp: string;
  uptimeSeconds: number;
}

export type HealthResponse = ApiSuccessResponse<HealthStatus>;
