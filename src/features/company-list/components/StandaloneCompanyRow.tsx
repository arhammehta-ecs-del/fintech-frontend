import type { DragEvent } from "react";
import type { Company } from "@/contexts/AppContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GripVertical, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DragPayload, VisibleColumn } from "@/features/company-list/types";
import { formatDisplayDate, statusColors } from "@/features/company-list/utils";

type StandaloneCompanyRowProps = {
  company: Company;
  groupId: string;
  groupLabel: string;
  visibleColumns: Set<VisibleColumn>;
  showStatusColumn: boolean;
  onManage: (company: Company, editing?: boolean) => void;
  dragState: DragPayload | null;
  onDragStart: (payload: DragPayload) => (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => void;
  onDrop: (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => void;
};

export default function StandaloneCompanyRow({
  company,
  groupId,
  groupLabel,
  visibleColumns,
  showStatusColumn,
  onManage,
  dragState,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: StandaloneCompanyRowProps) {
  const isDropTarget =
    dragState?.type === "subsidiary" &&
    dragState.groupId === groupId &&
    dragState.companyId !== company.id;

  const isDragging =
    dragState?.type === "subsidiary" &&
    dragState.groupId === groupId &&
    dragState.companyId === company.id;

  return (
    <tbody>
      <tr
        className={cn(
          "border-b border-border transition-colors hover:bg-sky-50/70",
          isDragging && "opacity-50",
          isDropTarget && "bg-primary/5",
        )}
        onDragOver={onDragOver({ type: "subsidiary", groupId, companyId: company.id })}
        onDrop={onDrop({ type: "subsidiary", groupId, companyId: company.id })}
      >
        <td className="px-4 py-3">
          <button
            type="button"
            draggable
            onDragStart={onDragStart({ type: "subsidiary", groupId, companyId: company.id })}
            onDragEnd={onDragEnd}
            className="text-muted-foreground p-1 -ml-1 cursor-grab active:cursor-grabbing"
            aria-label={`Drag ${company.companyName}`}
          >
            <GripVertical className="h-4 w-4 opacity-50 hover:opacity-100" />
          </button>
        </td>
        {visibleColumns.has("groupName") && (
          <td className="px-4 py-3 text-sm text-muted-foreground">{groupLabel}</td>
        )}
        {visibleColumns.has("companyName") && (
          <td className="px-4 py-3 text-sm font-medium text-foreground">
            <span
              className="text-primary hover:underline cursor-pointer"
              onClick={() => {
                onManage(company);
              }}
            >
              {company.companyName}
            </span>
          </td>
        )}
        {visibleColumns.has("code") && (
          <td className="px-4 py-3 text-sm text-muted-foreground">{company.legalName}</td>
        )}
        {visibleColumns.has("createdDate") && (
          <td className="px-4 py-3 text-sm text-muted-foreground">{formatDisplayDate(company.incorporationDate)}</td>
        )}
        {showStatusColumn && visibleColumns.has("status") && (
          <td className="px-4 py-3">
            <Badge variant="outline" className={cn("text-xs", statusColors[company.status])}>
              {company.status}
            </Badge>
          </td>
        )}
        {visibleColumns.has("manage") && (
          <td className="px-4 py-3">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                onClick={() => onManage(company)}
                aria-label={`Manage ${company.companyName}`}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </td>
        )}
      </tr>
    </tbody>
  );
}
