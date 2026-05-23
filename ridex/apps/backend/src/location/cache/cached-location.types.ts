export interface CachedLocation {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  recordedAt: string;
  receivedAt: string;
}

