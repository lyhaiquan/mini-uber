"use client";

import type { OfferReceivedPayload } from "@ridex/socket-client";
import { Button } from "@ridex/ui-web";
import * as React from "react";

void React;

const vnd = new Intl.NumberFormat("vi-VN");

export interface OfferModalProps {
  offer: OfferReceivedPayload | null;
  pending: boolean;
  // Estimated payout = total × driverShareBps / 10_000. Computed in the page
  // from snapshot data, kept out of this component so the modal stays presentational.
  estimatedPayoutVnd: number | null;
  onAccept: () => void;
  onReject: () => void;
  // Called when the per-second countdown hits zero so the page can
  // implicitly reject (the backend will time out the offer anyway, but a
  // proactive reject frees the next driver in the queue sooner).
  onTimeout: () => void;
}

export function OfferModal({
  offer,
  pending,
  estimatedPayoutVnd,
  onAccept,
  onReject,
  onTimeout
}: OfferModalProps) {
  // Hooks must always run in the same order; place useState/useEffect ABOVE
  // the early return so React's hook contract holds when the modal opens
  // and closes between renders.
  const [secondsLeft, setSecondsLeft] = React.useState<number>(0);

  React.useEffect(() => {
    if (offer === null) {
      setSecondsLeft(0);
      return;
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
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [offer, onTimeout]);

  if (offer === null) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-surface-900">
        <div className="flex items-center justify-between">
          <h2 id="offer-modal-title" className="text-xl font-semibold">
            Chuyến mới
          </h2>
          <div
            aria-label="offer-countdown"
            data-seconds={secondsLeft}
            className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white ${
              secondsLeft <= 5 ? "bg-red-600" : "bg-emerald-600"
            }`}
          >
            {secondsLeft}
          </div>
        </div>

        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-surface-600 dark:text-surface-300">Cách đón</dt>
            <dd>{(offer.distanceMeters / 1000).toFixed(2)} km</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-surface-600 dark:text-surface-300">Thời gian đến đón</dt>
            <dd>{Math.round(offer.durationSeconds / 60)} phút</dd>
          </div>
          {estimatedPayoutVnd !== null ? (
            <div className="flex justify-between">
              <dt className="text-surface-600 dark:text-surface-300">Ước tính thu nhập</dt>
              <dd className="font-semibold">{vnd.format(estimatedPayoutVnd)} ₫</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" type="button" onClick={onReject} disabled={pending}>
            Từ chối
          </Button>
          <Button type="button" onClick={onAccept} disabled={pending}>
            {pending ? "..." : "Nhận chuyến"}
          </Button>
        </div>
      </div>
    </div>
  );
}
