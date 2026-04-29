import type { GroupCompany } from "@/contexts/AppContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      </div>

      {groupSelectionMode === "new" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Group Name</Label>
            <Input
              value={groupName}
              onChange={(event) => onGroupNameChange(event.target.value)}
              className="capitalize"
            />
            {errors.groupName ? <p className="text-sm text-destructive">{errors.groupName}</p> : null}
          </div>
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(event) => onRemarksChange(event.target.value)} placeholder="Enter remarks" />
          </div>
        </div>
      ) : null}

      {groupSelectionMode === "existing" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Group</Label>
            <Select value={selectedGroupId} onValueChange={onGroupSelection}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a group" />
              </SelectTrigger>
              <SelectContent>
                {selectableGroups.map((group) => (
                  <SelectItem
                    key={group.id}
                    value={group.id}
                    textValue={`${group.groupName}${group.code ? ` ${group.code}` : ""}`}
                    className="py-2.5 pr-3"
                  >
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="min-w-0 truncate text-[15px] font-medium text-slate-900">{group.groupName}</span>
                      {group.code ? (
                        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium leading-none tracking-[0.02em] text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                          {group.code}
                        </span>
                      ) : null}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedGroupData ? (
            <p className="text-sm text-muted-foreground">A new company will be onboarded under the selected group.</p>
          ) : null}

          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(event) => onRemarksChange(event.target.value)} placeholder="Enter remarks" />
          </div>
        </div>
      ) : null}

      {groupSelectionMode === "not_applicable" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Group Name</Label>
            <Input value="Independent" disabled />
          </div>
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(event) => onRemarksChange(event.target.value)} placeholder="Enter remarks" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CompanyOnboardingStepGroupCompany;
