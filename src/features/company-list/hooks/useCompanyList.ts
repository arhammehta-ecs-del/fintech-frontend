import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { Company, CompanyStatus, GroupCompany } from "@/contexts/AppContext";
import { fetchCompaniesPaginated, updateCompanyOnboardingAction, fetchCompanyDetails } from "@/services/company.service";
import { getApiErrorMessage } from "@/services/client";
import { useToast } from "@/hooks/use-toast";
import { connectNotificationStream } from "@/services/notification.service";
import type { DisplayRow, StatusTab, VisibleColumn } from "@/features/company-list/types";
import {
  buildAllDisplayRows,
  getSelectedGroupInfo,
} from "@/features/company-list/utils";

const EMPTY_STATUS_COUNTS = {
  active: 0,
  pending: 0,
  inactive: 0,
};
const COMPANY_PAGE_SIZE_OPTIONS = [15, 25, 35, 50] as const;
const COMPANY_SEARCH_DEBOUNCE_MS = 500;

const fuzzyMatch = (text: string, query: string) => {
  const source = text.trim().toLowerCase().replace(/\s+/g, "");
  const target = query.trim().toLowerCase().replace(/\s+/g, "");
  if (!target) return true;
  if (source.includes(target)) return true;
  let index = 0;
  for (const ch of source) {
    if (ch === target[index]) index += 1;
    if (index === target.length) return true;
  }
  return false;
};

