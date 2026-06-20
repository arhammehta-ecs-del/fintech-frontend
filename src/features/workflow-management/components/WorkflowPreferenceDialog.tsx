import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBranchAppearance, getNodeAccentBorderLeft } from "@/features/org-structure/nodeTheme.utils";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/services/client";
import {
  fetchWorkflowUserPreferences,
  updateWorkflowPreference,
  type WorkflowPreferenceNode,
} from "@/services/workflow.service";

type WorkflowPreferenceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPreferencesSaved?: () => void;
};

type WorkflowPreferenceDialogNode = WorkflowPreferenceNode & { isPreview?: boolean };
type WorkflowPreferenceTreeNode = WorkflowPreferenceDialogNode & { children: WorkflowPreferenceTreeNode[] };
type WorkflowPreferenceFlowNode = {
  node: WorkflowPreferenceTreeNode;
  depth: number;
  branchIndex: number | null;
  branchDepth: number;
  isRoot: boolean;
};
type NodeSelectionMap = Record<string, Record<string, string>>;
const NO_WORKFLOW_VALUE = "__no_workflow__";
const WORKFLOW_PREFERENCE_PREVIEW_SUFFIXES = [
  { name: "Finance Preview", segment: "PREVIEW_FINANCE" },
  { name: "Surat Preview", segment: "SURAT_PREVIEW" },
  { name: "Operations Preview", segment: "OPS_PREVIEW" },
] as const;

const formatModuleLabel = (module: string) =>
  module
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildSelectionMap = (nodes: WorkflowPreferenceDialogNode[]): NodeSelectionMap =>
  nodes.reduce<NodeSelectionMap>((accumulator, node) => {
    accumulator[node.nodePath] = node.modules.reduce<Record<string, string>>((moduleAccumulator, moduleEntry) => {
      const selectedFromResponse = moduleEntry.selectedWorkflow?.levelsHash?.trim();
      const selectedFromOptions = moduleEntry.workflows.find((workflow) => workflow.selected)?.levelsHash?.trim();
      moduleAccumulator[moduleEntry.module] = selectedFromResponse || selectedFromOptions || "";
      return moduleAccumulator;
    }, {});
    return accumulator;
  }, {});

const hasPendingChanges = (draft: NodeSelectionMap, baseline: NodeSelectionMap) =>
  Object.entries(draft).some(([nodePath, modules]) =>
    Object.entries(modules).some(([moduleName, value]) => (baseline[nodePath]?.[moduleName] ?? "") !== value),
  );

const getWorkflowPreferenceNodeDepth = (nodePath: string) =>
  nodePath
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean).length;

const buildWorkflowPreferencePreviewNodes = (nodes: WorkflowPreferenceNode[]): WorkflowPreferenceDialogNode[] => {
  const baseNodes = nodes.map((node) => ({ ...node }));
  if (!import.meta.env.DEV || baseNodes.length === 0) return baseNodes;

  const rootNode =
    baseNodes.find((node) => node.nodeType.trim().toUpperCase() === "ROOT")
    ?? [...baseNodes].sort((left, right) => getWorkflowPreferenceNodeDepth(left.nodePath) - getWorkflowPreferenceNodeDepth(right.nodePath))[0];
  const rootPath = rootNode?.nodePath?.trim();
  if (!rootPath) return baseNodes;

  const previewModules = rootNode.modules.map((moduleEntry) => ({
    ...moduleEntry,
    workflows: moduleEntry.workflows.map((workflow) => ({ ...workflow, selected: false })),
    selectedWorkflow: null,
  }));

  const previewNodes: WorkflowPreferenceDialogNode[] = [];
  let currentPath = rootPath;
  for (const previewNode of WORKFLOW_PREFERENCE_PREVIEW_SUFFIXES) {
    currentPath = `${currentPath}.${previewNode.segment}`;
    if (baseNodes.some((node) => node.nodePath.trim().toUpperCase() === currentPath.toUpperCase())) continue;
    previewNodes.push({
      nodeName: previewNode.name,
      nodePath: currentPath,
      nodeType: "NODE",
      levelCount: getWorkflowPreferenceNodeDepth(currentPath),
      modules: previewModules.map((moduleEntry) => ({
        ...moduleEntry,
        workflows: moduleEntry.workflows.map((workflow) => ({ ...workflow })),
      })),
      isPreview: true,
    });
  }

  return [...baseNodes, ...previewNodes].sort((left, right) =>
    left.nodePath.localeCompare(right.nodePath, undefined, { numeric: true, sensitivity: "base" }),
  );
};

