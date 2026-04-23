import type { ComponentType } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompanyPreviewDialog } from "@/components/shared/CompanyPreviewDialog";
import CorporateEmptyState from "@/features/corporate/components/CorporateEmptyState";
import CorporateTable from "@/features/corporate/components/CorporateTable";
import CorporateToolbar from "@/features/corporate/components/CorporateToolbar";
import { useCorporateDrag } from "@/features/corporate/hooks/useCorporateDrag";
import { useCorporateList } from "@/features/corporate/hooks/useCorporateList";
import type { OnboardingWizardRendererProps } from "@/features/corporate/types";

type CorporateListViewProps = {
  OnboardingWizardRenderer: ComponentType<OnboardingWizardRendererProps>;
};

export function CorporateListView({ OnboardingWizardRenderer }: CorporateListViewProps) {
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
  } = useCorporateList();

  const { dragState, handleDragStart, handleDragEnd, handleDragOver, handleDrop } = useCorporateDrag(setGroups);

  return (
    <div className="space-y-6">
      <CorporateToolbar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        onClearSearch={handleClearSearch}
        selectedStatusTab={selectedStatusTab}
        onStatusTabChange={setSelectedStatusTab}
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
        <CorporateEmptyState selectedStatusTab={selectedStatusTab} onOpenOnboarding={() => setIsOnboardingOpen(true)} />
      ) : (
        <CorporateTable
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
      <OnboardingWizardRenderer embedded open={isOnboardingOpen} onOpenChange={setIsOnboardingOpen} />
    </div>
  );
}
