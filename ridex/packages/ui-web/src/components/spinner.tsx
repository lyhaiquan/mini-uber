import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/cn";

export type SpinnerProps = React.SVGAttributes<SVGElement>;

export function Spinner({ className, ...props }: SpinnerProps) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden="true" {...props} />;
}
