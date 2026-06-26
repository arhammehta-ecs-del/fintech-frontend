import type { ComponentType } from "react";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompanyPreviewDialog } from "@/components/CompanyPreviewDialog";
import CompanyListEmptyState from "@/features/company-list/components/CompanyListEmptyState";
import CompanyListTable from "@/features/company-list/components/CompanyListTable";
import CompanyListToolbar from "@/features/company-list/components/CompanyListToolbar";
import { useCompanyDrag } from "@/features/company-list/hooks/useCompanyDrag";
import { useCompanyList } from "@/features/company-list/hooks/useCompanyList";
import { RemarkDialog } from "@/components/RemarkDialog";
import PaginationFooter from "@/components/PaginationFooter";
import type { CompanyOnboardingWizardRendererProps } from "@/features/company-list/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNotificationsPanelOpen } from "@/hooks/useNotificationsPanelOpen";

type CompanyListViewProps = {
  CompanyOnboardingWizardRenderer: ComponentType<CompanyOnboardingWizardRendererProps>;
};

export function CompanyListView({ CompanyOnboardingWizardRenderer }: CompanyListViewProps) {
  const [refreshInitializedAt, setRefreshInitializedAt] = useState<number | null>(null);
  const isNotificationsPanelOpen = useNotificationsPanelOpen();
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const {
    setGroups,
    expanded,
    searchInput,
    setSearchInput,
    appliedFilters,
    applyFilters,
    searchSuggestions,
    visibleColumns,
    selectedCompany,
    isPreviewOpen,
    setIsPreviewOpen,
    isOnboardingOpen,
    setIsOnboardingOpen,
    statusCounts,
    isLoading,
    error,
    selectedStatusTab,
    setSelectedStatusTab,
    showStatusColumn,
    selectedGroupName,
    selectedGroupCode,
    displayRows,
    paginatedDisplayRows,
    pageSize,
    setPageSize,
    safePage,
    totalPages,
    pageSizeOptions,
    handlePrevPage,
    handleNextPage,
    handleJumpToPage,
    handleClearSearch,
    clearAdvancedFilters,
    todayIso,
    toggleGroup,
    openModal,
    handleSaveCompany,
    handleToggleCompanyActive,
    refreshCompanies,
    remarkDialogOpen,
    setRemarkDialogOpen,
    pendingAction,
    processCompanyAction,
    hasNewCompanyListEvent,
    setHasNewCompanyListEvent,
  } = useCompanyList();

  useEffect(() => {
    if (isLoading || error) return;
    if (refreshInitializedAt) return;
    setRefreshInitializedAt(Date.now());
  }, [isLoading, error, refreshInitializedAt]);

  useEffect(() => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollTo({ top: 0, behavior: "auto" });
  }, [safePage]);

  const { dragState, handleDragStart, handleDragEnd, handleDragOver, handleDrop } = useCompanyDrag(setGroups);
  const pageCompanyCount = useMemo(
    () => paginatedDisplayRows.filter((row) => row.type === "company").length,
    [paginatedDisplayRows],
  );
  const totalCompaniesForTab = statusCounts[selectedStatusTab];
  const companyRangeSummary = useMemo(() => {
    if (totalCompaniesForTab <= 0 || pageCompanyCount === 0) return "Range: 0-0 of 0";
    const start = Math.max(1, (safePage - 1) * pageSize + 1);
    const end = Math.min(totalCompaniesForTab, start + pageCompanyCount - 1);
    return `Range: ${start}-${end} of ${totalCompaniesForTab}`;
  }, [pageCompanyCount, pageSize, safePage, totalCompaniesForTab]);
  const hasRows = displayRows.length > 0;
  const showInitialLoadingState = isLoading && !hasRows && !error;
  const showBackgroundRefreshState = isLoading && hasRows;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-6 overflow-hidden">
      <CompanyListToolbar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onClearSearch={handleClearSearch}
        selectedStatusTab={selectedStatusTab}
        onStatusTabChange={setSelectedStatusTab}
        statusCounts={statusCounts}
        appliedFilters={appliedFilters}
        onApplyFilters={applyFilters}
        searchSuggestions={searchSuggestions}
        onClearAdvancedFilters={clearAdvancedFilters}
        todayIso={todayIso}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        hasNewCompanyListEvent={hasNewCompanyListEvent}
        suppressAutoEventTooltip={isOnboardingOpen || isPreviewOpen || remarkDialogOpen || isNotificationsPanelOpen}
        isRefreshing={showBackgroundRefreshState}
        refreshInitializedAt={refreshInitializedAt}
        onRefresh={async () => {
          await refreshCompanies(true);
          setHasNewCompanyListEvent(false);
        }}
      />

      {showInitialLoadingState ? (
        <Card className="hidden min-h-[520px] overflow-hidden border-slate-200/80 shadow-[0_10px_30px_rgba(15,23,42,0.08)] md:flex md:h-[calc(100dvh-16rem)] md:min-h-[560px] md:flex-col">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading companies
          </div>
          <div className="flex-1 space-y-4 bg-white px-4 py-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="grid grid-cols-6 gap-4">
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                <div className="col-span-2 h-10 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        </Card>
      ) : error ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center shadow-sm">
          <Building2 className="mb-4 h-12 w-12 text-destructive/40" />
          <h3 className="text-lg font-medium text-foreground">Unable to load companies</h3>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </Card>
      ) : !hasRows ? (
        <CompanyListEmptyState selectedStatusTab={selectedStatusTab} onOpenOnboarding={() => setIsOnboardingOpen(true)} />
      ) : (
        <Card className="relative hidden overflow-hidden border-slate-200/80 shadow-[0_10px_30px_rgba(15,23,42,0.08)] md:flex md:h-[calc(100dvh-16rem)] md:min-h-[560px] md:flex-col">
          {showBackgroundRefreshState ? (
            <div className="pointer-events-none absolute inset-0 z-20 bg-white/55 backdrop-blur-[1px]">
              <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-slate-100/80">
                <div className="h-full w-1/3 animate-[refresh-slide_1.15s_ease-in-out_infinite] rounded-full bg-[#3553e9]" />
              </div>
              <div className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating list...
              </div>
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col">
            <CompanyListTable
              displayRows={paginatedDisplayRows}
              expanded={expanded}
              pageSize={pageSize}
              scrollContainerRef={tableScrollRef}
              visibleColumns={visibleColumns}
              showStatusColumn={showStatusColumn}
              dragState={dragState}
              onToggleGroup={toggleGroup}
              onOpenCompany={openModal}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
            <PaginationFooter
              currentCount={displayRows.length}
              recordCurrentCount={pageCompanyCount}
              recordTotalCount={totalCompaniesForTab}
              recordLabel="Records"
              summaryTextOverride={companyRangeSummary}
              pageSize={pageSize}
              pageSizeOptions={pageSizeOptions}
              onPageSizeChange={(value) => setPageSize(value as (typeof pageSizeOptions)[number])}
              safePage={safePage}
              totalPages={totalPages}
              onPrevPage={() => void handlePrevPage()}
              onNextPage={() => void handleNextPage()}
              onJumpToPage={(value) => void handleJumpToPage(value)}
              className="shrink-0 flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            />
          </div>
        </Card>
      )}
      {!showInitialLoadingState && !error && hasRows ? (
        <PaginationFooter
          currentCount={displayRows.length}
          recordCurrentCount={pageCompanyCount}
          recordTotalCount={totalCompaniesForTab}
          recordLabel="Records"
          summaryTextOverride={companyRangeSummary}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageSizeChange={(value) => setPageSize(value as (typeof pageSizeOptions)[number])}
          safePage={safePage}
          totalPages={totalPages}
          onPrevPage={() => void handlePrevPage()}
          onNextPage={() => void handleNextPage()}
          onJumpToPage={(value) => void handleJumpToPage(value)}
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between md:hidden"
        />
      ) : null}

      <CompanyPreviewDialog
        company={selectedCompany}
        companyCode={selectedCompany?.companyCode ?? ""}
        groupName={selectedGroupName}
        groupCode={selectedGroupCode}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        onSave={handleSaveCompany}
        onToggleActive={handleToggleCompanyActive}
      />
      <CompanyOnboardingWizardRenderer
        embedded
        open={isOnboardingOpen}
        onOpenChange={setIsOnboardingOpen}
        onSubmitted={() => refreshCompanies()}
      />

      <RemarkDialog
        open={remarkDialogOpen}
        onOpenChange={setRemarkDialogOpen}
        onConfirm={processCompanyAction}
        title={pendingAction?.isActive ? "Approve Company" : "Reject Company"}
        description={`Are you sure you want to ${pendingAction?.isActive ? "approve" : "reject"} this company? Please provide a remark.`}
        confirmLabel={pendingAction?.isActive ? "Approve" : "Reject"}
        confirmVariant={pendingAction?.isActive ? "success" : "destructive"}
      />
    </div>
  );
}




