import { useMemo, useState } from "react";
import type { GroupCompany } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { GroupSelectionMode } from "./types";

type StepGroupCompanyProps = {
  groups: GroupCompany[];
  errors: Record<string, string>;
  groupSelectionMode: GroupSelectionMode;
  selectedGroupId: string;
  selectedGroupData?: GroupCompany;
  groupName: string;
  remarks: string;
  onGroupModeChange: (value: GroupSelectionMode) => void;
  onGroupSelection: (value: string) => void;
  onGroupNameChange: (value: string) => void;
  onRemarksChange: (value: string) => void;
};

export function CompanyOnboardingStepGroupCompany({
  groups,
  errors,
  groupSelectionMode,
  selectedGroupId,
  selectedGroupData,
  groupName,
  remarks,
  onGroupModeChange,
  onGroupSelection,
  onGroupNameChange,
  onRemarksChange,
}: StepGroupCompanyProps) {
  const selectableGroups = groups.filter((group) => group.groupName.trim().toLowerCase() !== "independent");
  const activeGroupSelectionMode = groupSelectionMode || "new";
  const [isGroupSearchOpen, setIsGroupSearchOpen] = useState(false);
  const selectedGroup = useMemo(
    () => selectableGroups.find((group) => group.id === selectedGroupId) ?? null,
    [selectableGroups, selectedGroupId],
  );

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-2">
        <Label>Group Option</Label>
        <Select value={groupSelectionMode} onValueChange={onGroupModeChange}>
          <SelectTrigger className="w-full sm:max-w-xs">
            <SelectValue placeholder="Select group option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New Group</SelectItem>
            <SelectItem value="existing">Existing Group</SelectItem>
            <SelectItem value="not_applicable">Independent</SelectItem>
          </SelectContent>
        </Select>
        {errors.groupSelectionMode ? <p className="text-sm text-destructive">{errors.groupSelectionMode}</p> : null}
      </div>

      {activeGroupSelectionMode === "new" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Group Name</Label>
            <Input
              value={groupName}
              onChange={(event) => onGroupNameChange(event.target.value)}
              className="capitalize"
              placeholder="e.g. xyz group"
            />

            {errors.groupName ? <p className="text-sm text-destructive">{errors.groupName}</p> : null}
          </div>
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(event) => onRemarksChange(event.target.value)}
              placeholder="Optional: add context for the new group"
              rows={4}
              className="min-h-[96px]"
            />
          </div>
        </div>
      ) : null}

      {activeGroupSelectionMode === "existing" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Group</Label>
            <Popover open={isGroupSearchOpen} onOpenChange={setIsGroupSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full justify-between rounded-md border-input bg-background px-3 py-2 text-left font-normal text-slate-900 shadow-none hover:bg-background hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className={cn("min-w-0 truncate", selectedGroup ? "text-slate-900" : "text-muted-foreground")}>
                    {selectedGroup ? (
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="min-w-0 truncate text-[15px] font-medium">{selectedGroup.groupName}</span>
                        {selectedGroup.code ? (
                          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium leading-none tracking-[0.02em] text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                            {selectedGroup.code}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      "Search or select group..."
                    )}
                  </span>
                  <ChevronDown className="ml-3 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search or select group..."
                    className="h-11 text-sm"
                  />
                  <CommandList className="max-h-72">
                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No results found</CommandEmpty>
                    {selectableGroups.map((group) => {
                      const isSelected = group.id === selectedGroupId;

                      return (
                        <CommandItem
                          key={group.id}
                          value={`${group.groupName} ${group.code ?? ""}`.trim()}
                          onSelect={() => {
                            onGroupSelection(group.id);
                            setIsGroupSearchOpen(false);
                          }}
                          className="mx-1 my-0.5 rounded-md px-2.5 py-2"
                        >
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="min-w-0 truncate text-[15px] font-medium text-slate-900">{group.groupName}</span>
                            <div className="flex shrink-0 items-center gap-2">
                              {group.code ? (
                                <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium leading-none tracking-[0.02em] text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                  {group.code}
                                </span>
                              ) : null}
                              <Check className={cn("h-4 w-4 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedGroupData ? (
            <p className="text-sm text-muted-foreground">A new company will be onboarded under the selected group.</p>
          ) : null}

          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(event) => onRemarksChange(event.target.value)}
              placeholder="Optional: add context for onboarding under this group"
              rows={4}
              className="min-h-[96px]"
            />
          </div>
        </div>
      ) : null}

      {activeGroupSelectionMode === "not_applicable" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Group Name</Label>
            <Input value="Independent" disabled />
          </div>
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(event) => onRemarksChange(event.target.value)}
              placeholder="Optional: add context for independent onboarding"
              rows={4}
              className="min-h-[96px]"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CompanyOnboardingStepGroupCompany;