const getWorkflowPreferenceParentPath = (nodePath: string) => {
  const segments = nodePath.split(".").map((segment) => segment.trim()).filter(Boolean);
  return segments.length > 1 ? segments.slice(0, -1).join(".") : null;
};

const sortWorkflowPreferenceTree = (nodes: WorkflowPreferenceTreeNode[]) => {
  nodes.sort((left, right) => left.nodePath.localeCompare(right.nodePath, undefined, { numeric: true, sensitivity: "base" }));
  nodes.forEach((node) => sortWorkflowPreferenceTree(node.children));
};

const buildWorkflowPreferenceTree = (nodes: WorkflowPreferenceDialogNode[]): WorkflowPreferenceTreeNode[] => {
  const byPath = new Map<string, WorkflowPreferenceTreeNode>();
  nodes.forEach((node) => {
    byPath.set(node.nodePath, { ...node, children: [] });
  });

  const roots: WorkflowPreferenceTreeNode[] = [];
  byPath.forEach((node, nodePath) => {
    const parentPath = getWorkflowPreferenceParentPath(nodePath);
    const parent = parentPath ? byPath.get(parentPath) : null;
    if (parent) {
      parent.children.push(node);
      return;
    }
    roots.push(node);
  });

  sortWorkflowPreferenceTree(roots);
  return roots;
};

const flattenWorkflowPreferenceTree = (
  nodes: WorkflowPreferenceTreeNode[],
  collapsedNodePaths: string[] = [],
): WorkflowPreferenceFlowNode[] => {
  const items: WorkflowPreferenceFlowNode[] = [];
  const collapsedSet = new Set(collapsedNodePaths);

  const walk = (
    node: WorkflowPreferenceTreeNode,
    depth: number,
    branchIndex: number | null,
    branchDepth: number,
    isRoot: boolean,
  ) => {
    items.push({ node, depth, branchIndex, branchDepth, isRoot });
    if (collapsedSet.has(node.nodePath)) return;
    node.children.forEach((child, childIndex) => {
      walk(child, depth + 1, isRoot ? childIndex : branchIndex, isRoot ? 0 : branchDepth + 1, false);
    });
  };

  nodes.forEach((node) => walk(node, 0, null, 0, true));
  return items;
};

