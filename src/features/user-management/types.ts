import type { AppUser } from "@/contexts/AppContext";

export type MemberStatusTab = "active" | "pending" | "inactive";

export type SortOrder = "asc" | "desc";

export type PermissionAction = "manager" | "user" | "viewer";

export type PermissionCategory = string;

export type PermissionBucket = Record<PermissionAction, boolean>;

// Dynamic: category key → module key → action bucket
// e.g. { "TRANSACTIONAL": { "PURCHASE_ORDER": { manager: true, user: false, viewer: false } } }
export type UserOnboardingPermissions = Record<string, Record<string, PermissionBucket>>;

export type NodePermissionBuckets = {
  primary: UserOnboardingPermissions;
  secondary: UserOnboardingPermissions;
};

export type UserOnboardingFormData = {
  basic: {
    name: string;
    email: string;
    phone: string;
    designation: string;
    employeeId: string;
    reportingManager: string;
    reportingManagerName: string;
    reportingManagerEmail: string;
  };
  permissions: UserOnboardingPermissions;
  nodeSelections: Array<{
    nodeId: string;
    nodeName: string;
    nodePath: string;
    permissions: NodePermissionBuckets;
  }>;
  primaryNodeId: string | null;
};

export type ValidationErrors = Record<string, string>;

export type UserManagementFilters = {
  search: string;
  departmentFilter: string;
  roleFilter: string;
  sortOrder: SortOrder;
};

export type UserManagementCounts = {
  active: number;
  pending: number;
  inactive: number;
};

export type UserManagementPagination = {
  page: number;
  pageSize: number;
  totalPages: number;
  safePage: number;
};

export type UserTableRow = AppUser;
