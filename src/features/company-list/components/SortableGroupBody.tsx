import type { DragEvent } from "react";
import type { Company, GroupCompany } from "@/contexts/AppContext";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DragPayload, VisibleColumn } from "@/features/company-list/types";
import { formatDisplayDate } from "@/features/company-list/utils";
import SortableSubsidiaryRow from "@/features/company-list/components/SortableSubsidiaryRow";

type SortableGroupBodyProps = {
  group: GroupCompany;
  expanded: boolean;
  visibleColumns: Set<VisibleColumn>;
  showStatusColumn: boolean;
  onToggle: () => void;
  onManage: (company: Company, editing?: boolean) => void;
  dragState: DragPayload | null;
  onDragStart: (payload: DragPayload) => (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => void;
  onDrop: (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => void;
};

export default function SortableGroupBody({
  group,
  expanded,
  visibleColumns,
  showStatusColumn,
  onToggle,
  onManage,
  dragState,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: SortableGroupBodyProps) {
  const isDropTarget = dragState?.type === "group" && dragState.groupId !== group.id;
  const isDragging = dragState?.type === "group" && dragState.groupId === group.id;

  return (
    <tbody>
      <tr
        className={cn(
          "border-b border-border cursor-pointer transition-colors hover:bg-sky-50/70",
          isDragging && "opacity-50",
          isDropTarget && "bg-primary/5",
        )}
        onClick={onToggle}
        onDragOver={onDragOver({ type: "group", groupId: group.id })}
        onDrop={onDrop({ type: "group", groupId: group.id })}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              draggable
              onDragStart={onDragStart({ type: "group", groupId: group.id })}
              onDragEnd={onDragEnd}
              onClick={(event) => event.stopPropagation()}
              className="text-muted-foreground p-1 -ml-1 cursor-grab active:cursor-grabbing"
              aria-label={`Drag ${group.groupName}`}
            >
              <GripVertical className="h-4 w-4 opacity-50 hover:opacity-100" />
            </button>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </td>
        {visibleColumns.has("groupName") && (
          <td className="px-4 py-3 text-sm font-medium text-foreground">
            {group.groupName} ({group.subsidiaries.length})
          </td>
        )}
        {visibleColumns.has("companyName") && (
          <td className="px-4 py-3 text-sm text-muted-foreground"></td>
        )}
        {visibleColumns.has("code") && (
          <td className="px-4 py-3 text-sm text-muted-foreground"></td>
        )}
        {visibleColumns.has("createdDate") && (
          <td className="px-4 py-3 text-sm text-muted-foreground">{formatDisplayDate(group.createdDate)}</td>
        )}
        {showStatusColumn && visibleColumns.has("status") && <td className="px-4 py-3 text-sm text-muted-foreground">Group</td>}
        {visibleColumns.has("manage") && <td className="px-4 py-3 text-sm text-muted-foreground"></td>}
      </tr>

      {expanded &&
        group.subsidiaries.map((sub) => (
          <SortableSubsidiaryRow
            key={sub.id}
            sub={sub}
            groupId={group.id}
            visibleColumns={visibleColumns}
            showStatusColumn={showStatusColumn}
            onManage={onManage}
            dragState={dragState}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        ))}
    </tbody>
  );
}
