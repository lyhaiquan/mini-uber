"use client";

import type { LatLng } from "@ridex/ui-web";
import { create } from "zustand";

export interface PickupDestinationState {
  pickup: LatLng | null;
  destination: LatLng | null;
  pickupLabel: string | null;
  destinationLabel: string | null;
  setPickup: (coord: LatLng, label?: string) => void;
  setDestination: (coord: LatLng, label?: string) => void;
  reset: () => void;
}

export const usePickupDestinationStore = create<PickupDestinationState>((set) => ({
  pickup: null,
  destination: null,
  pickupLabel: null,
  destinationLabel: null,
  setPickup: (coord, label) => set({ pickup: coord, pickupLabel: label ?? null }),
  setDestination: (coord, label) =>
    set({ destination: coord, destinationLabel: label ?? null }),
  reset: () =>
    set({ pickup: null, destination: null, pickupLabel: null, destinationLabel: null })
}));
