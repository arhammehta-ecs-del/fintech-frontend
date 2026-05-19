import PaginationFooter from "@/components/PaginationFooter";
import { USER_PAGE_SIZE_OPTIONS } from "@/features/user-management/constants";

type UserPaginationProps = {
  currentCount: number;
  pageSize: (typeof USER_PAGE_SIZE_OPTIONS)[number];
  onPageSizeChange: (value: (typeof USER_PAGE_SIZE_OPTIONS)[number]) => void;
  safePage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  className?: string;
};

export default function UserPagination({
  currentCount,
  pageSize,
  onPageSizeChange,
  safePage,
  totalPages,
  onPrevPage,
  onNextPage,
  className,
}: UserPaginationProps) {
  return (
    <PaginationFooter
      currentCount={currentCount}
      pageSize={pageSize}
      pageSizeOptions={USER_PAGE_SIZE_OPTIONS}
      onPageSizeChange={(value) => onPageSizeChange(value as (typeof USER_PAGE_SIZE_OPTIONS)[number])}
      safePage={safePage}
      totalPages={totalPages}
      onPrevPage={onPrevPage}
      onNextPage={onNextPage}
      className={className}
    />
  );
}
