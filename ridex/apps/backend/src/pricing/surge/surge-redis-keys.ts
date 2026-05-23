import { SURGE_DEMAND_KEY_PREFIX } from "../pricing.constants";

export function demandKey(cellId: string): string {
  return `${SURGE_DEMAND_KEY_PREFIX}${cellId}`;
}
