import type { HTMLAttributes, ReactNode } from "react";
import { Briefcase, IdCard, Mail, Phone, User, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserOnboardingFormData, ValidationErrors } from "@/features/user-management/types";

type StepBasicDetailsProps = {
  basic: UserOnboardingFormData["basic"];
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

export function UserOnboardingStepBasicDetails({
  basic,
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
          label="Corporate Email"
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
          <InputGroup
            label="Reporting Manager"
            icon={<Users size={18} />}
            value={basic.reportingManager}
            onChange={(value) => {
              onClearError("reportingManager");
              onBasicChange("reportingManager", value);
            }}
            placeholder="Select manager name"
            error={errors.reportingManager}
          />
        </div>
      </div>
    </div>
  );
}

export default UserOnboardingStepBasicDetails;
