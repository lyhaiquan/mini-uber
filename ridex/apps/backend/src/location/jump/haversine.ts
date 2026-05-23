export const EARTH_RADIUS_METERS = 6_371_000;

export function haversine(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const fromLatRadians = degreesToRadians(fromLat);
  const toLatRadians = degreesToRadians(toLat);
  const deltaLatRadians = degreesToRadians(toLat - fromLat);
  const deltaLngRadians = degreesToRadians(toLng - fromLng);

  const a =
    Math.sin(deltaLatRadians / 2) ** 2 +
    Math.cos(fromLatRadians) *
      Math.cos(toLatRadians) *
      Math.sin(deltaLngRadians / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

