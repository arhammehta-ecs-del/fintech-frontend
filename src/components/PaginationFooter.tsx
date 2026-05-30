import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PaginationFooterProps = {
  currentCount: number;
  recordCurrentCount?: number;
  recordTotalCount?: number;
  recordLabel?: string;
  pageSize: number;
  pageSizeOptions: readonly number[];
  onPageSizeChange: (value: number) => void;
  safePage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onJumpToPage: (value: number) => void;
  className?: string;
};

export default function PaginationFooter({
  currentCount,
  recordCurrentCount,
  recordTotalCount,
  recordLabel = "Records",
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  safePage,
  totalPages,
  onPrevPage,
  onNextPage,
  onJumpToPage,
  className,
}: PaginationFooterProps) {
  const [pageInput, setPageInput] = useState(String(safePage));

  useEffect(() => {
    setPageInput(String(safePage));
  }, [safePage]);

  if (currentCount <= 0) return null;
  const summaryCurrent = recordCurrentCount ?? currentCount;
  const showBoundedSummary =
    typeof recordTotalCount === "number" &&
    Number.isFinite(recordTotalCount) &&
    recordTotalCount >= 0 &&
    summaryCurrent <= recordTotalCount;
  const summaryText = showBoundedSummary
    ? `${recordLabel}: ${summaryCurrent} of ${recordTotalCount}`
    : `${recordLabel}: ${summaryCurrent}`;

  const commitPageInput = () => {
    const parsed = Number(pageInput);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > totalPages) {
      setPageInput(String(safePage));
      return;
    }
    if (parsed !== safePage) onJumpToPage(parsed);
  };

  return (
    <div className={className ?? "flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"}>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rows/page</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="h-9 w-[84px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
          {summaryText}
        </span>
        <Button variant="ghost" size="sm" onClick={onPrevPage} disabled={safePage === 1}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Prev
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Page</span>
          <Input
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value.replace(/[^\d]/g, ""))}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              commitPageInput();
            }}
            onBlur={commitPageInput}
            className="h-8 w-16 text-center"
          />
          <span>of {totalPages}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onNextPage} disabled={safePage === totalPages}>
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
