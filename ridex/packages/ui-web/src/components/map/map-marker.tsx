"use client";

import * as React from "react";
import { Marker } from "react-map-gl";

import type { MapMarkerData } from "./types";

const variantStyle: Record<NonNullable<MapMarkerData["variant"]>, string> = {
  pickup:
    "h-4 w-4 rounded-full border-2 border-white bg-[#0a84ff] shadow-[0_0_0_3px_rgba(10,132,255,0.25)]",
  destination:
    "h-4 w-4 border-2 border-white bg-black shadow-[0_0_0_3px_rgba(0,0,0,0.25)]",
  self: ""
};

export interface MapMarkerProps {
  marker: MapMarkerData;
}

export function MapMarker({ marker }: MapMarkerProps) {
  const variant = marker.variant ?? "pickup";
  return (
    <Marker
      longitude={marker.coord.lng}
      latitude={marker.coord.lat}
      anchor="center"
    >
      {variant === "self" ? (
        <div
          aria-label={marker.label ?? "self"}
          style={{ transform: `rotate(${marker.heading ?? 0}deg)` }}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0a84ff] text-white shadow"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden focusable="false">
            <path d="M12 2 4 22l8-6 8 6Z" fill="currentColor" />
          </svg>
        </div>
      ) : (
        <div aria-label={marker.label ?? variant} className={variantStyle[variant]} />
      )}
    </Marker>
  );
}
