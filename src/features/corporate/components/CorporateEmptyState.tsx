import { Building2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StatusTab } from "@/features/corporate/types";

type CorporateEmptyStateProps = {
  selectedStatusTab: StatusTab;
  onOpenOnboarding: () => void;
};

export default function CorporateEmptyState({ selectedStatusTab, onOpenOnboarding }: CorporateEmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center py-16 text-center shadow-sm">
      <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h3 className="text-lg font-medium text-foreground">No companies found</h3>
      <p className="text-muted-foreground text-sm mt-1 mb-4">
        {selectedStatusTab === "active"
          ? "No active companies match the current filters."
          : selectedStatusTab === "pending"
            ? "No pending companies match the current filters."
            : "No inactive companies match the current filters."}
      </p>
      <Button onClick={onOpenOnboarding} className="gap-2">
        <Plus className="h-4 w-4" /> New Onboarding
      </Button>
    </Card>
  );
}
