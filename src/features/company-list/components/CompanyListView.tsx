import type { ComponentType } from "react";
import { Building2 } from "lucide-react";
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
import { useEffect, useMemo, useState } from "react";
import { useNotificationsPanelOpen } from "@/hooks/useNotificationsPanelOpen";

type CompanyListViewProps = {
  CompanyOnboardingWizardRenderer: ComponentType<CompanyOnboardingWizardRendererProps>;
};

export function CompanyListView({ CompanyOnboardingWizardRenderer }: CompanyListViewProps) {
  const [refreshInitializedAt, setRefreshInitializedAt] = useState<number | null>(null);
  const isNotificationsPanelOpen = useNotificationsPanelOpen();
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

  const { dragState, handleDragStart, handleDragEnd, handleDragOver, handleDrop } = useCompanyDrag(setGroups);
  const pageCompanyCount = useMemo(
    () => paginatedDisplayRows.filter((row) => row.type === "company").length,
    [paginatedDisplayRows],
  );
  const totalCompaniesForTab = statusCounts[selectedStatusTab];

  return (
    <div className="space-y-6">
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
        refreshInitializedAt={refreshInitializedAt}
        onRefresh={async () => {
          await refreshCompanies(true);
          setHasNewCompanyListEvent(false);
        }}
      />

      {isLoading ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center shadow-sm">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4 animate-pulse" />
          <h3 className="text-lg font-medium text-foreground">Loading companies</h3>
          <p className="text-muted-foreground text-sm mt-1">Fetching the latest company list</p>
        </Card>
      ) : error ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center shadow-sm">
          <Building2 className="h-12 w-12 text-destructive/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground">Unable to load companies</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </Card>
      ) : displayRows.length === 0 ? (
        <CompanyListEmptyState selectedStatusTab={selectedStatusTab} onOpenOnboarding={() => setIsOnboardingOpen(true)} />
      ) : (
        <Card className="hidden min-h-[520px] overflow-hidden border-slate-200/80 shadow-[0_10px_30px_rgba(15,23,42,0.08)] md:flex md:h-[calc(100vh-17.5rem)] md:flex-col">
          <div className="min-h-0 flex-1">
            <CompanyListTable
              displayRows={paginatedDisplayRows}
              expanded={expanded}
              visibleColumns={visibleColumns}
              showStatusColumn={showStatusColumn}
              dragState={dragState}
              onToggleGroup={toggleGroup}
              onOpenCompany={openModal}
              onToggleActive={handleToggleCompanyActive}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          </div>
          <PaginationFooter
            currentCount={displayRows.length}
            recordCurrentCount={pageCompanyCount}
            recordTotalCount={totalCompaniesForTab}
            recordLabel="Records"
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
        </Card>
      )}
      {!isLoading && !error && displayRows.length > 0 ? (
        <PaginationFooter
          currentCount={displayRows.length}
          recordCurrentCount={pageCompanyCount}
          recordTotalCount={totalCompaniesForTab}
          recordLabel="Records"
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
