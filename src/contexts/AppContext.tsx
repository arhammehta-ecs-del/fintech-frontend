import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getAuthStatus } from "@/lib/api";

export type CompanyStatus = "Pending" | "Approved" | "Inactive";

export interface Signatory {
  id: string;
  fullName: string;
  designation: string;
  email: string;
  phone: string;
}

export interface Company {
  id: string;
  companyName: string;
  legalName: string;
  incorporationDate: string;
  address: string;
  gstin: string;
  ieCode: string;
  status: CompanyStatus;
  signatories: Signatory[];
}

export interface GroupCompany {
  id: string;
  groupName: string;
  code: string;
  createdDate: string;
  remarks: string;
  subsidiaries: Company[];
}

export interface OrgNode {
  id: string;
  name: string;
  parentId: string | null;
  disabled?: boolean;
  children: OrgNode[];
}

export type CompanyOrgMap = Record<string, OrgNode>;

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  designation: string;
  department: string;
  phone?: string;
  companyId?: string;
  status?: "Active" | "Inactive" | "Pending";
}

interface AppContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  setIsAuthenticated: (v: boolean) => void;
  groups: GroupCompany[];
  setGroups: React.Dispatch<React.SetStateAction<GroupCompany[]>>;
  orgStructure: OrgNode;
  setOrgStructure: React.Dispatch<React.SetStateAction<OrgNode>>;
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  companyOrgs: Record<string, OrgNode>;
  setCompanyOrgs: React.Dispatch<React.SetStateAction<Record<string, OrgNode>>>;
}

const AppContext = createContext<AppContextType | null>(null);

const initialGroups: GroupCompany[] = [
  {
    id: "1",
    groupName: "Tata Group",
    code: "TATA",
    createdDate: "2024-01-15",
    remarks: "Conglomerate",
    subsidiaries: [
      {
        id: "1a",
        companyName: "Tata Steel",
        legalName: "Tata Steel Limited",
        incorporationDate: "1907-08-26",
        address: "Mumbai, India",
        gstin: "27AAACT2727Q1ZW",
        ieCode: "0388000000",
        status: "Approved",
        signatories: [
          { id: "sig1", fullName: "Ratan Tata", designation: "Chairman Emeritus", email: "ratan@tata.com", phone: "+91-9876543210" },
          { id: "sig2", fullName: "N. Chandrasekaran", designation: "Chairman", email: "chandra@tata.com", phone: "+91-9876543211" },
        ],
      },
      {
        id: "1b",
        companyName: "Tata Motors",
        legalName: "Tata Motors Limited",
        incorporationDate: "1945-09-01",
        address: "Mumbai, India",
        gstin: "27AAACT1234Q1ZW",
        ieCode: "0388000001",
        status: "Pending",
        signatories: [
          { id: "sig3", fullName: "Girish Wagh", designation: "ED", email: "girish@tatamotors.com", phone: "+91-9876543212" },
        ],
      },
      {
        id: "1c",
        companyName: "Tata Chemicals",
        legalName: "Tata Chemicals Limited",
        incorporationDate: "1939-01-23",
        address: "Mumbai, India",
        gstin: "27AAACT4058M1ZV",
        ieCode: "0388000002",
        status: "Inactive",
        signatories: [
          { id: "sig4", fullName: "R. Mukundan", designation: "Managing Director", email: "rmukundan@tatachemicals.com", phone: "+91-9876543213" },
        ],
      },
    ],
  },
  {
    id: "2",
    groupName: "Reliance Industries",
    code: "RIL",
    createdDate: "2024-03-10",
    remarks: "Energy & Retail",
    subsidiaries: [
      {
        id: "2a",
        companyName: "Jio Platforms",
        legalName: "Jio Platforms Limited",
        incorporationDate: "2019-10-15",
        address: "Navi Mumbai, India",
        gstin: "27AAACJ5678Q1ZW",
        ieCode: "0399000000",
        status: "Approved",
        signatories: [],
      },
    ],
  },
];

const initialOrg: OrgNode = {
  id: "root",
  name: "Acme Corporation",
  parentId: null,
  children: [
    { id: "d1", name: "Engineering", parentId: "root", children: [
      { id: "d1a", name: "Frontend", parentId: "d1", children: [] },
      { id: "d1b", name: "Backend", parentId: "d1", children: [] },
    ]},
    { id: "d2", name: "Human Resources", parentId: "root", children: [] },
    { id: "d3", name: "Finance", parentId: "root", children: [] },
  ],
};

