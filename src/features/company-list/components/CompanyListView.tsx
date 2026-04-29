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
import type { CompanyOnboardingWizardRendererProps } from "@/features/company-list/types";

type CompanyListViewProps = {
  CompanyOnboardingWizardRenderer: ComponentType<CompanyOnboardingWizardRendererProps>;
};

export function CompanyListView({ CompanyOnboardingWizardRenderer }: CompanyListViewProps) {
  const {
    setGroups,
    expanded,
    searchInput,
    setSearchInput,
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
    showStatusColumn,
    selectedGroupName,
    selectedGroupCode,
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
  } = useCompanyList();

  const { dragState, handleDragStart, handleDragEnd, handleDragOver, handleDrop } = useCompanyDrag(setGroups);

  return (
    <div className="space-y-6">
      <CompanyListToolbar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        onClearSearch={handleClearSearch}
        selectedStatusTab={selectedStatusTab}
        onStatusTabChange={setSelectedStatusTab}
        statusCounts={statusCounts}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
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
        <CompanyListTable
          displayRows={displayRows}
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
      )}

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
      <CompanyOnboardingWizardRenderer embedded open={isOnboardingOpen} onOpenChange={setIsOnboardingOpen} />

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
