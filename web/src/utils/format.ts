export function formatDate(
  value: string | undefined,
  timezone?: string,
  options: { includeYear?: boolean; fallback?: string } = {},
): string {
  if (!value) return options.fallback ?? "—";
  return new Intl.DateTimeFormat(undefined, {
    ...(timezone ? { timeZone: timezone } : {}),
    month: "short",
    day: "numeric",
    ...(options.includeYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDuration(
  run: { startedAt?: string; completedAt?: string } | undefined,
): string {
  if (!run?.startedAt || !run?.completedAt) return "—";
  const seconds = Math.max(
    0,
    Math.round(
      (new Date(run.completedAt).getTime() -
        new Date(run.startedAt).getTime()) / 1000,
    ),
  );
  return seconds >= 60
    ? `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`
    : `${seconds}s`;
}

export function formatFieldLabel(field: string): string {
  switch (field) {
    case "price_display":
    case "priceDisplay":
      return "Price";
    case "grade":
      return "Grade";
    case "description":
      return "Description";
    case "damage_code":
    case "damageCode":
      return "Damage Code";
    case "stock_number":
    case "stockNumber":
      return "Stock #";
    case "recycler_name":
    case "recyclerName":
      return "Recycler";
    case "recycler_location":
    case "recyclerLocation":
      return "Location";
    case "recycler_phone":
    case "recyclerPhone":
      return "Phone";
    case "image_url":
    case "imageUrl":
      return "Thumbnail";
    case "photo_url":
    case "photoUrl":
      return "Photos Link";
    case "quote_url":
    case "quoteUrl":
      return "Quote Link";
    default:
      return field;
  }
}
