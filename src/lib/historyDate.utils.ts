export const formatDateParts = (isoLike?: string) => {
  const parsed = isoLike ? new Date(isoLike) : new Date();
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const year = safeDate.getFullYear().toString();
  const month = safeDate.toLocaleString("en-US", { month: "long" }).toUpperCase();
  const day = String(safeDate.getDate()).padStart(2, "0");
  const date = safeDate.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  const time = safeDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return { year, month, day, date, time };
};
