import { useState } from "react";
import { useAppContext, OrgNode } from "@/contexts/AppContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, FolderTree, Eye, Edit } from "lucide-react";

function OrgTreeNode({ node }: { node: OrgNode }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="ml-4">
      <div className="flex items-center gap-2 py-1.5">
        {node.children.length > 0 ? (
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : <span className="w-3.5" />}
        <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{node.name}</span>
      </div>
      {expanded && node.children.map(child => (
        <OrgTreeNode key={child.id} node={child} />
      ))}
    </div>
  );
}

export default function CompanySettings() {
  const { orgStructure, users } = useAppContext();
  const [search, setSearch] = useState("");

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Company Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Showing fetched details only</p>
      </div>

      <Tabs defaultValue="org" className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="org">Org Structure</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="org">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Organization Tree</CardTitle>
              <CardDescription>Showing fetched organization details only</CardDescription>
            </CardHeader>
            <CardContent>
              {orgStructure ? (
                <OrgTreeNode node={orgStructure} />
              ) : (
                <p className="text-sm text-muted-foreground">No organization structure is being fetched yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="relative w-full max-w-sm flex-1">
                <Input placeholder="Search users..." className="pl-3" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="py-10">
                  <p className="text-sm text-muted-foreground">No users are being fetched yet.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredUsers.map((u) => (
                    <Card key={u.id} className="shadow-sm">
                      <div className="flex flex-col gap-3 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{u.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground break-all">{u.email}</p>
                          </div>
                          <Badge variant="secondary" className="text-xs">{u.role}</Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                          <p>{u.designation || "No designation"}</p>
                          <p>{u.department || "No department"}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="h-8 px-0 text-xs gap-1"><Eye className="h-3 w-3" /> View</Button>
                          <Button variant="ghost" size="sm" className="h-8 px-0 text-xs gap-1"><Edit className="h-3 w-3" /> Modify</Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                <Card className="hidden overflow-hidden shadow-sm md:block">
                  <div className="overflow-x-auto">
                    <table className="min-w-[860px] w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Designation</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Department</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-foreground">{u.name}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                            <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{u.role}</Badge></td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{u.designation}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{u.department}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><Eye className="h-3 w-3" /> View</Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><Edit className="h-3 w-3" /> Modify</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <Card className="shadow-sm">
            <CardContent className="py-10">
              <p className="text-sm text-muted-foreground">Role details are not being fetched yet.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
