import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getAllCompanies, getAuthStatus } from "@/lib/api";

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
  brand?: string;
  companyCode?: string;
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

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  brand?: string;
  companyCode?: string;
  groupName?: string;
  groupCode?: string;
  role?: string;
  location?: string;
}

interface AppContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  setIsAuthenticated: (v: boolean) => void;
  currentUser: CurrentUser | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<CurrentUser | null>>;
  groups: GroupCompany[];
  setGroups: React.Dispatch<React.SetStateAction<GroupCompany[]>>;
  orgStructure: OrgNode | null;
  setOrgStructure: React.Dispatch<React.SetStateAction<OrgNode | null>>;
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  companyOrgs: Record<string, OrgNode>;
  setCompanyOrgs: React.Dispatch<React.SetStateAction<Record<string, OrgNode>>>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [groups, setGroups] = useState<GroupCompany[]>([]);
  const [orgStructure, setOrgStructure] = useState<OrgNode | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [companyOrgs, setCompanyOrgs] = useState<Record<string, OrgNode>>({});

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const auth = await getAuthStatus();
        if (!cancelled) {
          setIsAuthenticated(true);
          setCurrentUser(auth.user);
        }
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
          setCurrentUser(null);
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

  useEffect(() => {
    let cancelled = false;

    const loadCompanies = async () => {
      try {
        const companyGroups = await getAllCompanies();
        if (!cancelled) {
          setGroups(companyGroups);
        }
      } catch {
        if (!cancelled) {
          setGroups([]);
        }
      }
    };

    void loadCompanies();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppContext.Provider value={{ isAuthenticated, isAuthLoading, setIsAuthenticated, currentUser, setCurrentUser, groups, setGroups, orgStructure, setOrgStructure, users, setUsers, companyOrgs, setCompanyOrgs }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
