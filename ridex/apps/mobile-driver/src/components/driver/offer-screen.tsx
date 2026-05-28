import type { OfferReceivedPayload } from "@ridex/socket-client";
import { Button, Text } from "@ridex/ui-mobile";
import * as React from "react";
import { Modal, StyleSheet, Vibration, View } from "react-native";

void React;

const vnd = new Intl.NumberFormat("vi-VN");

export interface OfferScreenProps {
  offer: OfferReceivedPayload | null;
  pending: boolean;
  estimatedPayoutVnd: number | null;
  onAccept: () => void;
  onReject: () => void;
  onTimeout: () => void;
}

// Full-screen offer overlay. Vibrates once on appear (200ms single pulse per
// spec) so the driver feels the offer even with the phone in a mount.
export function OfferScreen({
  offer,
  pending,
  estimatedPayoutVnd,
  onAccept,
  onReject,
  onTimeout
}: OfferScreenProps) {
  const [secondsLeft, setSecondsLeft] = React.useState<number>(0);
  const vibratedFor = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (offer === null) {
      vibratedFor.current = null;
      setSecondsLeft(0);
      return;
    }

    if (vibratedFor.current !== offer.offerId) {
      vibratedFor.current = offer.offerId;
      try {
        Vibration.vibrate(200);
      } catch {
        // Vibration unavailable (e.g. iOS simulator).
      }
    }

    const expiresAtMs = new Date(offer.expiresAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        onTimeout();
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [offer, onTimeout]);

  return (
    <Modal
      visible={offer !== null}
      animationType="slide"
      transparent={false}
      onRequestClose={onReject}
    >
      <View style={styles.container} accessibilityLabel="driver-offer-screen">
        {offer === null ? null : (
          <>
            <View style={styles.countdownWrap}>
              <View
                style={[
                  styles.countdown,
                  { backgroundColor: secondsLeft <= 5 ? "#dc2626" : "#059669" }
                ]}
                accessibilityLabel={`offer-countdown-${secondsLeft}`}
              >
                <Text variant="h2" style={styles.countdownLabel}>
                  {secondsLeft}
                </Text>
              </View>
              <Text variant="caption">giây</Text>
            </View>

            <Text variant="h2">Chuyến mới</Text>

            <View style={styles.metaRow}>
              <Text variant="body">Cách đón</Text>
              <Text variant="body">{(offer.distanceMeters / 1000).toFixed(2)} km</Text>
            </View>
            <View style={styles.metaRow}>
              <Text variant="body">Thời gian đến đón</Text>
              <Text variant="body">{Math.round(offer.durationSeconds / 60)} phút</Text>
            </View>
            {estimatedPayoutVnd !== null ? (
              <View style={styles.metaRow}>
                <Text variant="body">Ước tính thu nhập</Text>
                <Text variant="h2">{vnd.format(estimatedPayoutVnd)} ₫</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Button
                accessibilityLabel="driver-offer-reject"
                variant="outline"
                onPress={onReject}
                disabled={pending}
              >
                Từ chối
              </Button>
              <Button accessibilityLabel="driver-offer-accept" onPress={onAccept} disabled={pending}>
                {pending ? "..." : "Nhận chuyến"}
              </Button>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#ffffff",
    gap: 16,
    justifyContent: "center"
  },
  countdownWrap: { alignItems: "center", gap: 4 },
  countdown: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center"
  },
  countdownLabel: { color: "#ffffff" },
  metaRow: { flexDirection: "row", justifyContent: "space-between" },
  actions: { flexDirection: "row", gap: 12, marginTop: 24 }
});
