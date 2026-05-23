"use client";

import { Card, CardContent } from "@ridex/ui-web";
import * as React from "react";

void React;

// Placeholder until Task 022 provides real per-day earnings. Kept here so the
// home layout doesn't need to change again when the real numbers land.
export function EarningsStrip() {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-3 text-sm">
        <span className="text-surface-600 dark:text-surface-300">Hôm nay</span>
        <span className="font-semibold">0 ₫ · 0 chuyến</span>
      </CardContent>
    </Card>
  );
}
