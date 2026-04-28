import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Company, CompanyStatus, GroupCompany } from "@/contexts/AppContext";
import { getAllCompanies, updateCompanyOnboardingAction } from "@/services/company.service";
import type { DisplayRow, StatusTab, VisibleColumn } from "@/features/company-list/types";
import {
  buildAllDisplayRows,
  filterGroupsByStatusAndSearch,
  getSelectedGroupInfo,
} from "@/features/company-list/utils";

export function useCompanyList() {
  const location = useLocation();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupCompany[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedStatusTab, setSelectedStatusTab] = useState<StatusTab>(() => {
    const routeStatus = location.state?.statusFilter as CompanyStatus | undefined;
    if (routeStatus === "Approved") return "active";
    if (routeStatus === "Pending") return "pending";
    if (routeStatus === "Inactive") return "inactive";
    return "active";
  });
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<VisibleColumn>>(
    new Set(["groupName", "companyName", "code", "createdDate", "manage", "status"]),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ companyId: string; isActive: boolean } | null>(null);
  const statusFilter: CompanyStatus =
    selectedStatusTab === "inactive" ? "Inactive" : selectedStatusTab === "pending" ? "Pending" : "Approved";

  useEffect(() => {
    let ignore = false;

    async function loadCompanies() {
      try {
        setIsLoading(true);
        setError(null);
        const nextGroups = await getAllCompanies();
        if (!ignore) {
          setGroups(nextGroups);
          setExpanded(new Set(nextGroups.map((group) => group.id)));
        }
      } catch (err) {
        if (!ignore) {
          const statusMatch = err instanceof Error ? err.message.match(/Request failed:\s*(\d{3})/) : null;
          const statusCode = statusMatch ? Number(statusMatch[1]) : null;
          if (statusCode === 401 || statusCode === 403) {
            navigate("/login", { replace: true });
            return;
          }
          setError(err instanceof Error ? err.message : "Failed to load companies");
          setGroups([]);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadCompanies();

    return () => {
      ignore = true;
    };
  }, [navigate]);

  const selectedGroupInfo = useMemo(() => getSelectedGroupInfo(groups, selectedCompany), [groups, selectedCompany]);

  const filteredGroups = useMemo(() => {
    return filterGroupsByStatusAndSearch(groups, statusFilter, appliedSearch);
  }, [appliedSearch, groups, statusFilter]);

  const displayRows = useMemo<DisplayRow[]>(() => buildAllDisplayRows(filteredGroups), [filteredGroups]);

  const handleSearchSubmit = () => {
    setAppliedSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setAppliedSearch("");
  };

  const toggleGroup = (id: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openModal = (company: Company) => {
    setSelectedCompany(company);
    setIsPreviewOpen(true);
  };

  const updateSpecificCompany = (companyId: string, updater: (company: Company) => Company) => {
    setGroups((previousGroups) =>
      previousGroups.map((group) => ({
        ...group,
        subsidiaries: group.subsidiaries.map((company) =>
          company.id === companyId ? updater(company) : company,
        ),
      })),
    );
  };

  const handleSaveCompany = (updatedCompany: Company) => {
    updateSpecificCompany(updatedCompany.id, () => updatedCompany);
    setSelectedCompany(updatedCompany);
  };

  const handleToggleCompanyActive = (companyId: string, isActive: boolean) => {
    setPendingAction({ companyId, isActive });
    setRemarkDialogOpen(true);
  };

  const processCompanyAction = async (remark: string) => {
    if (!pendingAction) return;
    const { companyId, isActive } = pendingAction;
    const nextStatus: CompanyStatus = isActive ? "Approved" : "Inactive";

    try {
      await updateCompanyOnboardingAction(companyId, isActive ? "approve" : "reject", remark);
      updateSpecificCompany(companyId, (company) => ({
        ...company,
        status: nextStatus,
      }));
      setSelectedCompany((previous) =>
        previous && previous.id === companyId ? { ...previous, status: nextStatus } : previous,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update company status");
    } finally {
      setPendingAction(null);
    }
  };

  const toggleColumn = (column: VisibleColumn, checked: boolean) => {
    setVisibleColumns((previous) => {
      const next = new Set(previous);
      if (checked) next.add(column);
      else next.delete(column);
      return next;
    });
  };

  return {
    groups,
    setGroups,
    expanded,
    searchInput,
    setSearchInput,
    statusFilter,
    selectedCompany,
    isPreviewOpen,
    setIsPreviewOpen,
    isOnboardingOpen,
    setIsOnboardingOpen,
    visibleColumns,
    isLoading,
    error,
    selectedStatusTab,
    setSelectedStatusTab,
    showStatusColumn: true,
    selectedGroupName: selectedGroupInfo.name,
    selectedGroupCode: selectedGroupInfo.code,
    displayRows,
    handleSearchSubmit,
    handleClearSearch,
    toggleGroup,
    openModal,
    handleSaveCompany,
    handleToggleCompanyActive,
    toggleColumn,
    remarkDialogOpen,
    setRemarkDialogOpen,
    pendingAction,
    processCompanyAction,
  };
}
