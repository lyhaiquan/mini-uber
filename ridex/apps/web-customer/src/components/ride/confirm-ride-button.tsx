"use client";

import { Button, Spinner } from "@ridex/ui-web";
import * as React from "react";

import { formatVnd, roundUpVnd } from "./fare-estimate-card";

void React;

interface Props {
  totalVnd: number | null;
  disabled?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmRideButton({ totalVnd, disabled, loading, onConfirm }: Props) {
  const label =
    totalVnd === null ? "Đặt xe" : `Đặt xe — ${formatVnd(roundUpVnd(totalVnd))}`;
  return (
    <Button
      type="button"
      className="w-full"
      size="lg"
      disabled={disabled === true || loading === true || totalVnd === null}
      onClick={onConfirm}
    >
      {loading === true ? <Spinner className="h-5 w-5" /> : label}
    </Button>
  );
}
