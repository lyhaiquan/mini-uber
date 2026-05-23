import type { DomainEvent } from "../../common/domain-event";
import { DRIVER_LOCATION_UPDATED_EVENT } from "../../common/events/event-types";

export { DRIVER_LOCATION_UPDATED_EVENT };
export const DRIVER_LOCATION_UPDATE_WS_EVENT = "driver.location.update";
export const WS_ERROR_EVENT = "ws:error";

export interface DriverLocationUpdatedPayload {
  driverId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  recordedAt: string;
  receivedAt: string;
}

export type DriverLocationUpdatedDomainEvent = DomainEvent<DriverLocationUpdatedPayload>;

