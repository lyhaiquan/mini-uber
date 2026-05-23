"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  LocationSearch,
  MapView,
  SAIGON_FALLBACK,
  toast,
  useCurrentLocation,
  type LatLng,
  type MapMarkerData
} from "@ridex/ui-web";
import { useRouter } from "next/navigation";
import * as React from "react";

import { ConfirmRideButton } from "@/components/ride/confirm-ride-button";
import { FareEstimateCard } from "@/components/ride/fare-estimate-card";
import { useRideQuote } from "@/hooks/use-ride-quote";
import { useActiveRide, useCreateRide } from "@/hooks/use-rides";
import { apiErrorToMessage } from "@/lib/api-error";
import { usePickupDestinationStore } from "@/lib/use-pickup-destination-store";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const MIN_DISTANCE_METERS = 100;
const MAX_DISTANCE_METERS = 50_000;

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function HomeMap() {
  const router = useRouter();
  const { coords, isFallback } = useCurrentLocation();
  const {
    pickup,
    destination,
    pickupAddress,
    destinationAddress,
    setPickup,
    setDestination,
    reset
  } = usePickupDestinationStore();

  const activeRideQuery = useActiveRide();
  React.useEffect(() => {
    const active = activeRideQuery.data;
    if (active !== null && active !== undefined) {
      router.replace(`/rides/${active.id}`);
    }
  }, [activeRideQuery.data, router]);

  const quote = useRideQuote({ pickup, destination });
  const createRide = useCreateRide();

  const handleMapClick = React.useCallback(
    (point: LatLng) => {
      if (!pickup) setPickup(point);
      else if (!destination) setDestination(point);
    },
    [pickup, destination, setPickup, setDestination]
  );

  const markers = React.useMemo<MapMarkerData[]>(() => {
    const out: MapMarkerData[] = [];
    if (pickup) out.push({ id: "pickup", coord: pickup, variant: "pickup", label: "Đón" });
    if (destination)
      out.push({
        id: "destination",
        coord: destination,
        variant: "destination",
        label: "Đến"
      });
    return out;
  }, [pickup, destination]);

  const route = React.useMemo<GeoJSON.LineString | undefined>(() => {
    if (!pickup || !destination) return undefined;
    return {
      type: "LineString",
      coordinates: [
        [pickup.lng, pickup.lat],
        [destination.lng, destination.lat]
      ]
    };
  }, [pickup, destination]);

  const distanceMeters =
    pickup && destination ? haversineMeters(pickup, destination) : null;

  const validationError = React.useMemo(() => {
    if (distanceMeters === null) return null;
    if (distanceMeters < MIN_DISTANCE_METERS) return "Pickup và đến quá gần.";
    if (distanceMeters > MAX_DISTANCE_METERS) return "Vượt quá phạm vi phục vụ.";
    return null;
  }, [distanceMeters]);

  const handleConfirm = React.useCallback(() => {
    if (!pickup || !destination) return;
    createRide.mutate(
      {
        pickup: {
          lat: pickup.lat,
          lng: pickup.lng,
          address: pickupAddress ?? `${pickup.lat.toFixed(5)}, ${pickup.lng.toFixed(5)}`
        },
        destination: {
          lat: destination.lat,
          lng: destination.lng,
          address:
            destinationAddress ??
            `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`
        }
      },
      {
        onSuccess: (ride) => {
          reset();
          router.push(`/rides/${ride.id}`);
        },
        onError: (err) => {
          const isAlreadyActive =
            err instanceof Error && /RIDE_ALREADY_ACTIVE/.test(err.message);
          if (isAlreadyActive) {
            void activeRideQuery.refetch();
            toast.error("Bạn đang có chuyến đi. Đang chuyển hướng...");
          } else {
            toast.error(apiErrorToMessage(err));
          }
        }
      }
    );
  }, [
    pickup,
    destination,
    pickupAddress,
    destinationAddress,
    createRide,
    reset,
    router,
    activeRideQuery
  ]);

  if (!MAPBOX_TOKEN) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6">
          <CardTitle>Cần Mapbox token</CardTitle>
          <CardDescription>
            Đặt biến môi trường <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> trong{" "}
            <code>.env.local</code> để bật map.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <LocationSearch
            token={MAPBOX_TOKEN}
            placeholder="Tìm điểm đón hoặc điểm đến..."
            onSelect={(r) => {
              if (!pickup) setPickup(r.coord, r.name);
              else if (!destination) setDestination(r.coord, r.name);
            }}
          />
        </div>
        <Button variant="outline" type="button" onClick={() => reset()}>
          Đặt lại
        </Button>
      </div>
      <div className="text-xs text-surface-600 dark:text-surface-400">
        {pickup ? (
          <>
            <strong>Đón:</strong>{" "}
            {pickupAddress ?? `${pickup.lat.toFixed(5)}, ${pickup.lng.toFixed(5)}`}
          </>
        ) : (
          <>Bấm trên bản đồ hoặc tìm để đặt điểm đón.</>
        )}
        {destination ? (
          <>
            {" · "}
            <strong>Đến:</strong>{" "}
            {destinationAddress ??
              `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`}
          </>
        ) : null}
        {isFallback ? (
          <span className="ml-2 italic">(dùng vị trí mặc định Sài Gòn)</span>
        ) : null}
      </div>
      <div className="h-[420px] w-full overflow-hidden rounded-lg border border-surface-200 dark:border-surface-700">
        <MapView
          token={MAPBOX_TOKEN}
          initialCenter={coords ?? SAIGON_FALLBACK}
          markers={markers}
          route={route}
          onMapClick={handleMapClick}
        />
      </div>
      {pickup && destination ? (
        <div className="space-y-3">
          {validationError !== null ? (
            <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
          ) : (
            <FareEstimateCard quote={quote.data} loading={quote.isLoading} />
          )}
          <ConfirmRideButton
            totalVnd={quote.data?.totalVnd ?? null}
            disabled={validationError !== null || quote.isError}
            loading={createRide.isPending}
            onConfirm={handleConfirm}
          />
        </div>
      ) : null}
    </section>
  );
}
