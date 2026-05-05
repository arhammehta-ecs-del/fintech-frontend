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

function NavPill({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 transition-all ${
        active ? "border border-blue-100 bg-blue-50 text-blue-600 shadow-sm" : done ? "text-emerald-600" : "text-slate-400"
      }`}
    >
      <div
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold ${
          active ? "bg-blue-600 text-white" : done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"
        }`}
      >
        {done ? <CheckCircle2 className="h-3 w-3" /> : active ? "•" : ""}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest leading-none">{label}</span>
    </div>
  );
}

export default function WorkflowStepper({ step }: WorkflowStepperProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {STEPS.map((item) => (
        <NavPill key={item.id} active={step === item.id} done={step > item.id} label={item.label} />
      ))}
    </div>
  );
}
