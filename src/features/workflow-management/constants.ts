export type ApprovalOption = {
  id: "reporting_manager" | "node_approver" | "hierarchy_approver";
  label: string;
  global: boolean;
};

export type MockUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  manager: string;
};

export const APPROVAL_OPTIONS: ApprovalOption[] = [
  { id: "reporting_manager", label: "Reporting Manager", global: true },
  { id: "node_approver", label: "Node Approver", global: false },
  { id: "hierarchy_approver", label: "All Hierarchy Approver", global: false },
];

export const MOCK_USERS: MockUser[] = [
  { id: 1, name: "Arham Vipul", email: "arham@company.com", role: "CEO", department: "General", manager: "Board" },
  { id: 2, name: "Sarah Chen", email: "sarah.c@company.com", role: "Manager", department: "Human Resources", manager: "Arham Vipul" },
  { id: 3, name: "John Doe", email: "john.d@company.com", role: "User", department: "Sales", manager: "Sarah Chen" },
  { id: 4, name: "Super Admin", email: "admin@globaltech.com", role: "Super Admin", department: "General", manager: "System" },
];

export const ORG_DATA = {
  manager: "CEO",
  children: [
    { name: "Engineering", manager: "Emma Wilson" },
    { name: "Human Resources", manager: "Sarah Chen" },
    { name: "Sales & Marketing", manager: "John Doe" },
  ],
};
