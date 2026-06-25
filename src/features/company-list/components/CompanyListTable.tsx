import SortableGroupBody from "@/features/company-list/components/SortableGroupBody";
import StandaloneCompanyRow from "@/features/company-list/components/StandaloneCompanyRow";
import type { CompanyListTableProps } from "@/features/company-list/types";

export default function CompanyListTable({
  displayRows,
  expanded,
  scrollContainerRef,
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
    <div ref={scrollContainerRef} className="hidden min-h-0 flex-1 overflow-auto md:block">
      <table className="min-w-[760px] w-full border-separate border-spacing-0 text-left">
        <thead className="text-sm uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="sticky top-0 z-20 w-16 border-b border-border bg-muted px-4 py-3 font-medium"></th>
            {visibleColumns.has("groupName") && (
              <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-3 font-medium">
                Group Name
              </th>
            )}
            {visibleColumns.has("companyName") && (
              <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-3 font-medium">
                Company Name
              </th>
            )}
            {visibleColumns.has("code") && (
              <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-3 font-medium">
                Legal Name
              </th>
            )}
            {visibleColumns.has("createdDate") && (
              <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-3 font-medium">
                Incorporation Date
              </th>
            )}
            {showStatusColumn && visibleColumns.has("status") && (
              <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-3 font-medium">
                Status
              </th>
            )}
            {visibleColumns.has("manage") && (
              <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-3 font-medium">
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
  );
}

