import { CheckCircle2 } from "lucide-react";
import type { WorkflowStep } from "./types";

type WorkflowStepperProps = {
  step: WorkflowStep;
};

const STEPS: Array<{ id: WorkflowStep; label: string }> = [
  { id: 1, label: "Inputs" },
  { id: 2, label: "Levels" },
  { id: 3, label: "Summary" },
];

function StepNode({ active, done, id, label }: { active: boolean; done: boolean; id: number; label: string }) {
  return (
    <div className="inline-flex shrink-0 items-center gap-3 whitespace-nowrap">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
          active
            ? "bg-blue-600 text-white shadow-md shadow-blue-200"
            : done
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-400"
        }`}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : id}
      </div>
      <div className="min-w-0">
        <div
          className={`truncate text-sm font-semibold transition-colors ${
            active ? "text-blue-600" : done ? "text-emerald-600" : "text-slate-500"
          }`}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

export default function WorkflowStepper({ step }: WorkflowStepperProps) {
  return (
    <div className="mb-4 grid w-full grid-cols-[auto_minmax(24px,1fr)_auto_minmax(24px,1fr)_auto] items-center gap-x-4 overflow-x-auto pb-1">
      <StepNode id={STEPS[0].id} active={step === STEPS[0].id} done={step > STEPS[0].id} label={STEPS[0].label} />
      <div className={`h-px w-full ${step > STEPS[0].id ? "bg-blue-500" : "bg-slate-200"}`} />
      <StepNode id={STEPS[1].id} active={step === STEPS[1].id} done={step > STEPS[1].id} label={STEPS[1].label} />
      <div className={`h-px w-full ${step > STEPS[1].id ? "bg-blue-500" : "bg-slate-200"}`} />
      <StepNode id={STEPS[2].id} active={step === STEPS[2].id} done={step > STEPS[2].id} label={STEPS[2].label} />
    </div>
  );
}
