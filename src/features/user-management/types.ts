import type { AppUser } from "@/contexts/AppContext";

export type MemberStatusTab = "active" | "pending" | "inactive";

export type SortOrder = "asc" | "desc";

export type PermissionAction = "manager" | "user" | "viewer";
export type SystemAccessScope = "NODE" | "IMMEDIATE_CHILD" | "ALL_CHILD";

export type PermissionCategory = string;

export type PermissionBucket = Record<PermissionAction, boolean>;

// Dynamic: category key → module key → action bucket
// e.g. { "TRANSACTIONAL": { "PURCHASE_ORDER": { manager: true, user: false, viewer: false } } }
export type UserOnboardingPermissions = Record<string, Record<string, PermissionBucket>>;

export type NodePermissionBuckets = {
  primary: UserOnboardingPermissions;
  secondary: UserOnboardingPermissions;
};

export type NodePermissionScopeBuckets = {
  primary: Record<string, Record<string, Partial<Record<PermissionAction, SystemAccessScope>>>>;
  secondary: Record<string, Record<string, Partial<Record<PermissionAction, SystemAccessScope>>>>;
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
  isGlobalUserEligible: boolean;
  isGlobalSignatory: boolean;
  permissions: UserOnboardingPermissions;
  nodeSelections: Array<{
    nodeId: string;
    nodeName: string;
    nodePath: string;
    immediateChildren: Array<{
      nodeName: string;
      nodePath: string;
    }>;
    allChildren: Array<{
      nodeName: string;
      nodePath: string;
    }>;
    permissions: NodePermissionBuckets;
    permissionScopes: NodePermissionScopeBuckets;
  }>;
  primaryNodeId: string | null;
  selectedWorkflow: string;
  selectedWorkflowLevelsHash: string;
};

export type ValidationErrors = Record<string, string>;

export type UserManagementFilters = {
  search: string;
  designationFilters: string[];
  departmentFilters: string[];
  accessCategoryFilters: string[];
  accessSubcategoryFilters: string[];
  accessScopeFilters: string[];
  roleTypeFilters: string[];
  onboardingDateFrom: string;
  onboardingDateTo: string;
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
