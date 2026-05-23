"use client";

import { Button } from "@ridex/ui-web";
import * as React from "react";

export interface CancelConfirmDialogProps {
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Cancel is a destructive action and the underlying ride state machine only
// allows it for REQUESTED / MATCHING / ACCEPTED. The parent decides when to
// render the trigger; this dialog only confirms intent.
export function CancelConfirmDialog({
  open,
  pending,
  onConfirm,
  onCancel
}: CancelConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-ride-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg dark:bg-surface-900">
        <h2 id="cancel-ride-title" className="text-lg font-semibold">
          Hủy chuyến?
        </h2>
        <p className="mt-2 text-sm text-surface-600 dark:text-surface-300">
          Bạn có chắc muốn hủy chuyến đi này?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={pending} type="button">
            Không
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={pending}
            type="button"
          >
            {pending ? "Đang hủy..." : "Hủy chuyến"}
          </Button>
        </div>
      </div>
    </div>
  );
}
