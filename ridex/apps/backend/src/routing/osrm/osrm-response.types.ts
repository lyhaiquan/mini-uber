export interface OsrmRouteResponse {
  distance: number;
  duration: number;
  geometry: string;
}

export interface OsrmRouteApiResponse {
  code?: string;
  routes?: unknown[];
}

