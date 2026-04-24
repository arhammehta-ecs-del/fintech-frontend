import type { AppUser } from "@/contexts/AppContext";

export type MemberStatusTab = "active" | "pending" | "inactive";

export type SortOrder = "asc" | "desc";

export type PermissionAction = "manager" | "user" | "viewer";

export type PermissionCategory = "transactional" | "operational" | "systemAccess";

export type PermissionBucket = Record<PermissionAction, boolean>;

export type TransactionalPermissionItem = "purchaseOrder" | "payment" | "invoice";

export type NewMemberPermissions = {
  transactional: {
    purchaseOrder: PermissionBucket;
    payment: PermissionBucket;
    invoice: PermissionBucket;
  };
  operational: {
    master: PermissionBucket;
  };
  systemAccess: {
    orgStructure: PermissionBucket;
    userManagement: PermissionBucket;
    workflow: PermissionBucket;
  };
};

export type NodePermissionBuckets = {
  primary: NewMemberPermissions;
  secondary: NewMemberPermissions;
};

export type NewMemberOnboardingFormData = {
  basic: {
    name: string;
    email: string;
    phone: string;
    designation: string;
    employeeId: string;
    reportingManager: string;
  };
  permissions: NewMemberPermissions;
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
