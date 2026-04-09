import { useEffect, useState } from "react";
import { Building2, ChevronDown, ChevronRight, GitBranch, RefreshCw, Waypoints } from "lucide-react";
import DepartmentSidebar, { type DepartmentSidebarDepartment } from "@/components/DepartmentSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext, type OrgNode } from "@/contexts/AppContext";
import { getCompanyOrgStructure } from "@/lib/api";
import { cn } from "@/lib/utils";

function nodeAccent(nodeType: string) {
  const normalizedType = nodeType.trim().toUpperCase();

  if (normalizedType === "ROOT") return "border-slate-300 bg-slate-100 text-slate-900";
  if (normalizedType === "DIVISION") return "border-blue-200 bg-blue-50 text-blue-950";
  if (normalizedType === "LOCATION") return "border-amber-200 bg-amber-50 text-amber-950";
  if (normalizedType === "DEPARTMENT") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  return "border-slate-200 bg-white text-slate-900";
}

function OrgTreeNode({
  node,
  depth = 0,
  selectedId,
  onSelect,
}: {
  node: OrgNode;
  depth?: number;
  selectedId?: string;
  onSelect: (node: OrgNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = node.id === selectedId;

  useEffect(() => {
    if (isSelected) {
      setExpanded(true);
    }
  }, [isSelected]);

  return (
    <div className="relative">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="mt-3 rounded-full border border-slate-200 bg-white p-1 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="mt-3 h-6 w-6 rounded-full border border-dashed border-slate-200 bg-white" />
          )}
          {hasChildren && expanded ? <div className="mt-1 w-px flex-1 bg-slate-200" /> : null}
        </div>

        <button
          type="button"
          onClick={() => onSelect(node)}
          className={cn(
            "w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
            nodeAccent(node.nodeType),
            isSelected && "ring-2 ring-offset-2 ring-slate-300",
          )}
          style={{ marginLeft: `${depth * 4}px` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{node.name}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.08em] opacity-75">{node.nodeType}</p>
            </div>
            <div className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {node.children.length} child{node.children.length === 1 ? "" : "ren"}
            </div>
          </div>
          <p className="mt-3 break-all text-xs text-slate-500">{node.nodePath || "No path available"}</p>
        </button>
      </div>

      {hasChildren && expanded ? (
        <div className="ml-5 mt-3 space-y-3 border-l border-dashed border-slate-200 pl-5">
          {node.children.map((child) => (
            <OrgTreeNode key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SaasOrganisation() {
  const {
    currentUser,
    orgStructure,
    setOrgStructure,
    companyOrgs,
    setCompanyOrgs,
  } = useAppContext();
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentSidebarDepartment | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState("");

  const loadOrgForCompanyCode = async (companyCode: string) => {
    setOrgLoading(true);
    setOrgError("");

    try {
      const structure = await getCompanyOrgStructure(companyCode);
      setOrgStructure(structure);
      if (structure) {
        setCompanyOrgs((prev) => ({
          ...prev,
          [companyCode]: structure,
        }));
      }
    } catch {
      setOrgStructure(null);
      setOrgError("Unable to fetch organization structure.");
    } finally {
      setOrgLoading(false);
    }
  };

  useEffect(() => {
    const companyCode = currentUser?.companyCode?.trim().toUpperCase() ?? "";
    if (!companyCode) {
      setOrgStructure(null);
      setOrgError("No company code found for the logged-in user.");
      return;
    }

    const cachedOrg = companyOrgs[companyCode];
    if (cachedOrg) {
      setOrgStructure(cachedOrg);
      setOrgError("");
      return;
    }

    let cancelled = false;

    const loadOrgStructure = async () => {
      setOrgLoading(true);
      setOrgError("");

      try {
        const structure = await getCompanyOrgStructure(companyCode);
        if (cancelled) return;

        setOrgStructure(structure);
        if (structure) {
          setCompanyOrgs((prev) => ({
            ...prev,
            [companyCode]: structure,
          }));
        }
      } catch {
        if (!cancelled) {
          setOrgStructure(null);
          setOrgError("Unable to fetch organization structure.");
        }
      } finally {
        if (!cancelled) {
          setOrgLoading(false);
        }
      }
    };

    void loadOrgStructure();

    return () => {
      cancelled = true;
    };
  }, [companyOrgs, currentUser?.companyCode, setCompanyOrgs, setOrgStructure]);

  useEffect(() => {
    if (!orgStructure) {
      setSelectedDepartment(null);
      setSidebarOpen(false);
      return;
    }

    setSelectedDepartment({
      id: orgStructure.id,
      name: orgStructure.name,
      parentId: orgStructure.parentId,
      nodeType: orgStructure.nodeType,
      nodePath: orgStructure.nodePath,
      companyId: orgStructure.companyId,
      childCount: orgStructure.children.length,
      breadcrumbs: [orgStructure.name],
    });
  }, [orgStructure]);

  const userCompanyCode = currentUser?.companyCode?.trim().toUpperCase() ?? "";

  const handleDepartmentClick = (node: OrgNode) => {
    const breadcrumbs: string[] = [];

    const collectTrail = (branch: OrgNode | null, targetId: string): boolean => {
      if (!branch) return false;

      breadcrumbs.push(branch.name);
      if (branch.id === targetId) return true;

      for (const child of branch.children) {
        if (collectTrail(child, targetId)) return true;
      }

      breadcrumbs.pop();
      return false;
    };

    collectTrail(orgStructure, node.id);
    setSelectedDepartment({
      id: node.id,
      name: node.name,
      parentId: node.parentId,
      nodeType: node.nodeType,
      nodePath: node.nodePath,
      companyId: node.companyId,
      childCount: node.children.length,
      breadcrumbs,
    });
    setSidebarOpen(true);
  };

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-stretch">
      <div
        className={cn(
          "flex w-full items-stretch overflow-hidden lg:grid",
          sidebarOpen ? "lg:grid-cols-[minmax(0,1fr)_360px]" : "lg:grid-cols-[minmax(0,1fr)_0px]",
        )}
        style={{ transition: "grid-template-columns 500ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="min-w-0 pr-0 lg:pr-8">
          <div className="space-y-6 px-6 py-8 sm:px-8 sm:py-10">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Organisation Structure</h1>
              <p className="mt-1 text-sm text-slate-500">Live organization hierarchy fetched by company code.</p>
            </div>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Fetch Organization</CardTitle>
                <CardDescription>When this page opens, it calls `POST /api/v1/company-settings/org` using the logged-in user&apos;s company code.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Company Code</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{userCompanyCode || "—"}</p>
                  </div>
                  <Button onClick={() => void loadOrgForCompanyCode(userCompanyCode)} disabled={!userCompanyCode || orgLoading} className="gap-2">
                    {orgLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Waypoints className="h-4 w-4" />}
                    {orgLoading ? "Fetching..." : "Refresh Org"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {orgError ? (
              <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
                <CardContent className="py-6 text-sm text-destructive">{orgError}</CardContent>
              </Card>
            ) : null}

            {!orgLoading && !orgStructure && !orgError ? (
              <Card className="border-dashed border-slate-200 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <div className="rounded-2xl bg-slate-100 p-4 text-slate-500">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">No org structure loaded</p>
                    <p className="mt-1 text-sm text-slate-500">Enter a company code above to fetch and build the organization tree.</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {orgStructure ? (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">{orgStructure.name}</CardTitle>
                    <CardDescription>{orgStructure.nodePath || "Root node"}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                    <GitBranch className="h-3.5 w-3.5" />
                    {orgStructure.nodeType}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <OrgTreeNode
                      node={orgStructure}
                      selectedId={selectedDepartment?.id}
                      onSelect={handleDepartmentClick}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            "hidden overflow-hidden border-l border-slate-200 bg-white lg:block",
            sidebarOpen ? "w-[360px]" : "w-0",
          )}
        >
          <DepartmentSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} department={selectedDepartment} />
        </div>
      </div>
    </div>
  );
}
