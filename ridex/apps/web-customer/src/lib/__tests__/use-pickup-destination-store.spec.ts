import { beforeEach, describe, expect, it } from "vitest";

import { usePickupDestinationStore } from "../use-pickup-destination-store";

describe("usePickupDestinationStore", () => {
  beforeEach(() => {
    usePickupDestinationStore.getState().reset();
  });

  it("setPickup stores coord and address together", () => {
    usePickupDestinationStore.getState().setPickup({ lat: 10.7, lng: 106.7 }, "Bến Thành");
    const state = usePickupDestinationStore.getState();
    expect(state.pickup).toEqual({ lat: 10.7, lng: 106.7 });
    expect(state.pickupAddress).toBe("Bến Thành");
  });

  it("setDestination stores coord and address", () => {
    usePickupDestinationStore
      .getState()
      .setDestination({ lat: 10.8, lng: 106.6 }, "Thủ Thiêm");
    expect(usePickupDestinationStore.getState().destinationAddress).toBe("Thủ Thiêm");
  });

  it("reset clears all fields", () => {
    const s = usePickupDestinationStore.getState();
    s.setPickup({ lat: 1, lng: 1 }, "A");
    s.setDestination({ lat: 2, lng: 2 }, "B");
    s.reset();
    const after = usePickupDestinationStore.getState();
    expect(after.pickup).toBeNull();
    expect(after.destination).toBeNull();
    expect(after.pickupAddress).toBeNull();
    expect(after.destinationAddress).toBeNull();
  });
});
