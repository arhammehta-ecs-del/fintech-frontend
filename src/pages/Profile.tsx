import { useRef, useState } from "react";
import { Eye, Pencil, ShieldCheck } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getInitials } from "@/lib/userIdentity.utils";
import { getAccessRights, type AccessRightsResponse } from "@/services/auth.service";
import { getPermissionActionLabelFromRoleName, formatRoleTokenLabel } from "@/features/user-management/roleLabels";

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

type AccessRightItem = AccessRightsResponse["primary"][number];

type AccessNodeGroup = {
  nodeName: string;
  nodePath: string;
  roleCategory: string;
  permissions: Array<{
    label: string;
    scope: string;
  }>;
};

const formatScopeLabel = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "ALL_CHILD") return "All Child";
  if (normalized === "IMMEDIATE_CHILD") return "Immediate Child";
  return "Node";
};

const groupAccessByNode = (rows: AccessRightItem[]): AccessNodeGroup[] => {
  const map = new Map<string, AccessNodeGroup>();
  rows.forEach((row) => {
    const key = `${row.nodeName}::${row.nodePath}::${row.roleCategory}`;
    const existing = map.get(key) ?? {
      nodeName: row.nodeName,
      nodePath: row.nodePath,
      roleCategory: row.roleCategory,
      permissions: [],
    };
    const action = getPermissionActionLabelFromRoleName(row.roleName || "Viewer");
    const scope = formatScopeLabel(row.accessCategory || "NODE");
    const token = `${action}::${scope}`;
    const exists = existing.permissions.some((item) => `${item.label}::${item.scope}` === token);
    if (!exists) {
      existing.permissions.push({ label: action, scope });
    }
    map.set(key, existing);
  });
  return Array.from(map.values());
};

const getPermissionBadgeStyle = (label: string) => {
  if (label === "Checker") return "border-violet-200 bg-violet-50 text-violet-700";
  if (label === "Maker") return "border-amber-200 bg-amber-50 text-amber-700";
  if (label === "Global Access") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
};

const getPermissionIcon = (label: string) => {
  if (label === "Checker") return ShieldCheck;
  if (label === "Maker") return Pencil;
  if (label === "Global Access") return ShieldCheck;
  return Eye;
};

function AccessNodeCard({ group, index, isPrimary }: { group: AccessNodeGroup; index: number; isPrimary: boolean }) {
  const edgeColors = isPrimary
    ? ["border-l-indigo-500", "border-l-blue-500", "border-l-violet-500"]
    : ["border-l-orange-500", "border-l-amber-500", "border-l-yellow-500"];
  const badgeColors = isPrimary
    ? ["bg-indigo-100 text-indigo-700", "bg-blue-100 text-blue-700", "bg-violet-100 text-violet-700"]
    : ["bg-orange-100 text-orange-700", "bg-amber-100 text-amber-700", "bg-yellow-100 text-yellow-700"];
  const edgeClass = edgeColors[index % edgeColors.length];
  const badgeClass = badgeColors[index % badgeColors.length];

  return (
    <div className={`rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${edgeClass}`}>
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${badgeClass}`}>
          {isPrimary ? `P${index + 1}` : `S${index + 1}`}
        </div>
        <div className="min-w-0">
          <p className="truncate text-4 font-bold text-slate-800">{group.nodeName || "-"}</p>
          <p className="truncate text-sm font-semibold text-slate-500">{group.nodePath || "-"}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="border-b border-slate-200 pb-1 text-xs font-black uppercase tracking-widest text-slate-500">
          {formatRoleTokenLabel(group.roleCategory || "SYSTEM_ACCESS")}
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4">
          <p className="truncate pt-1 text-base font-medium text-slate-600">Org Str</p>
          <div className="flex flex-wrap justify-end gap-2">
            {group.permissions.map((permission) => {
              const BadgeIcon = getPermissionIcon(permission.label);
              return (
                <span
                  key={`${permission.label}-${permission.scope}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${getPermissionBadgeStyle(permission.label)}`}
                >
                  <BadgeIcon className="h-3.5 w-3.5" />
                  {permission.label} - {permission.scope}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
const { currentUser } = useAppContext();
const [accessRights, setAccessRights] = useState<AccessRightsResponse | null>(null);
const [isAccessRightsLoading, setIsAccessRightsLoading] = useState(false);
const [accessRightsError, setAccessRightsError] = useState<string | null>(null);
const accessRightsRef = useRef<HTMLDivElement | null>(null);

const base = currentUser?.name || currentUser?.email || "User";
const initials = getInitials(base);

const handleViewAccessRights = async () => {
  if (!currentUser?.email || !currentUser?.companyCode) {
    setAccessRightsError("Missing email or company code for this user.");
    return;
  }

  setIsAccessRightsLoading(true);
  setAccessRightsError(null);
  try {
    const data = await getAccessRights(currentUser.email, currentUser.companyCode);
    setAccessRights(data);
    setTimeout(() => {
      accessRightsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch access rights";
    setAccessRightsError(message);
  } finally {
    setIsAccessRightsLoading(false);
  }
};

const handleCloseAccessRights = () => {
  setAccessRights(null);
  setAccessRightsError(null);
};


  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Profile details for your current account</p>
      </div>

      <Card className="overflow-hidden rounded-3xl border-border bg-white shadow-sm">
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

      <Card className="rounded-3xl border-border bg-white shadow-sm">
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

      <Card className="rounded-3xl border-border bg-white shadow-sm">
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

      <Card className="rounded-3xl border-border bg-white shadow-sm">
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

      <div className="flex justify-end">
        {accessRights ? (
          <Button
            onClick={handleCloseAccessRights}
            variant="outline"
            className="rounded-xl"
          >
            Close Access Rights
          </Button>
        ) : (
          <Button
            onClick={() => void handleViewAccessRights()}
            disabled={isAccessRightsLoading}
            className="rounded-xl"
          >
            {isAccessRightsLoading ? "Loading..." : "View Access Rights"}
          </Button>
        )}
      </div>

      {(accessRights || accessRightsError) ? (
        <div ref={accessRightsRef}>
        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-[13px] font-black uppercase tracking-[0.18em] text-slate-500">Access Rights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5 pt-0">
            <Separator />
            {accessRightsError ? (
              <p className="text-sm text-red-600">{accessRightsError}</p>
            ) : null}

            {accessRights ? (
              <>
                <div className="rounded-2xl border border-indigo-200 bg-[#DDE6FF] p-4">
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                      <p className="text-[12px] font-extrabold uppercase tracking-widest text-indigo-600">Primary Access</p>
                    </div>
                    {groupAccessByNode(accessRights.primary).length ? (
                      groupAccessByNode(accessRights.primary).map((group, index) => (
                        <AccessNodeCard key={`${group.nodeName}-${group.nodePath}-primary`} group={group} index={index} isPrimary />
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No primary access rights.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                    <p className="text-[12px] font-extrabold uppercase tracking-widest text-slate-500">Secondary Access</p>
                  </div>
                  {groupAccessByNode(accessRights.secondary).length ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {groupAccessByNode(accessRights.secondary).map((group, index) => (
                        <AccessNodeCard key={`${group.nodeName}-${group.nodePath}-secondary`} group={group} index={index} isPrimary={false} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No secondary access rights.</p>
                  )}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
        </div>
      ) : null}
    </div>
  );
}
