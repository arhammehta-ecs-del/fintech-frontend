import { ChevronDown, Eye, Pencil, ShieldCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PermissionAction, PermissionBucket, PermissionCategory, SystemAccessScope } from "@/features/user-management/types";
import { PERMISSION_ACTIONS, getPermissionActionLabel } from "@/features/user-management/roleLabels";
import { PERMISSION_SCOPE_ROWS } from "../UserOnboardingStepAccessRights.helpers";

export type ActivePermissionSelection = {
  categoryKey: PermissionCategory;
  itemKey: string;
  action: PermissionAction;
};

const getPermissionActionTheme = (action: PermissionAction) => {
  if (action === "manager") {
    return {
      Icon: ShieldCheck,
      active: "border-violet-300 bg-violet-50 text-violet-700",
      idle: "border-slate-200 bg-white text-transparent hover:border-violet-200 hover:bg-violet-50",
    };
  }

  if (action === "user") {
    return {
      Icon: Pencil,
      active: "border-amber-300 bg-amber-50 text-amber-700",
      idle: "border-slate-200 bg-white text-transparent hover:border-amber-200 hover:bg-amber-50",
    };
  }

  return {
    Icon: Eye,
    active: "border-slate-300 bg-slate-50 text-slate-700",
    idle: "border-slate-200 bg-white text-transparent hover:border-slate-300 hover:bg-slate-50",
  };
};

type PermissionRowProps = {
  category: string;
  itemKey: string;
  label: string;
  checked: PermissionBucket;
  variant: "primary" | "secondary";
  selectedChoice?: ActivePermissionSelection | null;
  occupiedChoice?: ActivePermissionSelection | null;
  hasPrimarySelection?: boolean;
  scopeByAction?: Partial<Record<PermissionAction, SystemAccessScope>>;
  showScopePicker?: boolean;
  scopeExpanded?: boolean;
  onToggle: (category: string, itemKey: string, action: PermissionAction) => void;
  onScopeChange?: (category: string, itemKey: string, action: PermissionAction, scope: SystemAccessScope) => void;
  onToggleScopeExpanded?: (category: string, itemKey: string) => void;
};

export function PermissionRow({
  category,
  itemKey,
  label,
  checked,
  variant,
  selectedChoice,
  occupiedChoice,
  hasPrimarySelection = true,
  scopeByAction = {},
  showScopePicker = false,
  scopeExpanded = false,
  onToggle,
  onScopeChange,
  onToggleScopeExpanded,
}: PermissionRowProps) {
  const selectedByAction: Record<PermissionAction, boolean> = {
    manager: Boolean(
      selectedChoice?.categoryKey === category &&
      String(selectedChoice.itemKey) === String(itemKey) &&
      selectedChoice.action === "manager",
    ) || checked.manager,
    user: Boolean(
      selectedChoice?.categoryKey === category &&
      String(selectedChoice.itemKey) === String(itemKey) &&
      selectedChoice.action === "user",
    ) || checked.user,
    viewer: Boolean(
      selectedChoice?.categoryKey === category &&
      String(selectedChoice.itemKey) === String(itemKey) &&
      selectedChoice.action === "viewer",
    ) || checked.viewer,
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="border-b border-slate-100 transition-colors hover:bg-slate-50/50 last:border-b-0">
        <div className="grid grid-cols-4 items-center px-4 py-2.5">
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                if (!showScopePicker) return;
                onToggleScopeExpanded?.(category, itemKey);
              }}
              className={cn(
                "inline-flex items-center gap-2 text-sm font-medium text-slate-700",
                showScopePicker ? "cursor-pointer" : "cursor-default",
              )}
            >
              {showScopePicker ? (
                <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", scopeExpanded ? "rotate-180" : "")} />
              ) : null}
              <span>{label}</span>
            </button>
          </div>
          {PERMISSION_ACTIONS.map((action) => (
            <div key={action} className="flex justify-center">
              {(() => {
                const isSelected =
                  selectedChoice?.categoryKey === category &&
                  String(selectedChoice.itemKey) === String(itemKey) &&
                  selectedChoice.action === action;
                const isOccupied =
                  occupiedChoice?.categoryKey === category &&
                  String(occupiedChoice.itemKey) === String(itemKey) &&
                  occupiedChoice.action === action;
                const isPrimaryDisabled = variant === "primary" && Boolean(selectedChoice) && !isSelected;
                const isSecondaryBlocked = variant === "secondary" && !hasPrimarySelection;
                const shouldDisable = isPrimaryDisabled || isOccupied || isSecondaryBlocked;
                const isFilled = checked[action] || isSelected;
                const theme = getPermissionActionTheme(action);
                const Icon = theme.Icon;

                const button = (
                  <button
                    type="button"
                    aria-pressed={isFilled || isOccupied}
                    aria-label={`${label} ${getPermissionActionLabel(action)}`}
                    disabled={shouldDisable}
                    onClick={() => onToggle(category, itemKey, action)}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-sm border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(53,83,233)]/20",
                      isFilled ? theme.active : theme.idle,
                      shouldDisable && !isFilled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 hover:border-slate-200 hover:bg-slate-100" : "",
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5 transition-transform duration-150", isFilled ? "scale-100" : "scale-95")} />
                  </button>
                );

                if (isOccupied) {
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex" aria-label={`${label} ${action} PRIMARY`}>
                          {button}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">PRIMARY</TooltipContent>
                    </Tooltip>
                  );
                }

                if (isSecondaryBlocked) {
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex" aria-label={`${label} ${action} disabled until primary is selected`}>
                          {button}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">Select one PRIMARY right first</TooltipContent>
                    </Tooltip>
                  );
                }

                return button;
              })()}
            </div>
          ))}
        </div>

        {showScopePicker && scopeExpanded ? (
          <div className="space-y-1 pb-2.5 pl-4 pr-4">
            {PERMISSION_SCOPE_ROWS.map((row) => (
              <div key={`${itemKey}-${row.value}`} className="grid grid-cols-4 items-center">
                <div className="inline-flex items-center justify-end gap-2 pr-4 text-[12px] font-bold uppercase tracking-[0.11em] text-slate-500">
                  <span className="text-slate-300">+</span>
                  <span>{row.label}</span>
                </div>
                {PERMISSION_ACTIONS.map((action) => {
                  const isEnabled = selectedByAction[action];
                  const isActive = isEnabled && (scopeByAction[action] ?? "NODE") === row.value;

                  return (
                    <div key={`${itemKey}-${row.value}-${action}`} className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isEnabled) return;
                          onScopeChange?.(category, itemKey, action, row.value);
                        }}
                        disabled={!isEnabled}
                        aria-label={`${label} ${action} ${row.label}`}
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                          isActive ? "border-[rgb(79,70,229)]" : "border-slate-300",
                          !isEnabled ? "cursor-not-allowed opacity-50" : "hover:border-[rgb(79,70,229)]/60",
                        )}
                      >
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            isActive ? "bg-[rgb(79,70,229)]" : "bg-transparent",
                          )}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
