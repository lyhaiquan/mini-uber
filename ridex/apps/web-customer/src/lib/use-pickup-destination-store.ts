"use client";

import type { LatLng } from "@ridex/ui-web";
import { create } from "zustand";

export interface PickupDestinationState {
  pickup: LatLng | null;
  destination: LatLng | null;
  pickupAddress: string | null;
  destinationAddress: string | null;
  setPickup: (coord: LatLng, address?: string) => void;
  setDestination: (coord: LatLng, address?: string) => void;
  reset: () => void;
}

export const usePickupDestinationStore = create<PickupDestinationState>((set) => ({
  pickup: null,
  destination: null,
  pickupAddress: null,
  destinationAddress: null,
  setPickup: (coord, address) => set({ pickup: coord, pickupAddress: address ?? null }),
  setDestination: (coord, address) =>
    set({ destination: coord, destinationAddress: address ?? null }),
  reset: () =>
    set({
      pickup: null,
      destination: null,
      pickupAddress: null,
      destinationAddress: null
    })
}));
