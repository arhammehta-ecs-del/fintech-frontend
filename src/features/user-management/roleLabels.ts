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
