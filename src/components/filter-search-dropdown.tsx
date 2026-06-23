import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchableDropdownOption = {
  value: string;
  label: string;
  description?: string;
  count?: number;
  level?: number;
  path?: string;
  disabled?: boolean;
};

type SharedDropdownProps = {
  title: string;
  placeholder: string;
  options: SearchableDropdownOption[];
  triggerClassName?: string;
  contentClassName?: string;
  searchInputClassName?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  showSelectionBadge?: boolean;
  emptyMessage?: string;
  disabled?: boolean;
  onSelectAll?: (values: string[]) => void;
};

const filterOptions = (options: SearchableDropdownOption[], searchTerm: string) => {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return options;

  return options.filter((option) =>
    [option.label, option.description, option.path]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query)),
  );
};

const getOptionSummaryLabel = (option: SearchableDropdownOption) =>
  option.description ? `${option.label} - ${option.description}` : option.label;

const DropdownHeader = ({
  title,
  isSearchExpanded,
  showSelectAll = false,
  onToggleSearch,
  onSelectAll,
}: {
  title: string;
  isSearchExpanded: boolean;
  showSelectAll?: boolean;
  onToggleSearch: () => void;
  onSelectAll?: () => void;
}) => (
  <div className="mt-1 flex items-center justify-between gap-2 px-1">
    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{title}</div>
    <div className="flex items-center gap-2">
      {showSelectAll && onSelectAll ? (
        <Button
          type="button"
          variant="ghost"
          className="h-9 px-2 text-[11px] font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          onClick={onSelectAll}
        >
          Select all
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onToggleSearch}
        className="h-9 w-9 rounded-lg border-slate-200 bg-slate-50 text-slate-600 shadow-none hover:border-slate-300 hover:bg-white"
        aria-label={isSearchExpanded ? `Close ${title.toLowerCase()} search` : `Open ${title.toLowerCase()} search`}
      >
        {isSearchExpanded ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
      </Button>
    </div>
  </div>
);

const DropdownSearch = ({
  title,
  searchTerm,
  isSearchExpanded,
  searchInputClassName,
  onSearchTermChange,
  onCloseSearch,
}: {
  title: string;
  searchTerm: string;
  isSearchExpanded: boolean;
  searchInputClassName?: string;
  onSearchTermChange: (value: string) => void;
  onCloseSearch: () => void;
}) => (
  <div
    className={cn(
      "overflow-hidden px-1 transition-all duration-250 ease-out",
      isSearchExpanded ? "mt-2 max-h-12 opacity-100" : "max-h-0 opacity-0",
    )}
  >
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            onCloseSearch();
          }
        }}
        placeholder={`Search ${title.toLowerCase()}...`}
        className={cn("h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] shadow-none", searchInputClassName)}
        autoComplete="off"
        autoFocus={isSearchExpanded}
      />
    </div>
  </div>
);

