import { Card } from "@/components/ui/card";
import SortableGroupBody from "@/features/company-list/components/SortableGroupBody";
import StandaloneCompanyRow from "@/features/company-list/components/StandaloneCompanyRow";
import type { CompanyListTableProps } from "@/features/company-list/types";

export default function CompanyListTable({
  displayRows,
  expanded,
  visibleColumns,
  showStatusColumn,
  dragState,
  onToggleGroup,
  onOpenCompany,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: CompanyListTableProps) {
  return (
    <Card className="hidden overflow-hidden border-slate-200/80 shadow-[0_10px_30px_rgba(15,23,42,0.08)] md:block">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-16"></th>
              {visibleColumns.has("groupName") && (
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Group Name
                </th>
              )}
              {visibleColumns.has("companyName") && (
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Company Name
                </th>
              )}
              {visibleColumns.has("code") && (
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Legal Name
                </th>
              )}
              {visibleColumns.has("createdDate") && (
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Incorporation Date
                </th>
              )}
              {showStatusColumn && visibleColumns.has("status") && (
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
              )}
              {visibleColumns.has("manage") && (
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Manage
                </th>
              )}
            </tr>
          </thead>
          {displayRows.map((row) =>
            row.type === "group" ? (
              <SortableGroupBody
                key={row.group.id}
                group={row.group}
                expanded={expanded.has(row.group.id)}
                visibleColumns={visibleColumns}
                showStatusColumn={showStatusColumn}
                onToggle={() => onToggleGroup(row.group.id)}
                onManage={onOpenCompany}
                dragState={dragState}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOver={onDragOver}
                onDrop={onDrop}
              />
            ) : (
              <StandaloneCompanyRow
                key={row.company.id}
                company={row.company}
                groupId={row.groupId}
                groupLabel={row.groupName}
                visibleColumns={visibleColumns}
                showStatusColumn={showStatusColumn}
                onManage={onOpenCompany}
                dragState={dragState}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOver={onDragOver}
                onDrop={onDrop}
              />
            ),
          )}
        </table>
      </div>
    </Card>
  );
}
