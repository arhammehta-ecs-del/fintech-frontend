import { useMemo, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import type { AppUser } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/userIdentity.utils";
import { getAccessRights } from "@/services/auth.service";
import { NodeAccessCard } from "@/features/user-management/components/UserManagePreview.NodeAccessCard";
import { groupByNode } from "@/features/user-management/components/UserManagePreview.utils";

const fieldLabelClassName = "text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground";
const fieldValueClassName = "mt-1 text-base font-semibold text-foreground";

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className={fieldLabelClassName}>{label}</p>
      <p className={fieldValueClassName}>{value?.trim() || "—"}</p>
    </div>
  );
}

export default function Profile() {
const { currentUser } = useAppContext();
const { toast } = useToast();
const [isAccessLoading, setIsAccessLoading] = useState(false);
const [accessDetails, setAccessDetails] = useState<NonNullable<AppUser["accessDetails"]>>([]);
const [hasLoadedAccessRights, setHasLoadedAccessRights] = useState(false);
const accessRightsSectionRef = useRef<HTMLDivElement | null>(null);
const stickyProfileRef = useRef<HTMLDivElement | null>(null);

const base = currentUser?.name || currentUser?.email || "User";
const initials = getInitials(base);
const primaryItems = useMemo(
  () => accessDetails.filter((item) => item.accessType === "PRIMARY"),
  [accessDetails],
);
const secondaryItems = useMemo(
  () => accessDetails.filter((item) => item.accessType !== "PRIMARY"),
  [accessDetails],
);
const primaryEntries = useMemo(() => Object.entries(groupByNode(primaryItems)), [primaryItems]);
const secondaryEntries = useMemo(() => Object.entries(groupByNode(secondaryItems)), [secondaryItems]);
const globalAccessNode = useMemo(
  () =>
    primaryItems.find((item) => {
      const roleCategory = (item.roleCategory || "").trim().toUpperCase();
      const roleSubCategory = (item.roleSubCategory || "").trim().toUpperCase();
      const accessCategory = (item.accessCategory || "").trim().toUpperCase();
      return Boolean(roleCategory) && roleCategory === roleSubCategory && accessCategory === "ALL_CHILD";
    }) ?? null,
  [primaryItems],
);
const globalAccessScopeLabel = ((globalAccessNode?.accessCategory || "").trim().toUpperCase() === "ALL_CHILD"
  ? "All Child"
  : (globalAccessNode?.accessCategory || "").trim().toUpperCase() === "IMMEDIATE_CHILD"
    ? "Immediate Child"
    : "Node");
const globalAccessTitle = (globalAccessNode?.roleName || "").trim();

const scrollToAccessRights = () => {
  const section = accessRightsSectionRef.current;
  if (!section) return;
  const stickyHeight = stickyProfileRef.current?.getBoundingClientRect().height ?? 0;
  const topBar = document.querySelector("header");
  const topBarHeight = topBar ? topBar.getBoundingClientRect().height : 0;
  const targetTop = window.scrollY + section.getBoundingClientRect().top - stickyHeight - topBarHeight - 12;
  window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
};

const handleViewAccessRights = async () => {
  const email = currentUser?.email?.trim();
  const companyCode = currentUser?.companyCode?.trim().toUpperCase();
  if (!email || !companyCode) {
    toast({
      title: "Missing profile details",
      description: "Email or company code is unavailable for this account.",
      variant: "destructive",
    });
    return;
  }

  setIsAccessLoading(true);
  try {
    const response = await getAccessRights(email, companyCode);
    const mappedPrimary: NonNullable<AppUser["accessDetails"]> = response.primary.map((row) => ({
      ...row,
      accessType: "PRIMARY",
      accessCategory: (row.accessCategory?.trim().toUpperCase() as "ALL_CHILD" | "IMMEDIATE_CHILD" | "NODE") || "NODE",
    }));
    const mappedSecondary: NonNullable<AppUser["accessDetails"]> = response.secondary.map((row) => ({
      ...row,
      accessType: "SECONDARY",
      accessCategory: (row.accessCategory?.trim().toUpperCase() as "ALL_CHILD" | "IMMEDIATE_CHILD" | "NODE") || "NODE",
    }));
    setAccessDetails([...mappedPrimary, ...mappedSecondary]);
    setHasLoadedAccessRights(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToAccessRights);
    });
  } catch (error) {
    setAccessDetails([]);
    setHasLoadedAccessRights(false);
    toast({
      title: "Unable to load access rights",
      description: error instanceof Error ? error.message : "Failed to fetch access rights.",
      variant: "destructive",
    });
  } finally {
    setIsAccessLoading(false);
  }
};


  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-4">
      <div ref={stickyProfileRef} className="sticky top-[56px] z-30 space-y-4 rounded-2xl bg-white/95 px-1 pb-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Profile details for your current account</p>
        </div>

        <Card className="overflow-hidden rounded-3xl border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold text-foreground">{currentUser?.name || "—"}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{currentUser?.email || "—"}</p>
              </div>
            </div>
            <Badge className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
              Active
            </Badge>
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-lg">Personal Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <Separator />
          <div className="grid gap-4 md:grid-cols-3">
            <ProfileField label="Name" value={currentUser?.name || ""} />
            <ProfileField label="Email" value={currentUser?.email} />
            <ProfileField label="Phone" value={currentUser?.phone} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-lg">Company Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <Separator />
          <div className="grid gap-4 md:grid-cols-3">
            <ProfileField label="Company" value={currentUser?.company} />
            <ProfileField label="Brand" value={currentUser?.brand} />
            <ProfileField label="Company Code" value={currentUser?.companyCode} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-lg">Group Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <Separator />
          <div className="grid gap-4 md:grid-cols-3">
            <ProfileField label="Group Name" value={currentUser?.groupName} />
            <ProfileField label="Group Code" value={currentUser?.groupCode} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-1">
        <Button onClick={() => void handleViewAccessRights()} disabled={isAccessLoading}>
          {isAccessLoading ? "Loading Access Rights..." : "View Access Rights"}
        </Button>
      </div>
      {hasLoadedAccessRights ? (
        <Card ref={accessRightsSectionRef} className="rounded-3xl border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
          <CardHeader className="border-b border-slate-200/80 bg-white p-5 pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">Access Rights</CardTitle>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close access rights"
                onClick={() => {
                  setHasLoadedAccessRights(false);
                  setAccessDetails([]);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-5 pt-0">
            <Separator className="hidden" />
            {isAccessLoading ? (
              <div className="py-4 text-sm text-muted-foreground">Loading access rights...</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Primary Access</p>
                  {globalAccessNode && globalAccessTitle ? (
                    <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/70 to-white p-4 shadow-[0_8px_24px_rgba(16,185,129,0.10)]">
                      <div className="rounded-xl border border-emerald-200/80 bg-white p-4">
                        <span className="inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/40 text-emerald-700 shadow-[0_8px_20px_rgba(16,185,129,0.12)]">
                          <ShieldCheck className="h-9 w-9" />
                        </span>
                        <p className="mt-3 text-sm font-extrabold uppercase tracking-[0.12em] text-emerald-700">{globalAccessTitle}</p>
                        <div className="mt-3 rounded-lg border border-emerald-200/80 bg-emerald-50/30 p-3 text-sm">
                          <div className="grid grid-cols-[110px_10px_1fr] items-center gap-x-2">
                            <span className="text-slate-500">Node Name</span>
                            <span className="text-slate-400">:</span>
                            <span className="font-semibold text-slate-900">{globalAccessNode.nodeName || "—"}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-slate-500">Access Category</span>
                            <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold leading-none text-emerald-700">
                              {globalAccessScopeLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : primaryEntries.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No primary access found.</div>
                  ) : (
                    <div className="space-y-3">
                      {primaryEntries.map(([nodeKey, node], index) => (
                        <NodeAccessCard
                          key={`p-${nodeKey}`}
                          nodeName={node.nodeName}
                          parentSubtitle={node.parentSubtitle}
                          nodeIndex={index}
                          categories={node.categories}
                          isPrimary
                        />
                      ))}
                    </div>
                  )}
                </div>

                {!globalAccessNode ? (
                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Secondary Access</p>
                    {secondaryEntries.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No secondary access found.</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {secondaryEntries.map(([nodeKey, node], index) => (
                          <NodeAccessCard
                            key={`s-${nodeKey}`}
                            nodeName={node.nodeName}
                            parentSubtitle={node.parentSubtitle}
                            nodeIndex={index}
                            categories={node.categories}
                            isPrimary={false}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