export default function WorkflowPreferenceDialog({ open, onOpenChange, onPreferencesSaved }: WorkflowPreferenceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [nodes, setNodes] = useState<WorkflowPreferenceDialogNode[]>([]);
  const [selectedNodePath, setSelectedNodePath] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [selectionDraft, setSelectionDraft] = useState<NodeSelectionMap>({});
  const [initialSelection, setInitialSelection] = useState<NodeSelectionMap>({});
  const [arrowPosition, setArrowPosition] = useState<{ left: number; top: number } | null>(null);
  const [collapsedNodePaths, setCollapsedNodePaths] = useState<string[]>([]);
  const panelsRef = useRef<HTMLDivElement | null>(null);
  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLDivElement | null>(null);
  const selectedNodeRef = useRef<HTMLButtonElement | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.nodePath === selectedNodePath) ?? nodes[0] ?? null,
    [nodes, selectedNodePath],
  );
  const companyNode = useMemo(
    () => nodes.find((node) => node.nodeType.trim().toUpperCase() === "ROOT") ?? nodes[0] ?? null,
    [nodes],
  );
  const workflowPreferenceTree = useMemo(() => buildWorkflowPreferenceTree(nodes), [nodes]);
  const workflowPreferenceFlowNodes = useMemo(
    () => flattenWorkflowPreferenceTree(workflowPreferenceTree, collapsedNodePaths),
    [collapsedNodePaths, workflowPreferenceTree],
  );
  const pendingChanges = useMemo(() => hasPendingChanges(selectionDraft, initialSelection), [initialSelection, selectionDraft]);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    const loadPreferences = async () => {
      setLoading(true);
      setLoadError("");
      setSubmitError("");
      setSaving(false);

      try {
        const response = await fetchWorkflowUserPreferences();
        if (!isMounted) return;
        const nextNodes = buildWorkflowPreferencePreviewNodes(response);
        const nextSelection = buildSelectionMap(nextNodes);
        setNodes(nextNodes);
        setCollapsedNodePaths([]);
        setInitialSelection(nextSelection);
        setSelectionDraft(nextSelection);
        setSelectedNodePath((current) => (nextNodes.some((node) => node.nodePath === current) ? current : (nextNodes[0]?.nodePath ?? "")));
      } catch (error) {
        if (!isMounted) return;
        setNodes([]);
        setCollapsedNodePaths([]);
        setInitialSelection({});
        setSelectionDraft({});
        setSelectedNodePath("");
        setLoadError(getApiErrorMessage(error, "Unable to load workflow preferences."));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadPreferences();
    return () => {
      isMounted = false;
    };
  }, [open]);

  const toggleNodeBranch = (nodePath: string) => {
    setCollapsedNodePaths((current) =>
      current.includes(nodePath) ? current.filter((path) => path !== nodePath) : [...current, nodePath],
    );
  };

  const updateArrowPosition = () => {
    const container = panelsRef.current;
    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;
    const selectedButton = selectedNodeRef.current;

    if (!open || !container || !leftPanel || !rightPanel || !selectedButton) {
      setArrowPosition(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const leftRect = leftPanel.getBoundingClientRect();
    const rightRect = rightPanel.getBoundingClientRect();
    const selectedRect = selectedButton.getBoundingClientRect();

    setArrowPosition({
      left: (leftRect.right + rightRect.left) / 2 - containerRect.left,
      top: selectedRect.top - containerRect.top + selectedRect.height / 2,
    });
  };

  useLayoutEffect(() => {
    updateArrowPosition();
    const frame = window.requestAnimationFrame(() => {
      updateArrowPosition();
      window.requestAnimationFrame(updateArrowPosition);
    });
    const timeout = window.setTimeout(updateArrowPosition, 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [open, selectedNodePath, nodes.length, collapsedNodePaths]);

  useEffect(() => {
    if (!open) return undefined;

    const handleReposition = () => updateArrowPosition();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleReposition) : null;
    const container = panelsRef.current;
    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;
    const selectedButton = selectedNodeRef.current;

    if (container) resizeObserver?.observe(container);
    if (leftPanel) resizeObserver?.observe(leftPanel);
    if (rightPanel) resizeObserver?.observe(rightPanel);
    if (selectedButton) resizeObserver?.observe(selectedButton);
    window.addEventListener("resize", handleReposition);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleReposition);
    };
  }, [open, selectedNodePath, collapsedNodePaths]);

  const handleSelectWorkflow = (nodePath: string, moduleName: string, levelsHash: string) => {
    if (saving) return;
    const nextValue = levelsHash === NO_WORKFLOW_VALUE ? "" : levelsHash;
    setSelectionDraft((current) => ({
      ...current,
      [nodePath]: {
        ...(current[nodePath] ?? {}),
        [moduleName]: nextValue,
      },
    }));
    setSubmitError("");
  };

  const handleCancelEdit = () => {
    setSelectionDraft(initialSelection);
    setSubmitError("");
  };

  const handleSubmit = async () => {
    if (saving) return;

    const changedEntries = nodes.flatMap((node) =>
      node.isPreview
        ? []
        : node.modules
            .map((moduleEntry) => ({
              module: moduleEntry.module,
              nodePath: node.nodePath,
              levelsHash: selectionDraft[node.nodePath]?.[moduleEntry.module] ?? "",
              initialLevelsHash: initialSelection[node.nodePath]?.[moduleEntry.module] ?? "",
            }))
            .filter((entry) => entry.levelsHash !== entry.initialLevelsHash),
    );

    if (changedEntries.length === 0) {
      return;
    }

    setSaving(true);
    setSubmitError("");

    try {
      await Promise.all(
        changedEntries.flatMap((entry) => {
          const requests = [];
          if (entry.initialLevelsHash) {
            requests.push(
              updateWorkflowPreference({
                module: entry.module,
                nodePath: entry.nodePath,
                levelsHash: entry.initialLevelsHash,
                type: "REMOVED",
              }),
            );
          }
          if (entry.levelsHash) {
            requests.push(
              updateWorkflowPreference({
                module: entry.module,
                nodePath: entry.nodePath,
                levelsHash: entry.levelsHash,
                type: "ADDED",
              }),
            );
          }
          return requests;
        }),
      );

      const nextBaseline = changedEntries.reduce<NodeSelectionMap>((accumulator, entry) => {
        accumulator[entry.nodePath] = {
          ...(accumulator[entry.nodePath] ?? {}),
          [entry.module]: entry.levelsHash,
        };
        return accumulator;
      }, { ...initialSelection });
      setInitialSelection(nextBaseline);
      setSelectionDraft(nextBaseline);
      onPreferencesSaved?.();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, "Unable to save workflow preferences."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        showCloseButton={false}
        className="flex max-h-[88vh] w-[min(96vw,1120px)] max-w-[1120px] flex-col gap-0 overflow-hidden rounded-3xl border border-[#d9e1ff] bg-white p-0 shadow-[0_28px_80px_rgba(29,78,216,0.18)]"
      >
        <DialogTitle className="sr-only">Set Workflow Preference</DialogTitle>
        <DialogDescription className="sr-only">
          Configure workflow preferences for each module on a selected organization node.
        </DialogDescription>

        <div className="flex items-center justify-between border-b border-[#dbe4ff] bg-white px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-[1.05rem] font-semibold text-slate-900">Set Workflow Preference</h2>
            <p className="mt-1 text-sm text-slate-500">Choose defaults here. Changes are saved only when you click Submit.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close workflow preference dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-b border-[#dbe4ff] bg-white px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b6f9c]">Company</p>
          <p className="mt-2 truncate text-sm font-medium text-slate-900">
            {companyNode?.nodeName || "-"}
            {companyNode?.nodePath ? ` (${companyNode.nodePath})` : ""}
          </p>
        </div>

        <div ref={panelsRef} className="relative grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-hidden bg-white p-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          {arrowPosition ? (
            <div
              className="pointer-events-none absolute z-10 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#dbe4ff] bg-white text-[#4f6fd9] shadow-[0_10px_30px_rgba(79,111,217,0.18)] lg:flex"
              style={{ left: `${arrowPosition.left}px`, top: `${arrowPosition.top}px` }}
            >
              <ArrowRight className="h-4 w-4" />
            </div>
          ) : null}

          <div ref={leftPanelRef} className="min-h-0 rounded-2xl border border-[#dbe4ff] bg-white p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-800">Organization Nodes</h3>
            </div>
            <div className="max-h-[54vh] space-y-3 overflow-auto pr-1">
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">Loading preferences...</div>
              ) : loadError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{loadError}</div>
              ) : nodes.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">No workflow preferences available.</div>
              ) : (
                workflowPreferenceFlowNodes.map((item) => {
                  const appearance = getBranchAppearance(item.branchIndex, item.branchDepth, item.isRoot);
                  const borderLeftClass = item.isRoot
                    ? "border-l-indigo-400"
                    : getNodeAccentBorderLeft(item.branchIndex, item.branchDepth, item.isRoot);
                  const isSelected = selectedNode?.nodePath === item.node.nodePath;
                  const hasChildren = item.node.children.length > 0;
                  const isCollapsed = collapsedNodePaths.includes(item.node.nodePath);
                  return (
                    <div key={item.node.nodePath} className="w-full" style={{ paddingLeft: `${item.depth * 20}px` }}>
                      <button
                        ref={isSelected ? selectedNodeRef : null}
                        type="button"
                        onClick={() => setSelectedNodePath(item.node.nodePath)}
                        className={cn(
                          "group relative w-full overflow-hidden rounded-2xl border bg-white px-4 py-4 text-left shadow-sm transition-all duration-200",
                          isSelected
                            ? item.isRoot
                              ? "border border-indigo-200 bg-indigo-50/70 text-slate-800 shadow-[0_10px_22px_rgba(99,102,241,0.16)] border-l-[4px] border-l-indigo-400"
                              : cn(
                                "border-[rgb(53,83,233)] shadow-[0_0_0_3px_rgba(53,83,233,0.08)] bg-[rgb(53,83,233,0.02)] border-l-[4px]",
                                borderLeftClass,
                              )
                            : cn(
                              item.isRoot
                                ? "border border-indigo-100 bg-indigo-50/35 text-slate-800 shadow-[0_6px_16px_rgba(99,102,241,0.1)]"
                                : appearance.defaultSurfaceClass,
                              appearance.hoverBorderClass,
                              "border-l-[4px]",
                              borderLeftClass,
                            ),
                        )}
                      >
                        <span
                          className={cn("absolute left-0 top-0 h-full w-[4px] rounded-r-full", item.isRoot ? "bg-indigo-400" : borderLeftClass)}
                          aria-hidden="true"
                        />
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {hasChildren ? (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleNodeBranch(item.node.nodePath);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      toggleNodeBranch(item.node.nodePath);
                                    }
                                  }}
                                  aria-label={isCollapsed ? `Expand ${item.node.nodeName}` : `Collapse ${item.node.nodeName}`}
                                >
                                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isCollapsed ? "-rotate-90" : "rotate-0")} />
                                </span>
                              ) : (
                                <span className="h-6 w-6 shrink-0" aria-hidden="true" />
                              )}
                              {typeof item.node.levelCount === "number" ? (
                                <span className="inline-flex rounded-md bg-[#eef2ff] px-2 py-0.5 text-[11px] font-bold tracking-[0.16em] text-[#4f46e5]">
                                  L{item.node.levelCount}
                                </span>
                              ) : null}
                              <span className="truncate text-base font-semibold text-slate-800">{item.node.nodeName}</span>
                            </div>
                            <p className="mt-2 break-all pl-8 text-xs text-slate-500">{item.node.nodePath}</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div ref={rightPanelRef} className="min-h-0 overflow-auto rounded-2xl border border-[#dbe4ff] bg-white p-5 shadow-[0_18px_40px_rgba(148,163,184,0.12)]">
            {submitError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            ) : null}

            {selectedNode ? (
              <div className="space-y-5">
                <div className="border-b border-slate-200 pb-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b6f9c]">Node Preference</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {typeof selectedNode.levelCount === "number" ? (
                          <span className="inline-flex rounded-md bg-[#eef2ff] px-2 py-1 text-[11px] font-bold tracking-[0.16em] text-[#4f46e5]">
                            L{selectedNode.levelCount}
                          </span>
                        ) : null}
                        <h3 className="text-2xl font-semibold text-slate-900">{selectedNode.nodeName}</h3>
                      </div>
                      <p className="mt-2 break-all text-sm text-slate-500">{selectedNode.nodePath}</p>
                    </div>
                    <div className="rounded-2xl border border-[#dbe4ff] bg-white px-4 py-3 text-right">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b6f9c]">Node Type</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{selectedNode.nodeType || "-"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-base font-semibold text-slate-800">Module Preferences</h4>
                </div>

                {selectedNode.modules.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No module preferences found for this node.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedNode.modules.map((moduleEntry) => {
                      const selectedValue = selectionDraft[selectedNode.nodePath]?.[moduleEntry.module] ?? "";
                      const matchedWorkflow = moduleEntry.workflows.find((workflow) => workflow.levelsHash === selectedValue) ?? null;
                      return (
                        <div key={`${selectedNode.nodePath}-${moduleEntry.module}`} className="rounded-2xl border border-[#dbe4ff] bg-white px-4 py-4 shadow-sm">
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(260px,1.1fr)] lg:items-center">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">{formatModuleLabel(moduleEntry.module)}</p>
                              {!matchedWorkflow ? <p className="mt-1 text-xs font-medium text-amber-600">No workflow selected</p> : null}
                            </div>
                            <div>
                              <Select
                                value={selectedValue || NO_WORKFLOW_VALUE}
                                onValueChange={(value) => handleSelectWorkflow(selectedNode.nodePath, moduleEntry.module, value)}
                                disabled={saving || moduleEntry.workflows.length === 0 || Boolean(selectedNode.isPreview)}
                              >
                                <SelectTrigger className="h-11 rounded-xl border-[#dbe4ff] bg-white shadow-sm">
                                  <SelectValue placeholder="Select workflow" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NO_WORKFLOW_VALUE}>No workflow selected</SelectItem>
                                  {moduleEntry.workflows.map((workflow) => (
                                    <SelectItem key={workflow.levelsHash} value={workflow.levelsHash}>
                                      {workflow.name}{workflow.alias ? ` (${workflow.alias})` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Select a node to view module preferences.
              </div>
            )}
          </div>
        </div>

        {!loading && !loadError ? (
          <div className="flex items-center justify-end gap-3 border-t border-[#dbe4ff] bg-white px-6 py-4">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={saving}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!pendingChanges || saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#3553e9_0%,#2563eb_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(37,99,235,0.28)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              <Check className="h-4 w-4" />
              {saving ? "Saving..." : "Submit"}
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