export function useCompanyList() {
  const location = useLocation();
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupCompany[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearchInput, setDebouncedSearchInput] = useState("");
  const [groupNameFilters, setGroupNameFilters] = useState<string[]>([]);
  const [companyNameFilters, setCompanyNameFilters] = useState<string[]>([]);
  const [legalNameFilters, setLegalNameFilters] = useState<string[]>([]);
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof COMPANY_PAGE_SIZE_OPTIONS)[number]>(15);
  const [resolvedTotalPages, setResolvedTotalPages] = useState(1);
  const [topCursor, setTopCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [pageCursors, setPageCursors] = useState<Record<number, string | null>>({ 1: null });
  const [statusCounts, setStatusCounts] = useState({ ...EMPTY_STATUS_COUNTS });
  const [visibleColumns, setVisibleColumns] = useState<Set<VisibleColumn>>(
    new Set(["groupName", "companyName", "code", "createdDate", "manage", "status"]),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ companyId: string; isActive: boolean } | null>(null);
  const [hasNewCompanyListEvent, setHasNewCompanyListEvent] = useState(false);
  const statusFilter: CompanyStatus =
    selectedStatusTab === "inactive" ? "Inactive" : selectedStatusTab === "pending" ? "Pending" : "Approved";

  useEffect(() => {
    const trimmedSearch = searchInput.trim();
    if (!trimmedSearch) {
      setDebouncedSearchInput("");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchInput(trimmedSearch);
    }, COMPANY_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const fetchPage = useCallback(
    async (
      params: {
        cursor: string | null;
        topCursor: string | null;
        page: number | null;
        direction: "NEXT" | "PREV";
        targetPage: number;
      },
      showLoader = false,
    ) => {
      if (showLoader) setIsLoading(true);
      try {
        setError(null);
        const response = await fetchCompaniesPaginated({
          type: selectedStatusTab === "pending" ? "pending" : "active",
          limit: pageSize,
          cursor: params.cursor,
          topCursor: params.topCursor,
          page: params.page,
          direction: params.direction,
          query: debouncedSearchInput || null,
        });

        setGroups(response.groups);
        setExpanded(new Set(response.groups.map((group) => group.id)));
        setSelectedCompany((previous) => {
          if (!previous) return previous;
          for (const group of response.groups) {
            const matching = group.subsidiaries.find((company) => company.id === previous.id);
            if (matching) return matching;
          }
          return previous;
        });
        setStatusCounts(response.counts);
        setPage(params.targetPage);
        setTopCursor(response.pageInfo.topCursor || params.topCursor || null);
        setNextCursor(response.pageInfo.nextCursor);
        setHasNext(response.pageInfo.hasNext);
        setPageCursors((current) => ({
          ...current,
          [params.targetPage]: params.cursor,
          [params.targetPage + 1]: response.pageInfo.nextCursor,
        }));

        const scopedCount =
          selectedStatusTab === "pending"
            ? response.counts.pending
            : selectedStatusTab === "inactive"
              ? response.counts.inactive
              : response.counts.active;
        const fallbackTotalPages = Math.max(1, Math.ceil(scopedCount / pageSize));
        setResolvedTotalPages(Math.max(response.pageInfo.totalPages || 0, fallbackTotalPages));
      } catch (err) {
        const statusMatch = err instanceof Error ? err.message.match(/Request failed:\s*(\d{3})/) : null;
        const statusCode = statusMatch ? Number(statusMatch[1]) : null;
        if (statusCode === 401 || statusCode === 403) {
          setError(null);
          setGroups([]);
          setStatusCounts({ ...EMPTY_STATUS_COUNTS });
          setPage(1);
          setResolvedTotalPages(1);
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load companies");
        setGroups([]);
        setStatusCounts({ ...EMPTY_STATUS_COUNTS });
      } finally {
        if (showLoader) setIsLoading(false);
      }
    },
    [debouncedSearchInput, pageSize, selectedStatusTab],
  );

  const refreshCompanies = useCallback(
    async (showLoader = false) => {
      setPageCursors({ 1: null });
      setTopCursor(null);
      setNextCursor(null);
      setHasNext(false);
      await fetchPage(
        {
          cursor: null,
          topCursor: null,
          page: null,
          direction: "NEXT",
          targetPage: 1,
        },
        showLoader,
      );
    },
    [fetchPage],
  );

  useEffect(() => {
    void refreshCompanies(true);
  }, [refreshCompanies]);

  useEffect(() => {
    if (selectedStatusTab === "pending" && statusCounts.pending === 0) {
      setSelectedStatusTab("active");
    }
  }, [selectedStatusTab, statusCounts.pending]);

  useEffect(() => {
    const disconnect = connectNotificationStream({
      onNotification: (packet) => {
        const refType = String(packet.refType ?? "").trim().toLowerCase();
        if (refType === "company" ) {
          setHasNewCompanyListEvent(true);
        }
      },
    });

    return disconnect;
  }, []);

  const selectedGroupInfo = useMemo(() => getSelectedGroupInfo(groups, selectedCompany), [groups, selectedCompany]);

  const statusScopedGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          subsidiaries: group.subsidiaries.filter((company) => company.status === statusFilter),
        }))
        .filter((group) => group.subsidiaries.length > 0),
    [groups, statusFilter],
  );

  const groupNameOptions = useMemo(
    () => Array.from(new Set(statusScopedGroups.map((group) => group.groupName).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [statusScopedGroups],
  );
  const companyNameOptions = useMemo(
    () =>
      Array.from(
        new Set(statusScopedGroups.flatMap((group) => group.subsidiaries.map((company) => company.companyName)).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [statusScopedGroups],
  );
  const legalNameOptions = useMemo(
    () =>
      Array.from(
        new Set(statusScopedGroups.flatMap((group) => group.subsidiaries.map((company) => company.legalName)).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [statusScopedGroups],
  );
  const filteredGroups = useMemo(() => {
    return statusScopedGroups
      .map((group) => {
        const groupNameMatch = groupNameFilters.length === 0 || groupNameFilters.includes(group.groupName);

        const subsidiaries = group.subsidiaries.filter((company) => {
          const matchesCompanyName = companyNameFilters.length === 0 || companyNameFilters.includes(company.companyName);
          const matchesLegalName = legalNameFilters.length === 0 || legalNameFilters.includes(company.legalName);
          return groupNameMatch && matchesCompanyName && matchesLegalName;
        });

        return { ...group, subsidiaries };
      })
      .filter((group) => group.subsidiaries.length > 0);
  }, [
    statusScopedGroups,
    groupNameFilters,
    companyNameFilters,
    legalNameFilters,
  ]);

  const displayRows = useMemo<DisplayRow[]>(() => buildAllDisplayRows(filteredGroups), [filteredGroups]);
  const totalPages = Math.max(1, resolvedTotalPages);
  const safePage = page;
  const paginatedDisplayRows = displayRows;

  const searchSuggestions = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return [];
    const values = new Set<string>();
    statusScopedGroups.forEach((group) => {
      [group.groupName, group.code].forEach((field) => {
        if (field && fuzzyMatch(field, q)) values.add(field);
      });
      group.subsidiaries.forEach((company) => {
        [
          company.companyName,
          company.legalName,
          company.companyCode || "",
          company.gstin,
          company.ieCode,
        ].forEach((field) => {
          if (field && fuzzyMatch(field, q)) values.add(field);
        });
      });
    });
    return Array.from(values).slice(0, 8);
  }, [searchInput, statusScopedGroups]);

  const handleClearSearch = () => {
    setSearchInput("");
  };

  const handlePrevPage = useCallback(async () => {
    if (page <= 1) return;
    const previousPage = page - 1;
    const prevCursor = pageCursors[previousPage] ?? null;
    await fetchPage(
      {
        cursor: prevCursor,
        topCursor,
        page: null,
        direction: "PREV",
        targetPage: previousPage,
      },
      true,
    );
  }, [fetchPage, page, pageCursors, topCursor]);

  const handleNextPage = useCallback(async () => {
    if (!hasNext) return;
    const upcomingPage = page + 1;
    const cursor = pageCursors[upcomingPage] ?? nextCursor;
    if (!cursor) return;

    await fetchPage(
      {
        cursor,
        topCursor,
        page: null,
        direction: "NEXT",
        targetPage: upcomingPage,
      },
      true,
    );
  }, [fetchPage, hasNext, nextCursor, page, pageCursors, topCursor]);

  const handleJumpToPage = useCallback(
    async (requestedPage: number) => {
      const targetPage = Math.max(1, Math.min(totalPages, requestedPage));
      if (targetPage === page) return;

      const direction: "NEXT" | "PREV" = targetPage > page ? "NEXT" : "PREV";
      const jumpCursor = pageCursors[targetPage] ?? (direction === "NEXT" ? nextCursor : topCursor) ?? null;

      await fetchPage(
        {
          cursor: jumpCursor,
          topCursor,
          page: targetPage,
          direction,
          targetPage,
        },
        true,
      );
    },
    [fetchPage, nextCursor, page, pageCursors, topCursor, totalPages],
  );

  const clearAdvancedFilters = () => {
    setGroupNameFilters([]);
    setCompanyNameFilters([]);
    setLegalNameFilters([]);
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

  const openModal = async (company: Company) => {
    try {
      const response = await fetchCompanyDetails(company.companyCode);
      const data = response.data;
      if (data?.companyDetails && data.companyDetails.length > 0) {
        const detail = data.companyDetails[0];
        const enrichedCompany: Company = {
          ...company,
          legalName: detail.name || company.legalName,
          companyName: detail.brand || company.companyName,
          companyCode: detail.companyCode || company.companyCode,
          gstin: detail.gst || company.gstin,
          ieCode: detail.ieCode || company.ieCode,
          incorporationDate: detail.registration || company.incorporationDate,
          address: detail.address || company.address,
          requesterName: detail.initiator?.name || company.requesterName,
          requesterEmail: detail.initiator?.email || company.requesterEmail,
          requestInitiatedAt: detail.initiatedDate || company.requestInitiatedAt,
          signatories: detail.signatories?.map((sig) => ({
            fullName: sig.name || "",
            email: sig.email || "",
            phone: sig.phone || "",
            designation: sig.designation || "",
            employeeId: sig.employeeId || "",
          })) || company.signatories,
        };
        setSelectedCompany(enrichedCompany);
      } else {
        setSelectedCompany(company);
      }
    } catch (err) {
      console.error(err);
      setSelectedCompany(company);
    }
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
    await refreshCompanies(true);
    setIsPreviewOpen(false);
    setSelectedCompany(null);
    toast({
      title: `Company ${actionLabel}`,
      description: `The company request has been ${actionLabel} successfully.`,
    });
  };

  const handleToggleCompanyActive = (companyId: string, isActive: boolean, remark?: string) => {
    if (typeof remark === "string") {
      void executeCompanyAction(companyId, isActive, remark).catch((err) => {
        const message = getApiErrorMessage(err, "Failed to update company status");
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
      const message = getApiErrorMessage(err, "Failed to update company status");
      setError(message);
      toast({
        title: "Action failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setRemarkDialogOpen(false);
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
    groupNameFilters,
    setGroupNameFilters,
    companyNameFilters,
    setCompanyNameFilters,
    legalNameFilters,
    setLegalNameFilters,
    groupNameOptions,
    companyNameOptions,
    legalNameOptions,
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
    paginatedDisplayRows,
    page,
    setPage,
    pageSize,
    setPageSize,
    safePage,
    totalPages,
    pageSizeOptions: COMPANY_PAGE_SIZE_OPTIONS,
    searchSuggestions,
    handleClearSearch,
    clearAdvancedFilters,
    toggleGroup,
    openModal,
    handleSaveCompany,
    handleToggleCompanyActive,
    toggleColumn,
    refreshCompanies,
    handlePrevPage,
    handleNextPage,
    handleJumpToPage,
    remarkDialogOpen,
    setRemarkDialogOpen,
    pendingAction,
    processCompanyAction,
    hasNewCompanyListEvent,
    setHasNewCompanyListEvent,
  };
}
