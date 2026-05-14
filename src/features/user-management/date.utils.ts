export const parseSlashDate = (value: string): Date | null => {
  const parts = value.split("/");
  if (parts.length !== 3) return null;

  const [dayText, monthText, yearText] = parts;
  if (dayText.length !== 2 || monthText.length !== 2 || yearText.length !== 4) return null;

  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;

  const date = new Date(year, month - 1, day);
  const isValid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return isValid ? date : null;
};

export const formatDateLabel = (value: string) => {
  const normalizedValue = value.trim();
  if (!normalizedValue) return "-";

  const slashDate = parseSlashDate(normalizedValue);
  if (slashDate) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(slashDate);
  }

  const dashMatch = normalizedValue.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashMatch) {
    const [, dayText, monthText, yearText] = dashMatch;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    const date = new Date(year, month - 1, day);
    const isValid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

    if (isValid) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
    }
  }

  const isoDate = new Date(`${normalizedValue}T00:00:00`);
  if (Number.isNaN(isoDate.getTime())) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(isoDate);
};

export const formatDateWithSlashes = (input: string): string => {
  const cleaned = input.replace(/\D/g, "");
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
};

export const slashToIsoDate = (value: string): string => {
  const parsed = parseSlashDate(value);
  if (!parsed) return "";

  const year = String(parsed.getFullYear());
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isoToSlashDate = (value: string): string => {
  const parts = value.split("-");
  if (parts.length !== 3) return "";

  const [year, month, day] = parts;
  if (year.length !== 4 || month.length !== 2 || day.length !== 2) return "";

  const parsed = parseSlashDate(`${day}/${month}/${year}`);
  return parsed ? `${day}/${month}/${year}` : "";
};

export const isDateInFuture = (dateString: string): boolean => {
  const date = parseSlashDate(dateString);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
};
