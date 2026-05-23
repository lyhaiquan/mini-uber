import type { DomainEvent } from "../../common/domain-event";
import {
  DRIVER_WENT_OFFLINE_EVENT,
  DRIVER_WENT_ONLINE_EVENT
} from "../../common/events/event-types";

export { DRIVER_WENT_OFFLINE_EVENT, DRIVER_WENT_ONLINE_EVENT };

export interface DriverWentOnlinePayload {
  driverId: string;
  onlineSince: string;
}

export interface DriverWentOfflinePayload {
  driverId: string;
  offlineAt: string;
}

export type DriverWentOnlineDomainEvent = DomainEvent<DriverWentOnlinePayload>;
export type DriverWentOfflineDomainEvent = DomainEvent<DriverWentOfflinePayload>;

