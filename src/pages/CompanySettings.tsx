import { useState } from "react";
import { useAppContext, OrgNode, AppUser } from "@/contexts/AppContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Plus, FolderTree, Users, Shield, Eye, Edit } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Org Tree ──
function OrgTreeNode({ node, onAdd }: { node: OrgNode; onAdd: (parentId: string, name: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd(node.id, newName.trim());
    setNewName("");
    setAdding(false);
  };

  return (
    <div className="ml-4">
      <div className="flex items-center gap-2 py-1.5 group">
        {node.children.length > 0 ? (
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : <span className="w-3.5" />}
        <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{node.name}</span>
        <button onClick={() => setAdding(true)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity">
          <Plus className="h-3 w-3" />
        </button>
      </div>
      {adding && (
        <div className="ml-8 flex flex-col gap-2 py-1 sm:flex-row sm:items-center">
          <Input className="h-8 text-sm w-full sm:w-48" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Department name" onKeyDown={e => e.key === "Enter" && handleAdd()} autoFocus />
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleAdd}>Add</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancel</Button>
        </div>
      )}
      {expanded && node.children.map(child => (
        <OrgTreeNode key={child.id} node={child} onAdd={onAdd} />
      ))}
    </div>
  );
}

// ── Roles data ──
const roles = [
  { name: "Admin", desc: "Full access to all modules and settings", icon: Shield, permissions: ["Read", "Write", "Delete", "Manage Users"] },
  { name: "Manager", desc: "Manage teams and approve requests", icon: Users, permissions: ["Read", "Write", "Approve"] },
  { name: "User", desc: "Standard access to assigned modules", icon: Eye, permissions: ["Read", "Write"] },
  { name: "Viewer", desc: "Read-only access to dashboards", icon: Eye, permissions: ["Read"] },
];

export default function CompanySettings() {
  const { orgStructure, setOrgStructure, users, setUsers } = useAppContext();
  const { toast } = useToast();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "User", designation: "", department: "" });
  const [search, setSearch] = useState("");

  const addOrgNode = (parentId: string, name: string) => {
    const addChild = (node: OrgNode): OrgNode => {
      if (node.id === parentId) return { ...node, children: [...node.children, { id: crypto.randomUUID(), name, parentId, children: [] }] };
      return { ...node, children: node.children.map(addChild) };
    };
    setOrgStructure(prev => addChild(prev));
    toast({ title: "Department added" });
  };

  const addUser = () => {
    if (!newUser.name || !newUser.email) return;
    setUsers(prev => [...prev, { ...newUser, id: crypto.randomUUID() }]);
    setNewUser({ name: "", email: "", role: "User", designation: "", department: "" });
    setUserModalOpen(false);
    toast({ title: "User added" });
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Company Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your organization structure, users, and roles</p>
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
              <CardDescription>Click + to add departments or sub-departments</CardDescription>
            </CardHeader>
            <CardContent>
              <OrgTreeNode node={orgStructure} onAdd={addOrgNode} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="relative w-full max-w-sm flex-1">
                <Input placeholder="Search users..." className="pl-3" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 self-start sm:self-auto"><Plus className="h-4 w-4" /> Add User</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2"><Label>Name</Label><Input value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Email</Label><Input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Role</Label><Input value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Designation</Label><Input value={newUser.designation} onChange={e => setNewUser(p => ({ ...p, designation: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Department</Label><Input value={newUser.department} onChange={e => setNewUser(p => ({ ...p, department: e.target.value }))} /></div>
                    <Button onClick={addUser} className="w-full">Add User</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
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
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roles.map(r => (
              <Card key={r.name} className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <r.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{r.name}</CardTitle>
                      <CardDescription className="text-xs">{r.desc}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {r.permissions.map(p => (
                      <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
