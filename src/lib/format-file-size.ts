/** "512 bytes", "4.2 KB", "38 MB" — one decimal below 10 units. */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  const unit = bytes < 1024 * 1024 ? "KB" : "MB";
  const value = bytes / (unit === "KB" ? 1024 : 1024 * 1024);
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value)} ${unit}`;
}
