"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import * as React from "react";
import Map, { NavigationControl, type MapLayerMouseEvent } from "react-map-gl";

import { MapMarker } from "./map-marker";
import { MapRoute } from "./map-route";
import type { LatLng, MapMarkerData } from "./types";
import { SAIGON_FALLBACK } from "./use-current-location";

export interface MapViewProps {
  token: string;
  initialCenter?: LatLng;
  initialZoom?: number;
  markers?: MapMarkerData[];
  route?: GeoJSON.LineString;
  onMapClick?: (point: LatLng) => void;
  styleUrl?: string;
  className?: string;
}

const DEFAULT_STYLE = "mapbox://styles/mapbox/streets-v12";

export function MapView({
  token,
  initialCenter = SAIGON_FALLBACK,
  initialZoom = 13,
  markers,
  route,
  onMapClick,
  styleUrl = DEFAULT_STYLE,
  className
}: MapViewProps) {
  const handleClick = React.useCallback(
    (event: MapLayerMouseEvent) => {
      if (!onMapClick) return;
      onMapClick({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    },
    [onMapClick]
  );

  return (
    <div className={className} style={{ width: "100%", height: "100%", minHeight: 320 }}>
      <Map
        mapboxAccessToken={token}
        initialViewState={{
          longitude: initialCenter.lng,
          latitude: initialCenter.lat,
          zoom: initialZoom
        }}
        mapStyle={styleUrl}
        onClick={onMapClick ? handleClick : undefined}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" />
        {markers?.map((m) => (
          <MapMarker key={m.id} marker={m} />
        ))}
        {route ? <MapRoute geometry={route} /> : null}
      </Map>
    </div>
  );
}
