import { useMemo, useState } from "react";
import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import WorkflowConfigurationView from "@/features/workflow-management/components/WorkflowConfigurationView";

type WorkflowStatus = "Active" | "Pending";

type WorkflowRecord = {
  id: string;
  name: string;
  alias: string;
  module: string;
  department: string;
  status: WorkflowStatus;
};

const mockWorkflows: WorkflowRecord[] = [
  {
    id: "wf-1",
    name: "Standard PO",
    alias: "WF_PO_STD",
    module: "Purchase Order (PO)",
    department: "Entire Organization",
    status: "Active",
  },
  {
    id: "wf-2",
    name: "Invoice Escalation",
    alias: "WF_INV_ESC",
    module: "Invoice Processing",
    department: "Finance",
    status: "Pending",
  },
];

const tabClassName =
  "rounded-full px-5 py-2 text-sm font-semibold transition-all data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm";

export default function WorkflowManagementView() {
  const [activeStatus, setActiveStatus] = useState<WorkflowStatus>("Active");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const workflows = useMemo(
    () => mockWorkflows.filter((workflow) => workflow.status === activeStatus),
    [activeStatus],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              data-active={activeStatus === "Active"}
              className={tabClassName}
              onClick={() => setActiveStatus("Active")}
            >
              Active
            </button>
            <button
              type="button"
              data-active={activeStatus === "Pending"}
              className={tabClassName}
              onClick={() => setActiveStatus("Pending")}
            >
              Pending
            </button>
          </div>

          <Button className="w-full lg:w-auto" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Workflow
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {workflows.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">No {activeStatus.toLowerCase()} workflows available.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {workflows.map((workflow) => (
              <div key={workflow.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-5 md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Workflow</p>
                  <p className="text-sm font-semibold text-slate-800">{workflow.name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Alias</p>
                  <p className="text-sm text-slate-700">{workflow.alias}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Module</p>
                  <p className="text-sm text-slate-700">{workflow.module}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Department</p>
                  <p className="text-sm text-slate-700">{workflow.department}</p>
                </div>
                <div className="md:justify-self-end">
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {workflow.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="flex h-[90vh] w-[min(94vw,72rem)] max-w-[72rem] flex-col gap-0 overflow-hidden rounded-lg p-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-600 p-1.5">
                <Settings className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900">Add Workflow</h2>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <WorkflowConfigurationView />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
