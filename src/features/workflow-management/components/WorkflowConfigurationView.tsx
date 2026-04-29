import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Plus,
  Trash2,
} from "lucide-react";
import { useAppContext, type OrgNode } from "@/contexts/AppContext";
import { APPROVAL_OPTIONS } from "@/features/workflow-management/constants";
import { getCompanyOrgStructure } from "@/services/org.service";
import { getCompanyRoles } from "@/services/role.service";

type ApprovalEntry = {
  option: string;
};

type WorkflowLevel = {
  id: number;
  type: "AND" | "OR";
  approvals: ApprovalEntry[];
};

export default function WorkflowConfigurationView() {
  const { currentUser } = useAppContext();
  const [wfName, setWfName] = useState("");
  const [wfAlias, setWfAlias] = useState("");
  const [wfModule, setWfModule] = useState("PO");
  const [wfNode, setWfNode] = useState("all");
  const [moduleOptions, setModuleOptions] = useState<Array<{ value: string; label: string }>>([
    { value: "PO", label: "Purchase Order (PO)" },
  ]);
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ value: string; label: string }>>([
    { value: "all", label: "Entire Organization" },
  ]);

  const [levels, setLevels] = useState<WorkflowLevel[]>([
    { id: 1, type: "AND", approvals: [{ option: "reporting_manager" }] },
  ]);
  const [dropTargetLevelId, setDropTargetLevelId] = useState<number | null>(null);
  const [showMetaErrors, setShowMetaErrors] = useState(false);
  const [openApprovalMenu, setOpenApprovalMenu] = useState<{ levelIdx: number; approvalIdx: number } | null>(null);
  const [pendingScrollLevelId, setPendingScrollLevelId] = useState<number | null>(null);
  const [openMetaMenu, setOpenMetaMenu] = useState<"module" | "department" | null>(null);
  const levelRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const metaMenuRef = useRef<HTMLDivElement | null>(null);
  const isWorkflowMetaComplete =
    [wfName, wfAlias, wfModule, wfNode].every((value) => Boolean(String(value).trim()));

  const ensureWorkflowMetaComplete = () => {
    setShowMetaErrors(true);
    return isWorkflowMetaComplete;
  };

  const isRMUsedGlobally = useMemo(() => {
    return levels.some((l) => l.approvals.some((a) => a.option === "reporting_manager"));
  }, [levels]);

  const addLevelAfter = (levelId: number) => {
    if (!ensureWorkflowMetaComplete()) return;
    const insertAt = levels.findIndex((item) => item.id === levelId);
    if (insertAt === -1 || levels.length >= 5) return;
    const nextLevelId = insertAt + 2;

    setLevels((current) => {
      if (current.length >= 5) return current;
      const currentInsertAt = current.findIndex((item) => item.id === levelId);
      if (currentInsertAt === -1) return current;

      const next = [...current];
      next.splice(currentInsertAt + 1, 0, { id: 0, type: "AND", approvals: [{ option: "" }] });
      return next.map((level, index) => ({ ...level, id: index + 1 }));
    });
    setPendingScrollLevelId(nextLevelId);
  };

  const addNextLevel = () => {
    if (!ensureWorkflowMetaComplete()) return;
    if (levels.length === 0) return;
    addLevelAfter(levels[levels.length - 1].id);
  };

  const canAddNextFromLevel = (level: WorkflowLevel) => level.approvals.every((approval) => Boolean(approval.option));

  const removeLevelById = (levelId: number) => {
    setLevels((current) => {
      const removeAt = current.findIndex((item) => item.id === levelId);
      if (removeAt <= 0 || removeAt >= current.length) return current;

      const next = current.slice();
      next.splice(removeAt, 1);
      return next.map((level, index) => ({ ...level, id: index + 1 }));
    });

    setOpenApprovalMenu(null);
    setDropTargetLevelId(null);
  };

  useEffect(() => {
    if (!pendingScrollLevelId) return;
    const target = levelRefs.current[pendingScrollLevelId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setPendingScrollLevelId(null);
  }, [pendingScrollLevelId, levels.length]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!metaMenuRef.current) return;
      if (metaMenuRef.current.contains(event.target as Node)) return;
      setOpenMetaMenu(null);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const startAddLevelDrag = (event: React.DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData("workflow-action", "add-level");
    event.dataTransfer.effectAllowed = "copy";
  };

  const addApprovalWithLogic = (lIdx: number, type: "AND" | "OR") => {
    if (!ensureWorkflowMetaComplete()) return;
    setLevels((current) => {
      const nextLevels = [...current];
      if (nextLevels[lIdx].approvals.length >= 2) return current;

      nextLevels[lIdx].type = type;
      const currentIds = nextLevels[lIdx].approvals.map((a) => a.option);
      const nextOption =
        APPROVAL_OPTIONS.find((opt) => {
          if (opt.id === "reporting_manager") return !isRMUsedGlobally;
          return !currentIds.includes(opt.id);
        })?.id ?? "";

      nextLevels[lIdx].approvals.push({ option: nextOption });
      return nextLevels;
    });
  };

  const updateApproval = (lIdx: number, aIdx: number, val: string) => {
    if (!ensureWorkflowMetaComplete()) return;
    setLevels((current) => {
      const nextLevels = [...current];
      nextLevels[lIdx].approvals[aIdx].option = val;
      return nextLevels;
    });
  };

  const removeApproval = (lIdx: number, aIdx: number) => {
    setLevels((current) => {
      const nextLevels = [...current];
      if (nextLevels[lIdx].approvals.length > 1) {
        nextLevels[lIdx].approvals.splice(aIdx, 1);
      }
      return nextLevels;
    });
  };

  const getApprovalOptionState = (optionId: string, appOption: string, level: WorkflowLevel) => {
    const usedGlobal = isRMUsedGlobally && optionId === "reporting_manager" && appOption !== "reporting_manager";
    const usedLevel = level.approvals.some((a) => a.option === optionId) && appOption !== optionId;
    return {
      hidden: (optionId === "reporting_manager" && usedGlobal) || (optionId !== "reporting_manager" && usedLevel),
      disabled: false,
    };
  };

  const formatTokenLabel = (value: string) =>
    value
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");

  useEffect(() => {
    const companyCode = currentUser?.companyCode?.trim().toUpperCase();
    if (!companyCode) return;

    let ignore = false;

    const collectNodeNames = (node: OrgNode | null): string[] => {
      if (!node) return [];
      const names: string[] = [];
      const walk = (current: OrgNode) => {
        const normalized = current.name.trim();
        if (normalized && current.nodeType.toUpperCase() !== "ROOT") {
          names.push(normalized);
        }
        current.children.forEach(walk);
      };
      walk(node);
      return names;
    };

    async function loadWorkflowDependencies() {
      try {
        const [roles, orgTree] = await Promise.all([
          getCompanyRoles(companyCode),
          getCompanyOrgStructure(companyCode),
        ]);
        if (ignore) return;

        const nextModules = Array.from(
          new Map(
            roles
              .filter((role) => role.subCategory)
              .map((role) => {
                const key = role.subCategory.toUpperCase();
                return [key, { value: key, label: formatTokenLabel(key) }] as const;
              }),
          ).values(),
        );

        if (nextModules.length > 0) {
          setModuleOptions(nextModules);
          setWfModule((current) =>
            nextModules.some((option) => option.value === current) ? current : nextModules[0].value,
          );
        }

        const nodeNames = collectNodeNames(orgTree);
        const uniqueNodeNames = Array.from(new Set(nodeNames));
        const nextDepartments = [
          { value: "all", label: "Entire Organization" },
          ...uniqueNodeNames.map((name) => ({
            value: name.toLowerCase().replace(/\s+/g, "_"),
            label: name,
          })),
        ];

        setDepartmentOptions(nextDepartments);
        setWfNode((current) =>
          nextDepartments.some((option) => option.value === current) ? current : nextDepartments[0].value,
        );
      } catch {
        if (ignore) return;
      }
    }

    void loadWorkflowDependencies();
    return () => {
      ignore = true;
    };
  }, [currentUser?.companyCode]);

  return (
    <div className="space-y-4 text-slate-900">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2" ref={metaMenuRef}>
            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Workflow Name</label>
              <input
                type="text"
                placeholder="e.g. Standard PO"
                className="h-10 w-full rounded-lg border border-slate-100 bg-slate-50 px-4 text-sm font-medium outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                value={wfName}
                onChange={(e) => setWfName(e.target.value)}
              />
              {showMetaErrors && !wfName.trim() ? (
                <p className="text-sm font-medium text-red-500">Required</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Alias</label>
              <input
                type="text"
                placeholder="e.g. PO_APPROVAL_V1"
                className="h-10 w-full rounded-lg border border-slate-100 bg-slate-50 px-4 text-sm font-medium outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                value={wfAlias}
                onChange={(e) => setWfAlias(e.target.value)}
              />
              {showMetaErrors && !wfAlias.trim() ? (
                <p className="text-sm font-medium text-red-500">Required</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Module</label>
              <div className="relative">
                <button
                  type="button"
                  className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 text-left text-sm font-medium text-slate-800 outline-none transition-all hover:border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500"
                  onClick={() => setOpenMetaMenu((current) => (current === "module" ? null : "module"))}
                >
                  <span>{moduleOptions.find((option) => option.value === wfModule)?.label ?? "Select module"}</span>
                  <ChevronDown
                    className={`text-slate-300 transition-transform ${openMetaMenu === "module" ? "rotate-180" : ""}`}
                    size={16}
                  />
                </button>
                {openMetaMenu === "module" ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.14)]">
                    <div className="max-h-56 overflow-auto p-1.5">
                      {moduleOptions.map((option) => {
                        const isSelected = option.value === wfModule;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setWfModule(option.value);
                              setOpenMetaMenu(null);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left ${
                              isSelected ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span className="truncate text-sm font-medium">{option.label}</span>
                            {isSelected ? <span className="text-[10px] font-semibold uppercase tracking-wide">Selected</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
              {showMetaErrors && !wfModule.trim() ? (
                <p className="text-sm font-medium text-red-500">Required</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Department</label>
              <div className="relative">
                <button
                  type="button"
                  className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 text-left text-sm font-medium text-slate-800 outline-none transition-all hover:border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500"
                  onClick={() => setOpenMetaMenu((current) => (current === "department" ? null : "department"))}
                >
                  <span>{departmentOptions.find((option) => option.value === wfNode)?.label ?? "Select department"}</span>
                  <ChevronDown
                    className={`text-slate-300 transition-transform ${openMetaMenu === "department" ? "rotate-180" : ""}`}
                    size={16}
                  />
                </button>
                {openMetaMenu === "department" ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.14)]">
                    <div className="max-h-56 overflow-auto p-1.5">
                      {departmentOptions.map((option) => {
                        const isSelected = option.value === wfNode;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setWfNode(option.value);
                              setOpenMetaMenu(null);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left ${
                              isSelected ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span className="truncate text-sm font-medium">{option.label}</span>
                            {isSelected ? <span className="text-[10px] font-semibold uppercase tracking-wide">Selected</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
              {showMetaErrors && !wfNode.trim() ? (
                <p className="text-sm font-medium text-red-500">Required</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-8">
          <div className="border-b pb-4" />

            <div className="relative space-y-10 pl-10 md:pl-16">
              <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-200 md:left-[34px]" />

              {levels.map((level, lIdx) => (
                <div
                  key={level.id}
                  className="relative"
                  ref={(el) => {
                    levelRefs.current[level.id] = el;
                  }}
                >
                  <div
                    className="absolute -left-10 top-0 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-[11px] font-bold text-blue-600 shadow-sm md:-left-16 md:h-10 md:w-10 md:text-xs"
                  >
                    {`L${lIdx + 1}`}
                  </div>
                  <div
                    className={`rounded-2xl border bg-slate-50/50 p-5 transition-none ${
                      dropTargetLevelId === level.id ? "border-blue-300" : "border-slate-100"
                    }`}
                    onDragOver={(e) => {
                      if (levels.length >= 5) return;
                      e.preventDefault();
                      setDropTargetLevelId(level.id);
                    }}
                    onDragLeave={() => setDropTargetLevelId((current) => (current === level.id ? null : current))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const dragType = e.dataTransfer.getData("workflow-action");
                      if (dragType === "add-level") addLevelAfter(level.id);
                      setDropTargetLevelId(null);
                    }}
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-tight text-slate-400">Stage {lIdx + 1} Configuration</span>
                      <div className="flex items-center gap-2">
                        {level.approvals.length > 1 ? (
                          <div className={`rounded px-2 py-0.5 text-[9px] font-black text-white ${level.type === "AND" ? "bg-blue-600" : "bg-amber-500"}`}>
                            {level.type} LOGIC
                          </div>
                        ) : null}
                        {lIdx > 0 && lIdx === levels.length - 1 ? (
                          <button
                            type="button"
                            onClick={() => removeLevelById(level.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-500 hover:bg-red-50"
                            title={`Delete L${lIdx + 1}`}
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {level.approvals.map((app, aIdx) => {
                        return (
                          <div key={`${level.id}-${aIdx}`}>
                            {aIdx > 0 ? <div className="py-1 text-center text-[9px] font-black uppercase text-slate-300">{level.type}</div> : null}

                            <div className="relative flex flex-col items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm md:flex-row">
                              <div className="w-full flex-1 space-y-1">
                                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Approval Category</label>
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      ensureWorkflowMetaComplete() &&
                                      setOpenApprovalMenu(
                                        openApprovalMenu?.levelIdx === lIdx && openApprovalMenu?.approvalIdx === aIdx
                                          ? null
                                          : { levelIdx: lIdx, approvalIdx: aIdx }
                                      )
                                    }
                                    className="flex h-11 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-left shadow-sm outline-none hover:border-slate-300"
                                  >
                                    <span className={`text-sm font-semibold ${app.option ? "text-slate-800" : "text-slate-400"}`}>
                                      {APPROVAL_OPTIONS.find((opt) => opt.id === app.option)?.label ?? "Select Category"}
                                    </span>
                                    <ChevronDown
                                      className={`text-slate-300 ${
                                        openApprovalMenu?.levelIdx === lIdx && openApprovalMenu?.approvalIdx === aIdx ? "rotate-180" : ""
                                      }`}
                                      size={14}
                                    />
                                  </button>
                                  {openApprovalMenu?.levelIdx === lIdx && openApprovalMenu?.approvalIdx === aIdx ? (
                                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.10)]">
                                      <div className="max-h-56 overflow-auto p-1.5">
                                        {APPROVAL_OPTIONS.map((opt) => {
                                          const optionState = getApprovalOptionState(opt.id, app.option, level);
                                          if (optionState.hidden) return null;

                                          const isSelected = app.option === opt.id;
                                          return (
                                            <button
                                              key={opt.id}
                                              type="button"
                                              onClick={() => {
                                                updateApproval(lIdx, aIdx, opt.id);
                                                setOpenApprovalMenu(null);
                                              }}
                                              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left ${
                                                isSelected
                                                  ? "bg-blue-50 text-blue-700"
                                                  : "text-slate-700 hover:bg-slate-50"
                                              }`}
                                            >
                                              <div className="flex items-center gap-3">
                                                <span
                                                  className={`h-2 w-2 rounded-full ${
                                                    isSelected ? "bg-blue-600" : "bg-slate-300"
                                                  }`}
                                                />
                                                <span className="text-sm font-medium">{opt.label}</span>
                                              </div>
                                              {isSelected ? <span className="text-[10px] font-semibold text-blue-600">Selected</span> : null}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              {level.approvals.length > 1 ? (
                                <button onClick={() => removeApproval(lIdx, aIdx)} className="rounded-lg p-2 text-red-300 hover:bg-red-50 hover:text-red-500">
                                  <Trash2 size={16} />
                                </button>
                              ) : null}
                            </div>

                    {aIdx === level.approvals.length - 1 && level.approvals.length < 2 ? (
                              <div className="flex justify-center pt-4">
                                <div className="flex gap-3">
                                  <button onClick={() => addApprovalWithLogic(lIdx, "AND")} className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-1 text-[10px] font-bold text-blue-600 shadow-sm hover:bg-blue-600 hover:text-white">
                                    + AND
                                  </button>
                                  <button onClick={() => addApprovalWithLogic(lIdx, "OR")} className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-1 text-[10px] font-bold text-amber-600 shadow-sm hover:bg-amber-500 hover:text-white">
                                    + OR
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                  </div>

                </div>
              ))}

              <div className="relative h-12 md:h-14">
                <button
                  type="button"
                  onClick={addNextLevel}
                  draggable
                  onDragStart={startAddLevelDrag}
                  onDragEnd={() => setDropTargetLevelId(null)}
                  disabled={levels.length >= 5 || !canAddNextFromLevel(levels[levels.length - 1])}
                  className="absolute -left-10 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600 shadow-sm disabled:border-slate-300 disabled:bg-white disabled:text-slate-300 disabled:opacity-100 md:-left-16 md:h-10 md:w-10"
                  title="Add level"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
              <div />
              <button className="w-full rounded-xl bg-blue-600 px-10 py-2.5 text-sm font-bold tracking-tight text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 sm:w-auto">
                Publish Workflow
              </button>
            </div>
          </div>
        </div>
    </div>
  );
}
