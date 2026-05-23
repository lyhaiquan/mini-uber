import { usePickupDestinationStore } from "../pickup-destination-store";

describe("usePickupDestinationStore (mobile)", () => {
  beforeEach(() => usePickupDestinationStore.getState().reset());

  it("setPickup persists coord + address", () => {
    usePickupDestinationStore.getState().setPickup({ lat: 1, lng: 2 }, "X");
    const s = usePickupDestinationStore.getState();
    expect(s.pickup).toEqual({ lat: 1, lng: 2 });
    expect(s.pickupAddress).toBe("X");
  });

  it("reset clears all", () => {
    const s = usePickupDestinationStore.getState();
    s.setPickup({ lat: 1, lng: 2 }, "X");
    s.setDestination({ lat: 3, lng: 4 }, "Y");
    s.reset();
    expect(usePickupDestinationStore.getState().pickup).toBeNull();
    expect(usePickupDestinationStore.getState().destinationAddress).toBeNull();
  });
});
