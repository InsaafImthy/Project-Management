const parseDateOnly = (value: string): Date | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day);
};

export const toValidDate = (
  value: Date | string | number,
): Date | undefined => {
  const date =
    typeof value === "string"
      ? (parseDateOnly(value) ?? new Date(value))
      : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/** Formats an ISO date-only value without allowing UTC conversion to shift its day. */
export const formatPmoDate = (
  value: Date | string | number,
  locale?: string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  },
): string => {
  const date = toValidDate(value);
  return date
    ? new Intl.DateTimeFormat(locale, options).format(date)
    : "Not set";
};
