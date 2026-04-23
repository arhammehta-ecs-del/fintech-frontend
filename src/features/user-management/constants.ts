export const USER_DEFAULT_PAGE_SIZE = 15;
export const USER_PAGE_SIZE_OPTIONS = [15, 25, 35, 50] as const;
export const USER_SEARCH_DEBOUNCE_MS = 300;

export const NEW_MEMBER_STEPS = ["Basic Details", "Select Node", "Access Rights", "Review and Submit"] as const;

export const NEW_MEMBER_PERMISSION_STRUCTURE = {
  transactional: {
    label: "Transactional",
    items: [
      { key: "purchaseOrder", label: "Purchase Order" },
      { key: "payment", label: "Payment" },
      { key: "invoice", label: "Invoice" },
    ],
  },
  operational: {
    label: "Operational",
    items: [{ key: "master", label: "Master Records" }],
  },
  systemAccess: {
    label: "System Access",
    items: [
      { key: "orgStructure", label: "Org Structure" },
      { key: "userManagement", label: "User Management" },
      { key: "workflow", label: "Workflow Config" },
    ],
  },
} as const;

export const TRANSACTIONAL_PERMISSION_ITEMS = ["payment", "purchaseOrder", "invoice"] as const;
