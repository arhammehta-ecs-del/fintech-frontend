import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Company, CompanyStatus, GroupCompany } from "@/contexts/AppContext";
import { getAllCompanies, updateCompanyOnboardingAction } from "@/services/company.service";
import { useToast } from "@/hooks/use-toast";
import type { DisplayRow, StatusTab, VisibleColumn } from "@/features/company-list/types";
import {
  buildAllDisplayRows,
  filterGroupsByStatusAndSearch,
  getSelectedGroupInfo,
} from "@/features/company-list/utils";

const EMPTY_STATUS_COUNTS = {
  active: 0,
  pending: 0,
  inactive: 0,
};

export function useCompanyList() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
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

  const refreshCompanies = useCallback(async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    try {
      setError(null);
      const nextGroups = await getAllCompanies();
      setGroups(nextGroups);
      setExpanded(new Set(nextGroups.map((group) => group.id)));
      setSelectedCompany((previous) => {
        if (!previous) return previous;
        for (const group of nextGroups) {
          const matching = group.subsidiaries.find((company) => company.id === previous.id);
          if (matching) return matching;
        }
        return previous;
      });
    } catch (err) {
      const statusMatch = err instanceof Error ? err.message.match(/Request failed:\s*(\d{3})/) : null;
      const statusCode = statusMatch ? Number(statusMatch[1]) : null;
      if (statusCode === 401 || statusCode === 403) {
        navigate("/login", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load companies");
      setGroups([]);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, [navigate]);

  const statusCounts = useMemo(() => {
    return groups.reduce(
      (counts, group) => {
        group.subsidiaries.forEach((company) => {
          if (company.status === "Approved") counts.active += 1;
          else if (company.status === "Pending") counts.pending += 1;
          else if (company.status === "Inactive") counts.inactive += 1;
        });
        return counts;
      },
      { ...EMPTY_STATUS_COUNTS },
    );
  }, [groups]);

  useEffect(() => {
    let ignore = false;

    async function loadCompanies() {
      if (ignore) return;
      await refreshCompanies(true);
    }

    void loadCompanies();

    return () => {
      ignore = true;
    };
  }, [refreshCompanies]);

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

  const executeCompanyAction = async (companyId: string, isActive: boolean, remark: string) => {
    const actionLabel = isActive ? "approved" : "rejected";

    await updateCompanyOnboardingAction(companyId, isActive ? "approve" : "reject", remark);
    await refreshCompanies();
    toast({
      title: `Company ${actionLabel}`,
      description: `The company request has been ${actionLabel} successfully.`,
    });
  };

  const handleToggleCompanyActive = (companyId: string, isActive: boolean, remark?: string) => {
    if (typeof remark === "string") {
      void executeCompanyAction(companyId, isActive, remark).catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to update company status";
        setError(message);
        toast({
          title: "Action failed",
          description: message,
          variant: "destructive",
        });
      });
      return;
    }

    setPendingAction({ companyId, isActive });
    setRemarkDialogOpen(true);
  };

  const processCompanyAction = async (remark: string) => {
    if (!pendingAction) return;
    const { companyId, isActive } = pendingAction;

    try {
      await executeCompanyAction(companyId, isActive, remark);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update company status";
      setError(message);
      toast({
        title: "Action failed",
        description: message,
        variant: "destructive",
      });
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
    statusCounts,
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
    refreshCompanies,
    remarkDialogOpen,
    setRemarkDialogOpen,
    pendingAction,
    processCompanyAction,
  };
}
