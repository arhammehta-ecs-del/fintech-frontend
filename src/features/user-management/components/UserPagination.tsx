import PaginationFooter from "@/components/PaginationFooter";
import { USER_PAGE_SIZE_OPTIONS } from "@/features/user-management/constants";

type UserPaginationProps = {
  currentCount: number;
  recordCurrentCount?: number;
  recordTotalCount?: number;
  recordLabel?: string;
  pageSize: (typeof USER_PAGE_SIZE_OPTIONS)[number];
  onPageSizeChange: (value: (typeof USER_PAGE_SIZE_OPTIONS)[number]) => void;
  safePage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onJumpToPage: (value: number) => void;
  className?: string;
};

export default function UserPagination({
  currentCount,
  recordCurrentCount,
  recordTotalCount,
  recordLabel,
  pageSize,
  onPageSizeChange,
  safePage,
  totalPages,
  onPrevPage,
  onNextPage,
  onJumpToPage,
  className,
}: UserPaginationProps) {
  return (
    <PaginationFooter
      currentCount={currentCount}
      recordCurrentCount={recordCurrentCount}
      recordTotalCount={recordTotalCount}
      recordLabel={recordLabel}
      pageSize={pageSize}
      pageSizeOptions={USER_PAGE_SIZE_OPTIONS}
      onPageSizeChange={(value) => onPageSizeChange(value as (typeof USER_PAGE_SIZE_OPTIONS)[number])}
      safePage={safePage}
      totalPages={totalPages}
      onPrevPage={onPrevPage}
      onNextPage={onNextPage}
      onJumpToPage={onJumpToPage}
      className={className}
    />
  );
}