export function SearchableMultiSelectMenu({
  title,
  placeholder,
  options,
  selected,
  onToggle,
  triggerClassName,
  contentClassName,
  searchInputClassName,
  align = "start",
  side = "bottom",
  sideOffset = 0,
  showSelectionBadge = true,
  emptyMessage = "No options available",
  disabled = false,
  onSelectAll,
}: SharedDropdownProps & {
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [hasScrollableList, setHasScrollableList] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const filteredOptions = useMemo(() => filterOptions(options, searchTerm), [options, searchTerm]);
  const selectableFilteredValues = useMemo(
    () => filteredOptions.filter((option) => !option.disabled).map((option) => option.value),
    [filteredOptions],
  );
  const selectedLabels = selected
    .map((value) => {
      const option = options.find((entry) => entry.value === value);
      return option ? getOptionSummaryLabel(option) : value;
    })
    .filter(Boolean);
  const summaryLabel =
    selected.length === 0 ? placeholder : selected.length === 1 ? selectedLabels[0] : `${selected.length} selected`;

  useEffect(() => {
    if (!open) {
      setHasScrollableList(false);
      return;
    }

    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      setHasScrollableList(Boolean(list && list.scrollHeight > list.clientHeight));
    });

    return () => cancelAnimationFrame(frame);
  }, [filteredOptions, open, isSearchExpanded]);

  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearchTerm("");
          setIsSearchExpanded(false);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between rounded-lg border-slate-200 bg-white px-3 text-left text-[12px] font-medium hover:border-slate-300",
            selected.length > 0 ? "border-blue-200 bg-blue-50/40 text-blue-800" : "text-slate-700",
            triggerClassName,
          )}
        >
          <span className="truncate">{summaryLabel}</span>
          <span className="ml-2 inline-flex items-center gap-1.5">
            {showSelectionBadge && selected.length > 0 ? (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                {selected.length}
              </span>
            ) : null}
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={cn(
          "z-[140] min-w-[var(--radix-dropdown-menu-trigger-width)] w-max max-w-[420px] border border-slate-200 bg-white p-2 shadow-[0_16px_34px_rgba(15,23,42,0.12)]",
          contentClassName,
        )}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownHeader
          title={title}
          isSearchExpanded={isSearchExpanded}
          showSelectAll={Boolean(onSelectAll && hasScrollableList && selectableFilteredValues.length > 0)}
          onToggleSearch={() => {
            if (isSearchExpanded) {
              setSearchTerm("");
              setIsSearchExpanded(false);
              return;
            }
            setIsSearchExpanded(true);
          }}
          onSelectAll={
            onSelectAll
              ? () => onSelectAll(selectableFilteredValues)
              : undefined
          }
        />
        <DropdownSearch
          title={title}
          searchTerm={searchTerm}
          isSearchExpanded={isSearchExpanded}
          searchInputClassName={searchInputClassName}
          onSearchTermChange={setSearchTerm}
          onCloseSearch={() => {
            setSearchTerm("");
            setIsSearchExpanded(false);
          }}
        />
        {filteredOptions.length === 0 ? (
          <div className="px-2 py-2 text-[12px] text-slate-400">{emptyMessage}</div>
        ) : (
          <div ref={listRef} className="mt-2 max-h-56 overflow-y-auto">
            {filteredOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={`${option.value}-${option.label}`}
                checked={selected.includes(option.value)}
                disabled={option.disabled}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={() => {
                  if (!option.disabled) onToggle(option.value);
                }}
                className={cn("items-start text-[13px]", option.disabled && "cursor-not-allowed opacity-50")}
                style={typeof option.level === "number" ? { marginLeft: `${(option.level - 1) * 16}px` } : undefined}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{option.label}</span>
                      {typeof option.level === "number" ? (
                        <span className="shrink-0 rounded bg-indigo-100 px-1 py-0.5 text-[9px] font-bold tracking-wider text-indigo-700">
                          L{option.level}
                        </span>
                      ) : null}
                    </div>
                    {typeof option.count === "number" ? (
                      <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                        {option.count}
                      </span>
                    ) : null}
                  </div>
                  {option.path ? (
                    <span className="whitespace-normal break-all text-[10px] leading-4 text-slate-500">{option.path}</span>
                  ) : option.description ? (
                    <span className="whitespace-normal break-words text-[11px] leading-4 text-slate-500">{option.description}</span>
                  ) : null}
                </div>
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SearchableSingleSelectMenu({
  title,
  placeholder,
  options,
  value,
  onChange,
  triggerClassName,
  contentClassName,
  searchInputClassName,
  align = "start",
  side = "bottom",
  sideOffset = 0,
  showSelectionBadge = true,
  emptyMessage = "No options available",
  disabled = false,
}: SharedDropdownProps & {
  value: string | null;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const filteredOptions = useMemo(() => filterOptions(options, searchTerm), [options, searchTerm]);
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const summaryLabel = selectedOption ? getOptionSummaryLabel(selectedOption) : placeholder;

  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearchTerm("");
          setIsSearchExpanded(false);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between rounded-lg border-slate-200 bg-white px-3 text-left text-[12px] font-medium hover:border-slate-300",
            value ? "border-blue-200 bg-blue-50/40 text-blue-800" : "text-slate-700",
            triggerClassName,
          )}
        >
          <span className="truncate">{summaryLabel}</span>
          <span className="ml-2 inline-flex items-center gap-1.5">
            {showSelectionBadge && value ? (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                1
              </span>
            ) : null}
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={cn(
          "z-[140] min-w-[var(--radix-dropdown-menu-trigger-width)] w-max max-w-[420px] border border-slate-200 bg-white p-2 shadow-[0_16px_34px_rgba(15,23,42,0.12)]",
          contentClassName,
        )}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownHeader
          title={title}
          isSearchExpanded={isSearchExpanded}
          onToggleSearch={() => {
            if (isSearchExpanded) {
              setSearchTerm("");
              setIsSearchExpanded(false);
              return;
            }
            setIsSearchExpanded(true);
          }}
        />
        <DropdownSearch
          title={title}
          searchTerm={searchTerm}
          isSearchExpanded={isSearchExpanded}
          searchInputClassName={searchInputClassName}
          onSearchTermChange={setSearchTerm}
          onCloseSearch={() => {
            setSearchTerm("");
            setIsSearchExpanded(false);
          }}
        />
        {filteredOptions.length === 0 ? (
          <div className="px-2 py-2 text-[12px] text-slate-400">{emptyMessage}</div>
        ) : (
          <div className="mt-2 max-h-56 overflow-y-auto space-y-1">
            {filteredOptions.map((option) => {
              const checked = value === option.value;
              return (
                <DropdownMenuItem
                  key={`${option.value}-${option.label}`}
                  disabled={option.disabled}
                  onSelect={(event) => {
                    event.preventDefault();
                    if (option.disabled) return;
                    onChange(checked ? "" : option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-md px-2 py-2 text-[13px]",
                    checked ? "bg-blue-50 text-blue-800 focus:bg-blue-50 focus:text-blue-800" : "",
                    option.disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        checked ? "border-blue-600" : "border-slate-300",
                      )}
                    >
                      <span className={cn("h-2 w-2 rounded-full", checked ? "bg-blue-600" : "bg-transparent")} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate">{option.label}</span>
                          {typeof option.level === "number" ? (
                            <span className="shrink-0 rounded bg-indigo-100 px-1 py-0.5 text-[9px] font-bold tracking-wider text-indigo-700">
                              L{option.level}
                            </span>
                          ) : null}
                        </div>
                        {typeof option.count === "number" ? (
                          <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                            {option.count}
                          </span>
                        ) : null}
                      </div>
                      {option.path ? (
                        <span className="whitespace-normal break-all text-[10px] leading-4 text-slate-500">{option.path}</span>
                      ) : option.description ? (
                        <span className="whitespace-normal break-words text-[11px] leading-4 text-slate-500">{option.description}</span>
                      ) : null}
                    </div>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
