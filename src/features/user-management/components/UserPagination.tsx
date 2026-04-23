import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { USER_PAGE_SIZE_OPTIONS } from "@/features/user-management/constants";

type UserPaginationProps = {
  currentCount: number;
  pageSize: (typeof USER_PAGE_SIZE_OPTIONS)[number];
  onPageSizeChange: (value: (typeof USER_PAGE_SIZE_OPTIONS)[number]) => void;
  safePage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export default function UserPagination({
  currentCount,
  pageSize,
  onPageSizeChange,
  safePage,
  totalPages,
  onPrevPage,
  onNextPage,
}: UserPaginationProps) {
  if (currentCount <= 0) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rows/page</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value) as (typeof USER_PAGE_SIZE_OPTIONS)[number])}>
          <SelectTrigger className="h-9 w-[84px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USER_PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onPrevPage} disabled={safePage === 1}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Prev
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {safePage} of {totalPages}
        </span>
        <Button variant="ghost" size="sm" onClick={onNextPage} disabled={safePage === totalPages}>
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
