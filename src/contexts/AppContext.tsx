import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getAllCompanies } from "@/lib/api";

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
  companyId?: string;
  nodeType: string;
  nodePath: string;
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
}

const AppContext = createContext<AppContextType | null>(null);
const CURRENT_USER_STORAGE_KEY = "app.currentUser";

function readStoredCurrentUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => readStoredCurrentUser());
  const [groups, setGroups] = useState<GroupCompany[]>([]);
  const [orgStructure, setOrgStructure] = useState<OrgNode | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    if (isAuthLoading) return;

    try {
      if (!currentUser) {
        window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(currentUser));
    } catch {
      // Ignore storage errors so auth state still works in-memory.
    }
  }, [currentUser]);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const companyGroups = await getAllCompanies();

        if (cancelled) return;

        setIsAuthenticated(true);
        setGroups(companyGroups);
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setGroups([]);
          setOrgStructure(null);
          setUsers([]);
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
    <AppContext.Provider value={{ isAuthenticated, isAuthLoading, setIsAuthenticated, currentUser, setCurrentUser, groups, setGroups, orgStructure, setOrgStructure, users, setUsers }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
