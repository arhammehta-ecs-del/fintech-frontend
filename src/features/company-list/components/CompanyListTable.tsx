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
    <div className="hidden h-full md:block">
      <div className="h-full overflow-auto">
        <table className="min-w-[760px] w-full">
          <thead className="relative z-30">
            <tr className="border-b border-border bg-slate-100">
              <th className="sticky top-0 z-30 w-16 bg-slate-100 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"></th>
              {visibleColumns.has("groupName") && (
                <th className="sticky top-0 z-30 bg-slate-100 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Group Name
                </th>
              )}
              {visibleColumns.has("companyName") && (
                <th className="sticky top-0 z-30 bg-slate-100 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Company Name
                </th>
              )}
              {visibleColumns.has("code") && (
                <th className="sticky top-0 z-30 bg-slate-100 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Legal Name
                </th>
              )}
              {visibleColumns.has("createdDate") && (
                <th className="sticky top-0 z-30 bg-slate-100 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Incorporation Date
                </th>
              )}
              {showStatusColumn && visibleColumns.has("status") && (
                <th className="sticky top-0 z-30 bg-slate-100 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
              )}
              {visibleColumns.has("manage") && (
                <th className="sticky top-0 z-30 bg-slate-100 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                groupCode={row.groupCode}
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
    </div>
  );
}
