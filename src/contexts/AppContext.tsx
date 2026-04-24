import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getCurrentUser } from "@/services/auth.service";

export type CompanyStatus = "Pending" | "Approved" | "Inactive";

export interface Signatory {
  
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

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  designation: string;
  department: string;
  phone?: string;
  companyId?: string;
  onboardingDate?: string;
  employeeId?: string;
  manager?: {
    name: string;
    email: string;
  };
  status?: "Active" | "Inactive" | "Pending";
  basicDetails?: {
    name: string;
    email: string;
    phone: string;
    companyOnboardingDate: string;
    designation: string;
    employeeId: string;
    reportingManager: string;
  };
  accessDetails?: Array<{
    roleCategory: "TRANSACTIONAL" | "OPERATIONAL" | "SYSTEM_ACCESS";
    roleSubCategory: string;
    roleName: string;
    nodeName: string;
    nodePath: string;
    accessType?: "PRIMARY" | "SECONDARY";
  }>;
}

export interface CurrentUserCompany {
  companyName: string;
  brandName: string;
  companyCode: string;
}

export interface CurrentUserGroup {
  groupName: string;
  groupCode: string;
  companies: CurrentUserCompany[];
}

export interface CurrentUser {
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
  groups: CurrentUserGroup[];
}

interface AppContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  setIsAuthenticated: (v: boolean) => void;
  currentUser: CurrentUser | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<CurrentUser | null>>;
  orgStructure: OrgNode | null;
  setOrgStructure: React.Dispatch<React.SetStateAction<OrgNode | null>>;
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [orgStructure, setOrgStructure] = useState<OrgNode | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    let isActive = true;

    const validateSession = async () => {
      try {
        const response = await getCurrentUser();
        if (!isActive) return;
        setCurrentUser(response.user);
        setIsAuthenticated(true);
      } catch (error) {
        if (!isActive) return;
        const statusMatch = error instanceof Error ? error.message.match(/Request failed:\s*(\d{3})/) : null;
        const statusCode = statusMatch ? Number(statusMatch[1]) : null;

        if (statusCode === 404 || statusCode === 405) {
          // Auth bootstrap endpoint is unavailable in this backend.
          // Fall back to page-wise API auth checks instead of forcing logout.
          setCurrentUser(null);
          setIsAuthenticated(true);
          return;
        }

        setCurrentUser(null);
        setIsAuthenticated(false);
        setOrgStructure(null);
        setUsers([]);
      } finally {
        if (isActive) {
          setIsAuthLoading(false);
        }
      }
    };

    void validateSession();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <AppContext.Provider value={{ isAuthenticated, isAuthLoading, setIsAuthenticated, currentUser, setCurrentUser, orgStructure, setOrgStructure, users, setUsers }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
