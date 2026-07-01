import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBranchAppearance, getNodeAccentBorderLeft } from "@/features/org-structure/nodeTheme.utils";
import { useToast } from "@/hooks/use-toast";
import { matchesNodeSearchQuery } from "@/lib/nodeSearch";
import { formatNodePathDisplay } from "@/lib/nodePath";
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
  onPreferencesSaved?: () => void | Promise<void>;
};

type WorkflowPreferenceDialogNode = WorkflowPreferenceNode;
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

const countPendingChanges = (draft: NodeSelectionMap, baseline: NodeSelectionMap) =>
  Object.entries(draft).reduce(
    (count, [nodePath, modules]) => count + Object.entries(modules).filter(([moduleName, value]) => (baseline[nodePath]?.[moduleName] ?? "") !== value).length,
    0,
  );

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
  const { toast } = useToast();
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
  const [nodeSearch, setNodeSearch] = useState("");
  const [isNodeSearchExpanded, setIsNodeSearchExpanded] = useState(false);
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
  const { firstMatchingWorkflowPreferenceNodePath, visibleWorkflowPreferenceFlowNodes } = useMemo(() => {
    const query = nodeSearch.trim().toLowerCase();
    if (!query) {
      return {
        firstMatchingWorkflowPreferenceNodePath: "",
        visibleWorkflowPreferenceFlowNodes: workflowPreferenceFlowNodes,
      };
    }

    const expandedFlowNodes = flattenWorkflowPreferenceTree(workflowPreferenceTree, []);
    const matchingPaths = new Set<string>();
    const directMatchingNodePaths: string[] = [];

    expandedFlowNodes.forEach((item) => {
      const matchesQuery = matchesNodeSearchQuery(
        {
          nodeName: item.node.nodeName,
          nodePath: item.node.nodePath,
          nodeType: item.node.nodeType,
          companyName: companyNode?.nodeName,
          companyCode: companyNode?.nodePath,
        },
        query,
      );
      if (matchesQuery) {
        directMatchingNodePaths.push(item.node.nodePath);
        const segments = item.node.nodePath.split(".").map((segment) => segment.trim()).filter(Boolean);
        segments.forEach((_, index) => matchingPaths.add(segments.slice(0, index + 1).join(".")));
      }
    });

    return {
      firstMatchingWorkflowPreferenceNodePath: directMatchingNodePaths[0] ?? "",
      visibleWorkflowPreferenceFlowNodes: expandedFlowNodes.filter((item) => matchingPaths.has(item.node.nodePath)),
    };
  }, [companyNode?.nodeName, companyNode?.nodePath, nodeSearch, workflowPreferenceFlowNodes, workflowPreferenceTree]);
  const pendingChangeCount = useMemo(() => countPendingChanges(selectionDraft, initialSelection), [initialSelection, selectionDraft]);
  const pendingChanges = pendingChangeCount > 0;
  const getSelectedModuleCountForNode = (nodePath: string, modules: WorkflowPreferenceDialogNode["modules"]) =>
    modules.filter((moduleEntry) => Boolean(selectionDraft[nodePath]?.[moduleEntry.module] ?? "")).length;
  const selectedModuleCount = useMemo(
    () => selectedNode?.modules.filter((moduleEntry) => Boolean(selectionDraft[selectedNode.nodePath]?.[moduleEntry.module] ?? "")).length ?? 0,
    [selectedNode, selectionDraft],
  );
  const totalModuleCount = selectedNode?.modules.length ?? 0;

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
        const nextNodes = response;
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

  useEffect(() => {
    if (open) return;
    setNodeSearch("");
    setIsNodeSearchExpanded(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!nodeSearch.trim() || !firstMatchingWorkflowPreferenceNodePath) return;
    setSelectedNodePath((current) => (
      current === firstMatchingWorkflowPreferenceNodePath ? current : firstMatchingWorkflowPreferenceNodePath
    ));
  }, [firstMatchingWorkflowPreferenceNodePath, nodeSearch, open]);

  useEffect(() => {
    if (!open || !selectedNodePath) return;

    const scrollToSelectedNode = () => {
      selectedNodeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    const frame = window.requestAnimationFrame(scrollToSelectedNode);
    const timeoutId = window.setTimeout(scrollToSelectedNode, 80);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeoutId);
    };
  }, [collapsedNodePaths, open, selectedNodePath, visibleWorkflowPreferenceFlowNodes]);

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

  const handleResetSelections = () => {
    setSelectionDraft(initialSelection);
    setSubmitError("");
  };

  const handleSubmit = async () => {
    if (saving) return;

    const changedEntries = nodes.flatMap((node) =>
      node.modules
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
      const preferenceUpdates = changedEntries.flatMap((entry) => {
        const updates: Array<{
          module: string;
          nodePath: string;
          levelsHash: string;
          type: "ADDED" | "REMOVED";
        }> = [];
        if (entry.initialLevelsHash) {
          updates.push({
            module: entry.module,
            nodePath: entry.nodePath,
            levelsHash: entry.initialLevelsHash,
            type: "REMOVED" as const,
          });
        }
        if (entry.levelsHash) {
          updates.push({
            module: entry.module,
            nodePath: entry.nodePath,
            levelsHash: entry.levelsHash,
            type: "ADDED" as const,
          });
        }
        return updates;
      });

      const response = await updateWorkflowPreference(preferenceUpdates);

      const refreshedNodes = await fetchWorkflowUserPreferences();
      const refreshedSelection = buildSelectionMap(refreshedNodes);
      setNodes(refreshedNodes);
      setInitialSelection(refreshedSelection);
      setSelectionDraft(refreshedSelection);
      setSelectedNodePath((current) =>
        refreshedNodes.some((node) => node.nodePath === current) ? current : (refreshedNodes[0]?.nodePath ?? ""),
      );
      if (response.message?.trim()) {
        toast({
          title: response.message.trim(),
        });
      }
      await onPreferencesSaved?.();
      onOpenChange(false);
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

        <div className="flex items-start justify-between gap-4 border-b border-[#dbe4ff] bg-white px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b6f9c]">Company</p>
            <p className="mt-2 truncate text-sm font-medium text-slate-900">
              {companyNode?.nodeName || "-"}
              {companyNode?.nodePath ? ` (${formatNodePathDisplay(companyNode.nodePath, { excludeRoot: true })})` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetSelections}
            disabled={!pendingChanges || saving || loading}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>
        </div>

        <div ref={panelsRef} className="relative grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-hidden bg-white p-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-8">
          {arrowPosition ? (
            <div
              className="pointer-events-none absolute z-20 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#dbe4ff] bg-white text-[#4f6fd9] shadow-[0_10px_30px_rgba(79,111,217,0.18)] lg:flex"
              style={{ left: `${arrowPosition.left}px`, top: `${arrowPosition.top}px` }}
            >
              <ArrowRight className="h-4 w-4" />
            </div>
          ) : null}

          <div ref={leftPanelRef} className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#dbe4ff] bg-white p-5">
            <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-800">Organization Nodes</h3>
              <button
                type="button"
                onClick={() => {
                  if (isNodeSearchExpanded) {
                    setNodeSearch("");
                    setIsNodeSearchExpanded(false);
                    return;
                  }
                  setIsNodeSearchExpanded(true);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:border-slate-300 hover:bg-white"
                aria-label={isNodeSearchExpanded ? "Close organization nodes search" : "Open organization nodes search"}
              >
                {isNodeSearchExpanded ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              </button>
            </div>
            <div
              className={cn(
                "overflow-hidden transition-all duration-200 ease-out",
                isNodeSearchExpanded ? "mb-3 max-h-16 opacity-100" : "max-h-0 opacity-0",
              )}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={nodeSearch}
                  onChange={(event) => setNodeSearch(event.target.value)}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Escape") {
                      setNodeSearch("");
                      setIsNodeSearchExpanded(false);
                    }
                  }}
                  placeholder="Search node name or path..."
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] shadow-none"
                  autoComplete="off"
                  autoFocus={isNodeSearchExpanded}
                />
              </div>
            </div>
            <div
              className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-3"
              style={{ scrollbarGutter: "stable", WebkitOverflowScrolling: "touch" }}
            >
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">Loading preferences...</div>
              ) : loadError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{loadError}</div>
              ) : nodes.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">No workflow preferences available.</div>
              ) : visibleWorkflowPreferenceFlowNodes.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">No matching nodes found.</div>
              ) : (
                visibleWorkflowPreferenceFlowNodes.map((item) => {
                  const appearance = getBranchAppearance(item.branchIndex, item.branchDepth, item.isRoot);
                  const borderLeftClass = item.isRoot
                    ? "border-l-indigo-400"
                    : getNodeAccentBorderLeft(item.branchIndex, item.branchDepth, item.isRoot);
                  const isSelected = selectedNode?.nodePath === item.node.nodePath;
                  const hasChildren = item.node.children.length > 0;
                  const isCollapsed = collapsedNodePaths.includes(item.node.nodePath);
                  const selectedModuleCountForNode = getSelectedModuleCountForNode(item.node.nodePath, item.node.modules);
                  const totalModuleCountForNode = item.node.modules.length;
                  const indentPx = item.depth * 20;
                  return (
                    <div key={item.node.nodePath} className="min-w-0" style={{ paddingLeft: `${indentPx}px` }}>
                      <button
                        ref={isSelected ? selectedNodeRef : null}
                        type="button"
                        onClick={() => setSelectedNodePath(item.node.nodePath)}
                        className={cn(
                          "group relative block w-full min-w-0 max-w-full overflow-hidden rounded-2xl border bg-white px-4 py-4 text-left shadow-sm transition-all duration-200",
                          isSelected
                            ? item.isRoot
                              ? "border border-indigo-200 bg-indigo-50/70 text-slate-800 shadow-[0_10px_22px_rgba(99,102,241,0.16)] border-l-[4px] border-l-indigo-400"
                              : cn(
                                "border-[hsl(235,60%,50%)] shadow-[0_0_0_3px_rgba(30,35,80,0.08)] bg-[hsla(235,60%,50%,0.02)] border-l-[4px]",
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
                                <span className="inline-flex rounded-md bg-[hsla(235,60%,50%,0.10)] px-2 py-0.5 text-[11px] font-bold tracking-[0.16em] text-[hsl(235,60%,50%)]">
                                  L{item.node.levelCount}
                                </span>
                              ) : null}
                              <span className="truncate text-base font-semibold text-slate-800">{item.node.nodeName}</span>
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full border border-[#dbe4ff] bg-[#f7f9ff] px-2.5 py-1 text-[11px] font-semibold text-[#4f6fd9]">
                            {selectedModuleCountForNode}/{totalModuleCountForNode}
                          </span>
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
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b6f9c]">Node Preference</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {typeof selectedNode.levelCount === "number" ? (
                        <span className="inline-flex rounded-md bg-[hsla(235,60%,50%,0.10)] px-2 py-1 text-[11px] font-bold tracking-[0.16em] text-[hsl(235,60%,50%)]">
                          L{selectedNode.levelCount}
                        </span>
                      ) : null}
                      <h3 className="text-2xl font-semibold text-slate-900">
                        {selectedNode.nodeName}
                        {selectedNode.nodeType ? (
                          <span className="ml-1 text-lg font-medium capitalize text-slate-500">
                            ({selectedNode.nodeType.toLowerCase()})
                          </span>
                        ) : null}
                      </h3>
                    </div>
                    <p className="mt-2 break-all text-sm text-slate-500">{formatNodePathDisplay(selectedNode.nodePath, { excludeRoot: true })}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-slate-800">Module Preferences</h4>
                  <span className="rounded-full border border-[#dbe4ff] bg-[#f7f9ff] px-3 py-1 text-xs font-semibold text-[#4f6fd9]">
                    {selectedModuleCount}/{totalModuleCount}
                  </span>
                </div>

                {selectedNode.modules.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No module preferences found for this node.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedNode.modules.map((moduleEntry) => {
                      const selectedValue = selectionDraft[selectedNode.nodePath]?.[moduleEntry.module] ?? "";
                      const workflowOptionCount = moduleEntry.workflows.length;
                      return (
                        <div key={`${selectedNode.nodePath}-${moduleEntry.module}`} className="rounded-2xl border border-[#dbe4ff] bg-white px-4 py-4 shadow-sm">
                          <div className="grid gap-3 md:grid-cols-[110px_minmax(0,1fr)] md:items-center">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                {formatModuleLabel(moduleEntry.module)} ({workflowOptionCount})
                              </p>
                            </div>
                            <div>
                              <Select
                                value={selectedValue || NO_WORKFLOW_VALUE}
                                onValueChange={(value) => handleSelectWorkflow(selectedNode.nodePath, moduleEntry.module, value)}
                                disabled={saving || moduleEntry.workflows.length === 0}
                              >
                                <SelectTrigger className="h-auto min-h-[3.5rem] w-full items-start rounded-xl border-[#dbe4ff] bg-white py-3 pl-3 pr-2 text-left shadow-sm [&>span]:block [&>span]:pr-3 [&>span]:text-left [&>span]:whitespace-normal [&>span]:break-words [&>span]:line-clamp-none [&>svg]:ml-1 [&>svg]:shrink-0">
                                  <SelectValue placeholder="Select workflow" />
                                </SelectTrigger>
                                <SelectContent className="min-w-[22rem] max-w-[30rem]">
                                  <SelectItem value={NO_WORKFLOW_VALUE}>No workflow selected</SelectItem>
                                  {moduleEntry.workflows.map((workflow) => (
                                    <SelectItem
                                      key={workflow.levelsHash}
                                      value={workflow.levelsHash}
                                      className="whitespace-normal break-words py-2 leading-5"
                                    >
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
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!pendingChanges || saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(235,60%,50%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(30,35,80,0.22)] transition-all hover:bg-[hsl(235,60%,45%)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              <Check className="h-4 w-4" />
              {saving ? "Saving..." : `Submit Changes${pendingChangeCount > 0 ? ` (${pendingChangeCount})` : ""}`}
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

