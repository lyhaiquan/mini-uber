import { Button } from "@ridex/ui-mobile";
import * as React from "react";

import { formatVnd, roundUpVnd } from "./fare-estimate-card";

void React;

interface Props {
  totalVnd: number | null;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function ConfirmButton({ totalVnd, loading, disabled, onPress }: Props) {
  const label =
    totalVnd === null ? "Đặt xe" : `Đặt xe — ${formatVnd(roundUpVnd(totalVnd))}`;
  return (
    <Button
      loading={loading}
      onPress={onPress}
      disabled={disabled === true || totalVnd === null}
    >
      {label}
    </Button>
  );
}
