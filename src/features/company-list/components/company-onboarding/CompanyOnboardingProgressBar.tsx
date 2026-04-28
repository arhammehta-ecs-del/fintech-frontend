import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type WizardProgressBarProps = {
  steps: string[];
  currentStep: number;
};

export function CompanyOnboardingProgressBar({ steps, currentStep }: WizardProgressBarProps) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-[36rem] items-center gap-2 sm:min-w-0">
        {steps.map((label, index) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                index <= currentStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span className={cn("hidden text-xs font-medium sm:block", index <= currentStep ? "text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
            {index < steps.length - 1 ? <div className={cn("h-px flex-1", index < currentStep ? "bg-primary" : "bg-border")} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CompanyOnboardingProgressBar;
