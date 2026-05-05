import { useMemo, useState, type HTMLAttributes, type ReactNode } from "react";
import { Briefcase, Check, ChevronDown, IdCard, Mail, Phone, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { UserOnboardingFormData, ValidationErrors } from "@/features/user-management/types";

type ReportingManagerOption = {
  id: string;
  name: string;
  email: string;
  designation?: string;
};

type StepBasicDetailsProps = {
  basic: UserOnboardingFormData["basic"];
  reportingManagerOptions: ReportingManagerOption[];
  errors: ValidationErrors;
  onBasicChange: <K extends keyof UserOnboardingFormData["basic"]>(
    field: K,
    value: UserOnboardingFormData["basic"][K],
  ) => void;
  onClearError: (key: string) => void;
};

function InputGroup({
  label,
  icon,
  value,
  onChange,
  type = "text",
  placeholder,
  max,
  maxLength,
  inputMode,
  error,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  max?: string;
  maxLength?: number;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  error?: string;
}) {
  return (
    <div className="group space-y-1">
      <Label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-primary">{label}</Label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary">
          {icon}
        </div>
        <Input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          max={max}
          maxLength={maxLength}
          inputMode={inputMode}
          className="h-11 w-full border-slate-200 bg-white pl-12 pr-4 placeholder:text-slate-300 focus:border-primary focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder={placeholder}
        />
      </div>
  {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function ReportingManagerField({
  options,
  currentValue,
  error,
  onSelect,
}: {
  options: ReportingManagerOption[];
  currentValue: string;
  error?: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentValueNormalized = currentValue.trim().toLowerCase();
  const selectedOption = useMemo(
    () => options.find((option) => option.email.toLowerCase() === currentValueNormalized) ?? null,
    [options, currentValueNormalized],
  );
  const displayValue = selectedOption?.email || currentValue || "";

  return (
    <div className="group space-y-1">
      <Label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-primary">
        Reporting Manager
      </Label>
      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-between border-slate-200 bg-white pl-12 pr-3 font-normal text-slate-900 hover:bg-white"
            >
              <span className={cn("truncate text-left", displayValue ? "text-slate-900" : "text-slate-400")}>
                {displayValue || "Search and select reporting manager"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
            <Command>
              <CommandInput placeholder="Search manager by name or email..." className="h-11 text-sm" />
              <CommandList className="max-h-72">
                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No active users found</CommandEmpty>
                {options.map((option) => {
                  const isSelected = option.email.toLowerCase() === currentValueNormalized;
                  return (
                    <CommandItem
                      key={option.id}
                      value={`${option.name} ${option.email} ${option.designation ?? ""}`.trim()}
                      onSelect={() => {
                        onSelect(option.email);
                        setOpen(false);
                      }}
                      className="mx-1 my-0.5 rounded-md px-2.5 py-2"
                    >
                      <div className="flex w-full items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-medium text-slate-900">{option.name || option.email}</div>
                          <div className="truncate text-xs text-slate-500">{option.email}</div>
                        </div>
                        <Check className={cn("h-4 w-4 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary">
          <Users size={18} />
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function UserOnboardingStepBasicDetails({
  basic,
  reportingManagerOptions,
  errors,
  onBasicChange,
  onClearError,
}: StepBasicDetailsProps) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InputGroup
          label="Full Name"
          icon={<User size={18} />}
          value={basic.name}
          onChange={(value) => {
            onClearError("name");
            onBasicChange("name", value);
          }}
          placeholder="John Doe"
          error={errors.name}
        />
        <InputGroup
          label="Email"
          icon={<Mail size={18} />}
          value={basic.email}
          onChange={(value) => {
            onClearError("email");
            onBasicChange("email", value);
          }}
          type="email"
          placeholder="john.d@company.com"
          error={errors.email}
        />
        <InputGroup
          label="Phone Number"
          icon={<Phone size={18} />}
          value={basic.phone}
          onChange={(value) => {
            const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
            onClearError("phone");
            onBasicChange("phone", digitsOnly);
          }}
          placeholder="0000000000"
          inputMode="numeric"
          maxLength={10}
          error={errors.phone}
        />
        <InputGroup
          label="Designation"
          icon={<Briefcase size={18} />}
          value={basic.designation}
          onChange={(value) => {
            onClearError("designation");
            onBasicChange("designation", value);
          }}
          placeholder="Senior Analyst"
          error={errors.designation}
        />
        <InputGroup
          label="Employee ID"
          icon={<IdCard size={18} />}
          value={basic.employeeId}
          onChange={(value) => {
            onClearError("employeeId");
            onBasicChange("employeeId", value);
          }}
          placeholder="EMP-10294"
          error={errors.employeeId}
        />
        <div className="md:col-span-2">
          <ReportingManagerField
            options={reportingManagerOptions}
            currentValue={basic.reportingManager}
            onSelect={(value) => {
              onClearError("reportingManager");
              onBasicChange("reportingManager", value);
            }}
            error={errors.reportingManager}
          />
        </div>
      </div>
    </div>
  );
}

export default UserOnboardingStepBasicDetails;
