export interface LatLng {
  lat: number;
  lng: number;
}

export type MapMarkerVariant = "pickup" | "destination" | "self";

export interface MapMarkerData {
  id: string;
  coord: LatLng;
  variant?: MapMarkerVariant;
  heading?: number;
  label?: string;
}

export const SAIGON_FALLBACK: LatLng = { lat: 10.7769, lng: 106.7009 };
