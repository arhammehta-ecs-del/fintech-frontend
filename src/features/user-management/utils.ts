import type { RoleRecord } from "@/services/role.service";
import type { UserOnboardingPayload, UserOnboardingPermission } from "@/services/user.service";
import type { OrgNode } from "@/contexts/AppContext";
import type {
  UserOnboardingFormData,
  UserOnboardingPermissions,
  ValidationErrors,
} from "@/features/user-management/types";

const PERMISSION_ACTIONS = ["manager", "user", "viewer"] as const;

export const buildUserOnboardingPayload = (formData: UserOnboardingFormData): UserOnboardingPayload => {
  const selectedNodeEntries =
    formData.nodeSelections.length > 0
      ? formData.nodeSelections
      : [
        {
          nodeId: "",
          nodeName: "",
          nodePath: "",
          permissions: {
            primary: createInitialPermissions([]),
            secondary: formData.permissions,
          },
        },
      ];

  const mappedPermissions: UserOnboardingPermission[] = selectedNodeEntries.flatMap((nodeEntry) =>
    (Object.entries(nodeEntry.permissions) as Array<[string, UserOnboardingPermissions]>).flatMap(
      ([bucketKey, bucketPermissions]) =>
        Object.entries(bucketPermissions).flatMap(([category, modules]) =>
          Object.entries(modules).flatMap(([subCategory, rights]) => {
            const selectedActions = PERMISSION_ACTIONS.filter((action) => rights[action]);
            const accessType = bucketKey === "primary" ? "PRIMARY" : "SECONDARY";
            if (selectedActions.length === 0) return [];

            const roleNameBase = subCategory
              .split("_")
              .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
              .join(" ");

            return selectedActions.map((action) => ({
              roleCategory: category as UserOnboardingPermission["roleCategory"],
              roleSubCategory: subCategory,
              roleName: `${roleNameBase} ${action[0].toUpperCase()}${action.slice(1)}`,
              nodeName: nodeEntry.nodeName,
              nodePath: nodeEntry.nodePath,
              accessType,
            }));
          }),
        ),
    ),
  );

  return {
    basicDetails: {
      name: formData.basic.name.trim(),
      email: formData.basic.email.trim(),
      phone: formData.basic.phone.trim(),
      designation: formData.basic.designation.trim(),
      employeeId: formData.basic.employeeId.trim(),
      reportingManager: formData.basic.reportingManager.trim(),
    },
    permissions: mappedPermissions,
  };
};

/**
 * Build an empty UserOnboardingPermissions object from the live roles.
 * Structure: { [category]: { [subCategory]: { manager: false, user: false, viewer: false } } }
 */
export const createInitialPermissions = (roles: RoleRecord[]): UserOnboardingPermissions => {
  const permissions: UserOnboardingPermissions = {};

  for (const role of roles) {
    const cat = role.category;
    const sub = role.subCategory;
    if (!permissions[cat]) permissions[cat] = {};
    if (!permissions[cat][sub]) permissions[cat][sub] = { manager: false, user: false, viewer: false };
  }

  return permissions;
};

export const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const AVATAR_PALETTES = [
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-orange-100", text: "text-orange-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
];

export const getAvatarColor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
};

export const maskContactNumber = (phone?: string) => {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return "*".repeat(digits.length - 4) + digits.slice(-4);
};

export const createInitialUserOnboardingFormData = (): UserOnboardingFormData => ({
  basic: {
    name: "avm",
    email: "arhammehta26@gmail.com",
    phone: "1234567889",
    designation: "ceo",
    employeeId: "EMP-10294",
    reportingManager: "aamm@gmail.com",
  },
  permissions: createInitialPermissions([]),
  nodeSelections: [],
  primaryNodeId: null,
});

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
  if (!value) return "-";

  const slashDate = parseSlashDate(value);
  if (slashDate) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(slashDate);
  }

  const isoDate = new Date(`${value}T00:00:00`);
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

export const validateUserOnboardingStep = (step: number, formData: UserOnboardingFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (step === 1) {
    const { name, email, phone, designation, employeeId, reportingManager } = formData.basic;

    if (!name.trim()) errors.name = "Required";
    if (!email.trim()) errors.email = "Required";
    if (!phone.trim()) errors.phone = "Required";
    else if (!/^\d{10}$/.test(phone)) errors.phone = "Enter a valid 10-digit phone number";
    if (!designation.trim()) errors.designation = "Required";
    if (!employeeId.trim()) errors.employeeId = "Required";
    if (!reportingManager.trim()) errors.reportingManager = "Required";
  }

  return errors;
};

export function findOrgNode(node: OrgNode | null, nodeId: string): OrgNode | null {
  if (!node) return null;
  if (node.id === nodeId) return node;

  for (const child of node.children) {
    const match = findOrgNode(child, nodeId);
    if (match) return match;
  }

  return null;
}

export function getOrgNodeTheme(nodeType: string) {
  const normalized = nodeType.trim().toUpperCase();

  if (normalized === "DIVISION") {
    return {
      edge: "bg-sky-400",
      card: "border-slate-200",
      hover: "hover:border-sky-200 hover:bg-sky-50/40",
      selected: "border-sky-300 bg-sky-50/60 shadow-[0_0_0_4px_rgba(96,165,250,0.08)]",
    };
  }

  if (normalized === "LOCATION") {
    return {
      edge: "bg-emerald-400",
      card: "border-slate-200",
      hover: "hover:border-emerald-200 hover:bg-emerald-50/40",
      selected: "border-emerald-300 bg-emerald-50/60 shadow-[0_0_0_4px_rgba(52,211,153,0.08)]",
    };
  }

  if (normalized === "DEPARTMENT") {
    return {
      edge: "bg-amber-400",
      card: "border-slate-200",
      hover: "hover:border-amber-200 hover:bg-amber-50/40",
      selected: "border-amber-200 bg-amber-50/60 shadow-[0_0_0_4px_rgba(251,191,36,0.08)]",
    };
  }

  if (normalized === "ROOT") {
    return {
      edge: "",
      card: "border border-slate-200",
      hover: "hover:border-slate-300 hover:bg-slate-50",
      selected: "border-slate-300 bg-slate-50 shadow-[0_8px_24px_rgba(15,23,42,0.06)]",
    };
  }

  return {
    edge: "bg-slate-300",
    card: "border-slate-200",
    hover: "hover:border-slate-300 hover:bg-slate-50",
    selected: "border-slate-300 bg-slate-50 shadow-[0_8px_24px_rgba(15,23,42,0.04)]",
  };
}

export function getOrgNodeBadgeTheme(nodeType: string) {
  const normalized = nodeType.trim().toUpperCase();

  if (normalized === "DIVISION") {
    return "border border-sky-200 bg-sky-50 text-sky-600";
  }

  if (normalized === "LOCATION") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-600";
  }

  if (normalized === "DEPARTMENT") {
    return "border border-amber-200 bg-amber-50 text-amber-600";
  }

  return "border border-slate-200 bg-slate-50 text-slate-500";
}

export function getOrgNodePermissionChipTheme(nodeType: string) {
  const normalized = nodeType.trim().toUpperCase();

  if (normalized === "DIVISION") {
    return "border border-sky-200 bg-sky-100 text-sky-700";
  }

  if (normalized === "LOCATION") {
    return "border border-emerald-200 bg-emerald-100 text-emerald-700";
  }

  if (normalized === "DEPARTMENT") {
    return "border border-amber-200 bg-amber-100 text-amber-700";
  }

  return "border border-slate-200 bg-slate-100 text-slate-600";
}
