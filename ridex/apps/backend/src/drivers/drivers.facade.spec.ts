import type { DriversService } from "./drivers.service";
import { DriversFacade } from "./drivers.facade";

const DRIVER_ID = "33333333-3333-3333-3333-333333333333";

function createFacade(): {
  facade: DriversFacade;
  service: jest.Mocked<DriversService>;
} {
  const service = {
    setOnline: jest.fn(),
    setOffline: jest.fn(),
    isOnline: jest.fn(),
    getAvailability: jest.fn(),
    countOnline: jest.fn(),
    countTotal: jest.fn()
  } as unknown as jest.Mocked<DriversService>;
  return { facade: new DriversFacade(service), service };
}

describe("DriversFacade", () => {
  it("delegates setOnline", async () => {
    const { facade, service } = createFacade();

    await facade.setOnline(DRIVER_ID, "c1");

    expect(service.setOnline).toHaveBeenCalledWith(DRIVER_ID, "c1");
  });

  it("delegates setOffline", async () => {
    const { facade, service } = createFacade();

    await facade.setOffline(DRIVER_ID, "c1");

    expect(service.setOffline).toHaveBeenCalledWith(DRIVER_ID, "c1");
  });

  it("delegates isOnline", async () => {
    const { facade, service } = createFacade();
    service.isOnline.mockResolvedValue(true);

    await expect(facade.isOnline(DRIVER_ID)).resolves.toBe(true);
  });

  it("delegates getAvailability", async () => {
    const { facade, service } = createFacade();
    const availability = { isOnline: false, onlineSince: null, lastSeenAt: null };
    service.getAvailability.mockResolvedValue(availability);

    await expect(facade.getAvailability(DRIVER_ID)).resolves.toBe(availability);
  });

  it("getDriverPopulation aggregates online and total counts", async () => {
    const { facade, service } = createFacade();
    service.countOnline.mockResolvedValue(23);
    service.countTotal.mockResolvedValue(95);

    await expect(facade.getDriverPopulation()).resolves.toEqual({
      online: 23,
      totalRegistered: 95
    });
  });

  it("getDriverPopulation returns zeros when no drivers exist", async () => {
    const { facade, service } = createFacade();
    service.countOnline.mockResolvedValue(0);
    service.countTotal.mockResolvedValue(0);

    await expect(facade.getDriverPopulation()).resolves.toEqual({
      online: 0,
      totalRegistered: 0
    });
  });
});

