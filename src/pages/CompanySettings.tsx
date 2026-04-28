import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { RolesAllocationPanel } from "@/components/RolesAllocationPanel";
import { OrgStructureView } from "@/features/org-structure";
import { UserManagementView } from "@/features/user-management";

const settingsTabClassName =
  "rounded-full px-4 py-2 text-sm font-medium transition-all hover:bg-slate-100 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm";

export default function CompanySettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "org";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Company Settings</h1>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(tab) => setSearchParams(tab === "org" ? {} : { tab })}
        className="space-y-4"
      >
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white p-1.5 shadow-sm whitespace-nowrap">
          <TabsTrigger value="org" className={settingsTabClassName}>Org Structure</TabsTrigger>
          <TabsTrigger value="users" className={settingsTabClassName}>User Management</TabsTrigger>
          <TabsTrigger value="roles" className={settingsTabClassName}>Roles</TabsTrigger>
          <TabsTrigger value="workflows" className={settingsTabClassName}>Workflows</TabsTrigger>
        </TabsList>

        <TabsContent value="org" className="mt-0">
          <OrgStructureView embedded />
        </TabsContent>

        <TabsContent value="users">
          <UserManagementView />
        </TabsContent>

        <TabsContent value="roles">
          <Card className="shadow-sm">
            <CardContent className="py-6">
              <RolesAllocationPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows">
          <Card className="shadow-sm">
            <CardContent className="py-10">
              <p className="text-sm text-muted-foreground">Workflow details are not being fetched yet.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
