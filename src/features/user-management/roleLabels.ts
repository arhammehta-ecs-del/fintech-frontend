import type { PermissionAction } from "@/features/user-management/types";

export const PERMISSION_ACTIONS: PermissionAction[] = ["manager", "user", "viewer"];

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  manager: "Checker",
  user: "Maker",
  viewer: "Viewer",
};

const ACTION_ALIASES: Record<string, PermissionAction> = {
  manager: "manager",
  checker: "manager",
  user: "user",
  maker: "user",
  viewer: "viewer",
};

export const getPermissionActionLabel = (action: PermissionAction) => PERMISSION_ACTION_LABELS[action];

export const getPermissionActionFromText = (value: string): PermissionAction | null => {
  const normalized = value.trim().toLowerCase();
  return ACTION_ALIASES[normalized] ?? null;
};

export const getPermissionActionLabelFromText = (value: string) => {
  const action = getPermissionActionFromText(value);
  return action ? getPermissionActionLabel(action) : value;
};

export const getPermissionActionLabelFromRoleName = (roleName: string) => {
  const normalized = roleName.trim().toLowerCase();

  if (normalized.endsWith("manager") || normalized.endsWith("checker")) return getPermissionActionLabel("manager");
  if (normalized.endsWith("user") || normalized.endsWith("maker")) return getPermissionActionLabel("user");
  if (normalized.endsWith("viewer")) return getPermissionActionLabel("viewer");

  return roleName;
};

const ROLE_TOKEN_LABEL_ALIASES: Record<string, string> = {
  TRANSACTIONAL: "Transactional",
  OPERATIONAL: "Operational",
  SYSTEM_ACCESS: "System Access",
  ACCOUNTS: "Accounts",
  PAYMENTS: "Payments",
  PURCHASE: "Purchase",
  PURCHASE_ORDER: "Purchase Order",
  FIN_OPS: "Fin Ops",
  MASTER: "Master",
  MASTER_RECORDS: "Master Records",
  ORG_STR: "Org Structure",
  ORG_STRUCTURE: "Org Structure",
  USER_ACC: "User Access",
  USER_ACCESS: "User Access",
  USER_MANAGEMENT: "User Access",
  WORK_FLOW: "Workflow",
  WORKFLOW: "Workflow",
  WORKFLOW_CONFIG: "Workflow",
};

export const formatRoleTokenLabel = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return "";
  const aliased = ROLE_TOKEN_LABEL_ALIASES[normalized];
  if (aliased) return aliased;
  return normalized
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
};
