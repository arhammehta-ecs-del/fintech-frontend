import type { UserOnboardingPayload } from "@/services/user.service";
import type { OrgNode } from "@/contexts/AppContext";
import { TRANSACTIONAL_PERMISSION_ITEMS } from "@/features/user-management/constants";
import type {
  NewMemberOnboardingFormData,
  NewMemberPermissions,
  ValidationErrors,
} from "@/features/user-management/types";

const PERMISSION_ACTIONS = ["manager", "user", "viewer"] as const;

const ROLE_CATEGORY_MAP = {
  transactional: "TRANSACTIONAL",
  operational: "OPERATIONAL",
  systemAccess: "SYSTEM_ACCESS",
} as const;

const SUBCATEGORY_ROLE_CODE_PREFIX: Record<string, string> = {
  purchaseOrder: "PURCHASE_ORDER",
  payment: "PAYMENTS",
  invoice: "INVOICE",
  master: "MASTER",
  orgStructure: "ORG_STRUCTURE",
  userManagement: "USER_MANAGEMENT",
  workflow: "TRACK_WORKFLOW",
};

export const buildUserOnboardingPayload = (formData: NewMemberOnboardingFormData): UserOnboardingPayload => {
  const selectedNodeEntries =
    formData.nodeSelections.length > 0
      ? formData.nodeSelections
      : [
          {
            nodeId: "",
            nodeName: "",
            nodePath: "",
            permissions: formData.permissions,
          },
        ];

  const selectedTransactionalSubCategories = Array.from(
    new Set(
      selectedNodeEntries.flatMap((nodeEntry) =>
        Object.entries(nodeEntry.permissions.transactional)
          .filter(([, rights]) => Object.values(rights).some(Boolean))
          .map(([subCategory]) => subCategory),
      ),
    ),
  );

  const resolvedTransactionalPrimary =
    (formData.transactionalPrimary && selectedTransactionalSubCategories.includes(formData.transactionalPrimary)
      ? formData.transactionalPrimary
      : TRANSACTIONAL_PERMISSION_ITEMS.find((subCategory) => selectedTransactionalSubCategories.includes(subCategory))) ?? null;

  const mappedPermissions = selectedNodeEntries.flatMap((nodeEntry) =>
    Object.entries(nodeEntry.permissions).flatMap(([category, items]) =>
      Object.entries(items).flatMap(([subCategory, rights]) => {
        const selectedActions = PERMISSION_ACTIONS.filter((action) => rights[action]);
        if (selectedActions.length === 0) return [];

        const isTransactional = category === "transactional";
        const accessType: "primary" | "secondary" | undefined = isTransactional
          ? resolvedTransactionalPrimary === subCategory
            ? "primary"
            : "secondary"
          : undefined;

        const roleCodeBase =
          SUBCATEGORY_ROLE_CODE_PREFIX[subCategory] ??
          subCategory
            .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
            .replace(/\s+/g, "_")
            .toUpperCase();

        return selectedActions.map((action) => ({
          roleCategory: ROLE_CATEGORY_MAP[category as keyof typeof ROLE_CATEGORY_MAP],
          role_code: `${roleCodeBase}_${action.toUpperCase()}`,
          nodeName: nodeEntry.nodeName,
          nodePath: nodeEntry.nodePath,
          ...(isTransactional ? { accessType } : {}),
        }));
      }),
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

export const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const maskContactNumber = (phone?: string) => {
  if (!phone) return "-";

  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return digits;

  return "*".repeat(digits.length - 4) + digits.slice(-4);
};

export const createInitialPermissions = (): NewMemberPermissions => ({
  transactional: {
    purchaseOrder: { manager: false, user: false, viewer: false },
    payment: { manager: false, user: false, viewer: false },
    invoice: { manager: false, user: false, viewer: false },
  },
  operational: {
    master: { manager: false, user: false, viewer: false },
  },
  systemAccess: {
    orgStructure: { manager: false, user: false, viewer: false },
    userManagement: { manager: false, user: false, viewer: false },
    workflow: { manager: false, user: false, viewer: false },
  },
});

export const createInitialFormData = (): NewMemberOnboardingFormData => ({
  basic: {
    name: "",
    email: "",
    phone: "",
    designation: "",
    employeeId: "",
    reportingManager: "",
  },
  permissions: createInitialPermissions(),
  nodeSelections: [],
  transactionalPrimary: null,
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

export const validateNewMemberStep = (step: number, formData: NewMemberOnboardingFormData): ValidationErrors => {
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
