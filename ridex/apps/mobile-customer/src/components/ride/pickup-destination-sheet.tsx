import { LocationSearch, type LatLng } from "@ridex/ui-mobile";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import * as React from "react";
import { StyleSheet, Text, View } from "react-native";

import { usePickupDestinationStore } from "../../store/pickup-destination-store";

interface Props {
  mapboxToken: string;
  onComplete: () => void;
}

export const PickupDestinationSheet = React.forwardRef<BottomSheet, Props>(
  ({ mapboxToken, onComplete }, ref) => {
    const snapPoints = React.useMemo(() => ["25%", "80%"], []);
    const { pickup, setPickup, setDestination } = usePickupDestinationStore();
    const [stage, setStage] = React.useState<"pickup" | "destination">(
      pickup === null ? "pickup" : "destination"
    );

    const handleSelect = React.useCallback(
      (r: { coord: LatLng; name: string }) => {
        if (stage === "pickup") {
          setPickup(r.coord, r.name);
          setStage("destination");
        } else {
          setDestination(r.coord, r.name);
          onComplete();
        }
      },
      [stage, setPickup, setDestination, onComplete]
    );

    return (
      <BottomSheet ref={ref} index={-1} snapPoints={snapPoints} enablePanDownToClose>
        <BottomSheetView style={styles.content}>
          <Text style={styles.label}>
            {stage === "pickup" ? "Điểm đón" : "Điểm đến"}
          </Text>
          <LocationSearch
            token={mapboxToken}
            placeholder={stage === "pickup" ? "Bạn đang ở đâu?" : "Đi đâu?"}
            onSelect={handleSelect}
          />
          {pickup !== null && stage === "destination" ? (
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                Đón: {pickup.lat.toFixed(5)}, {pickup.lng.toFixed(5)}
              </Text>
            </View>
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    );
  }
);
PickupDestinationSheet.displayName = "PickupDestinationSheet";

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  summary: { backgroundColor: "#f1f5f9", padding: 8, borderRadius: 8 },
  summaryText: { fontSize: 12, color: "#475569" }
});
