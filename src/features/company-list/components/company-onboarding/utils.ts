import type { SignatoryForm } from "./types";

export const companyOnboardingSteps = ["Group Company", "Company Details", "New Signatory", "Preview & Submit"];

export const emptySignatoryForm = {
  fullName: "",
  designation: "",
  email: "",
  phone: "",
  employeeId: "",
} satisfies Omit<SignatoryForm, "id" | "source">;

export const formatDisplayDate = (value: string) => {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

export const getTodayDateInputValue = () => new Date().toISOString().slice(0, 10);