const initialCompanyOrgs: Record<string, OrgNode> = {
  "1a": {
    id: "root-1a", name: "Tata Steel", parentId: null, children: [
      { id: "ts-ops", name: "Operations", parentId: "root-1a", children: [
        { id: "ts-ops-prod", name: "Production", parentId: "ts-ops", children: [] },
        { id: "ts-ops-qa", name: "Quality Assurance", parentId: "ts-ops", children: [] },
      ]},
      { id: "ts-fin", name: "Finance", parentId: "root-1a", children: [] },
      { id: "ts-hr", name: "Human Resources", parentId: "root-1a", children: [] },
    ],
  },
  "1b": {
    id: "root-1b", name: "Tata Motors", parentId: null, children: [
      { id: "tm-eng", name: "Engineering", parentId: "root-1b", children: [] },
      { id: "tm-sales", name: "Sales", parentId: "root-1b", children: [] },
    ],
  },
};

const initialUsers: AppUser[] = [
  { id: "u1", name: "Alice Johnson", email: "alice@acme.com", role: "Admin", designation: "CTO", department: "Engineering", phone: "+91 98765 43210", companyId: "1a", status: "Active" },
  { id: "u2", name: "Bob Smith", email: "bob@acme.com", role: "Manager", designation: "HR Manager", department: "Human Resources", phone: "+91 98765 43211", companyId: "1a", status: "Active" },
  { id: "u3", name: "Carol Davis", email: "carol@acme.com", role: "User", designation: "Developer", department: "Engineering", phone: "+91 98765 43212", companyId: "1a", status: "Active" },
  // Adding 10 more members to Tata Steel (1a)
  { id: "t1", name: "Ravi Shankar", email: "ravi.shankar@tatasteel.com", role: "Manager", designation: "Plant Head", department: "Operations", phone: "+91 91234 56780", companyId: "1a", status: "Active" },
  { id: "t2", name: "Meera Reddy", email: "meera.reddy@tatasteel.com", role: "User", designation: "Safety Engineer", department: "Operations", phone: "+91 91234 56781", companyId: "1a", status: "Active" },
  { id: "t3", name: "Sanjay Gupta", email: "sanjay.g@tatasteel.com", role: "User", designation: "Metallurgist", department: "Quality Assurance", phone: "+91 91234 56782", companyId: "1a", status: "Active" },
  { id: "t4", name: "Anjali Desai", email: "anjali.d@tatasteel.com", role: "Signatory", designation: "VP Finance", department: "Finance", phone: "+91 91234 56783", companyId: "1a", status: "Active" },
  { id: "t5", name: "Vikram Singh", email: "vikram.s@tatasteel.com", role: "Manager", designation: "Accounts Manager", department: "Finance", phone: "+91 91234 56784", companyId: "1a", status: "Active" },
  { id: "t6", name: "Neha Patil", email: "neha.p@tatasteel.com", role: "User", designation: "HR Generalist", department: "Human Resources", phone: "+91 91234 56785", companyId: "1a", status: "Active" },
  { id: "t7", name: "Arjun Nair", email: "arjun.n@tatasteel.com", role: "User", designation: "Quality Inspector", department: "Quality Assurance", phone: "+91 91234 56786", companyId: "1a", status: "Inactive" },
  { id: "t8", name: "Pooja Sharma", email: "pooja.s@tatasteel.com", role: "User", designation: "Site Supervisor", department: "Operations", phone: "+91 91234 56787", companyId: "1a", status: "Pending" },
  { id: "t9", name: "Imran Khan", email: "imran.k@tatasteel.com", role: "Manager", designation: "Lead Engineer", department: "Engineering", phone: "+91 91234 56788", companyId: "1a", status: "Active" },
  { id: "t10", name: "Kavita Iyer", email: "kavita.i@tatasteel.com", role: "User", designation: "Systems Analyst", department: "Engineering", phone: "+91 91234 56789", companyId: "1a", status: "Active" },
  { id: "t11", name: "Amitabh Bachchan", email: "amitabh@tatasteel.com", role: "Signatory", designation: "Director", department: "Management", phone: "+91 90000 00001", companyId: "1a", status: "Active" },
  { id: "t12", name: "Aisha Kumari", email: "aisha.k@tatasteel.com", role: "User", designation: "Data Analyst", department: "Engineering", phone: "+91 90000 00002", companyId: "1a", status: "Pending" },
  { id: "t13", name: "Rajesh Koothrappali", email: "rajesh.k@tatasteel.com", role: "Manager", designation: "Astrophysicist", department: "Research", phone: "+91 90000 00003", companyId: "1a", status: "Active" },
  { id: "t14", name: "Simran Kaur", email: "simran.k@tatasteel.com", role: "User", designation: "HR Executive", department: "Human Resources", phone: "+91 90000 00004", companyId: "1a", status: "Inactive" },
  { id: "t15", name: "Mohan Lal", email: "mohan.l@tatasteel.com", role: "User", designation: "Logistics Coordinator", department: "Operations", phone: "+91 90000 00005", companyId: "1a", status: "Active" },
  { id: "t16", name: "Vandana Shiva", email: "vandana.s@tatasteel.com", role: "Manager", designation: "Sustainability Officer", department: "Operations", phone: "+91 90000 00006", companyId: "1a", status: "Active" },
  { id: "t17", name: "Rakesh Jhunjhunwala", email: "rakesh.j@tatasteel.com", role: "Signatory", designation: "Investment Lead", department: "Finance", phone: "+91 90000 00007", companyId: "1a", status: "Pending" },
  { id: "t18", name: "Zoya Akhtar", email: "zoya.a@tatasteel.com", role: "User", designation: "Content Writer", department: "Marketing", phone: "+91 90000 00008", companyId: "1a", status: "Active" },
  { id: "t19", name: "Deepika Padukone", email: "deepika.p@tatasteel.com", role: "Manager", designation: "Brand Ambassador", department: "Marketing", phone: "+91 90000 00009", companyId: "1a", status: "Active" },
  { id: "t20", name: "Ranbir Kapoor", email: "ranbir.k@tatasteel.com", role: "User", designation: "Intern", department: "Engineering", phone: "+91 90000 00010", companyId: "1a", status: "Inactive" },

  { id: "u4", name: "Deepak Kumar", email: "deepak@tatamotors.com", role: "Admin", designation: "VP Engineering", department: "Engineering", companyId: "1b", status: "Active" },
  { id: "u5", name: "Priya Sharma", email: "priya@tatamotors.com", role: "Signatory", designation: "CFO", department: "Finance", companyId: "1b", status: "Active" },
  { id: "u6", name: "Rahul Mehta", email: "rahul@jio.com", role: "Admin", designation: "Director", department: "Operations", companyId: "2a", status: "Active" },
  { id: "u7", name: "Sneha Patel", email: "sneha@jio.com", role: "User", designation: "Analyst", department: "Finance", companyId: "2a", status: "Inactive" },
  ...Array.from({ length: 130 }).map((_, i) => ({
    id: `gen-${i}`,
    name: `Example User ${i + 1}`,
    email: `example${i + 1}@tatasteel.com`,
    role: i % 5 === 0 ? "Manager" : "User",
    designation: i % 5 === 0 ? "Lead" : "Staff",
    department: ["Engineering", "Operations", "Finance", "Human Resources", "Quality Assurance"][i % 5],
    phone: `+91 90000 ${String(i).padStart(5, '0')}`,
    companyId: "1a",
    status: i % 10 === 0 ? "Pending" as const : (i % 12 === 0 ? "Inactive" as const : "Active" as const)
  }))
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [groups, setGroups] = useState<GroupCompany[]>(initialGroups);
  const [orgStructure, setOrgStructure] = useState<OrgNode>(initialOrg);
  const [users, setUsers] = useState<AppUser[]>(initialUsers);
  const [companyOrgs, setCompanyOrgs] = useState<Record<string, OrgNode>>(initialCompanyOrgs);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        await getAuthStatus();
        if (!cancelled) {
          setIsAuthenticated(true);
        }
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setIsAuthLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppContext.Provider value={{ isAuthenticated, isAuthLoading, setIsAuthenticated, groups, setGroups, orgStructure, setOrgStructure, users, setUsers, companyOrgs, setCompanyOrgs }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
