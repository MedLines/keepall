import { useFormatLocale } from "@/i18n/use-translations";

/** "5 minutes ago", "yesterday": a time relative to now, in the interface locale. */
export function useAgo() {
  const locale = useFormatLocale();
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return (time: number, now: number) => {
    const minutes = Math.round((time - now) / 60_000);
    if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return relative.format(hours, "hour");
    return relative.format(Math.round(hours / 24), "day");
  };
}
