// Number / currency formatters for the admin dashboard. Locale-pinned to
// vi-VN so the UI matches the rest of the apps and so test snapshots are
// deterministic across CI hosts whose default locale may differ.

const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

const plainFormatter = new Intl.NumberFormat("vi-VN");

export function formatVnd(value: number): string {
  return vndFormatter.format(value);
}

// Compact VND formatter for the payments card where 4M ₫ is more readable
// than 4,000,000 ₫. Falls back to the full format below 1k so we don't
// turn "850 ₫" into "0.9K ₫".
export function formatCompactVnd(value: number): string {
  if (value >= 1_000_000) {
    // 1 decimal of precision so we can show 4.3M without the noise of
    // 4,250,000. Whole millions display as "4M ₫", not "4.0M ₫".
    const millions = value / 1_000_000;
    const text = Number.isInteger(millions) ? `${millions}` : millions.toFixed(1);
    return `${text}M ₫`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K ₫`;
  }
  return formatVnd(value);
}

export function formatNumber(value: number): string {
  return plainFormatter.format(value);
}

// Relative-time pill ("5s trước", "2 phút trước"). We keep this in seconds
// up to 60s and minutes after — finer than minutes is overkill for a 30s
// refetch cadence; coarser hides the "just refreshed" signal.
export function formatRelativeFromNow(timestampMs: number, nowMs: number): string {
  const deltaMs = Math.max(0, nowMs - timestampMs);
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 5) return "vừa cập nhật";
  if (seconds < 60) return `${seconds}s trước`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  return `${hours} giờ trước`;
}
