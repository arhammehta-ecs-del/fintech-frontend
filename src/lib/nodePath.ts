export const formatNodePathSegment = (segment: string) =>
  segment
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const splitNodePathSegments = (value: string, options?: { excludeRoot?: boolean }) => {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const rawParts = trimmed.includes(">")
    ? trimmed.split(">")
    : trimmed.split(".");

  return rawParts
    .map((part) => formatNodePathSegment(part))
    .filter((part) => Boolean(part) && (!options?.excludeRoot || part.toUpperCase() !== "ROOT"));
};

export const formatNodePathDisplay = (
  value: string,
  options?: { excludeRoot?: boolean; keepLast?: number },
) => {
  const segments = splitNodePathSegments(value, { excludeRoot: options?.excludeRoot });
  if (segments.length === 0) return "";

  const keepLast = options?.keepLast;
  if (!keepLast || keepLast < 0) {
    return segments.join(" > ");
  }

  const root = segments[0] ?? "";
  const tail = segments.slice(1);
  if (tail.length <= keepLast) {
    return [root, ...tail].filter(Boolean).join(" > ");
  }

  return [root, "...", ...tail.slice(-keepLast)].filter(Boolean).join(" > ");
};
