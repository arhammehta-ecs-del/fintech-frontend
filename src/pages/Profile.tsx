import { useMemo } from "react";
import { Pencil, ShieldCheck } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";

const fieldLabelClassName = "text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground";
const fieldValueClassName = "mt-1 text-base font-semibold text-foreground";

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={fieldLabelClassName}>{label}</p>
      <p className={fieldValueClassName}>{value || "—"}</p>
    </div>
  );
}

function EditCardButton() {
  return (
    <Button
      variant="outline"
      className="h-9 gap-2 rounded-xl border-border bg-white px-3"
      onClick={() =>
        toast({
          title: "Currently not available",
          description: "Editing profile details is currently not available.",
        })
      }
    >
      <Pencil className="h-4 w-4" />
      Edit
    </Button>
  );
}

export default function Profile() {
  const { currentUser } = useAppContext();

  const initials = useMemo(() => {
    const base = currentUser?.name || currentUser?.email || "User";
    return base
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [currentUser]);

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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
          <CardTitle className="text-lg">Personal Info</CardTitle>
          <EditCardButton />
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileField label="Name" value={currentUser?.name || ""} />
            <ProfileField label="Email" value={currentUser?.email || ""} />
            <ProfileField label="Phone" value={currentUser?.phone || ""} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
          <CardTitle className="text-lg">Company Info</CardTitle>
          <EditCardButton />
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileField label="Company" value={currentUser?.company || ""} />
            <ProfileField label="Brand" value={currentUser?.brand || ""} />
            <ProfileField label="Company Code" value={currentUser?.companyCode || ""} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
          <CardTitle className="text-lg">Group Info</CardTitle>
          <EditCardButton />
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileField label="Group Name" value={currentUser?.groupName || ""} />
            <ProfileField label="Group Code" value={currentUser?.groupCode || ""} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border bg-white shadow-sm">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Profile details are currently view-only. Editing will be enabled once backend support is available.
        </CardContent>
      </Card>
    </div>
  );
}
