export const H3_DRIVER_INDEX_RES_8 = 8;
export const H3_DRIVER_INDEX_RES_9 = 9;
export const H3_DISCOVERY_MAX_RING_DEFAULT = 5;

export const H3_DRIVER_INDEX_RESOLUTIONS = [
  H3_DRIVER_INDEX_RES_8,
  H3_DRIVER_INDEX_RES_9
] as const;

export type H3DriverIndexResolution = (typeof H3_DRIVER_INDEX_RESOLUTIONS)[number];
