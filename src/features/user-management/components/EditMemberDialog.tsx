import type { AppUser } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type EditMemberDialogProps = {
  editingMember: AppUser;
  onEditMemberChange: (value: AppUser | null) => void;
  onSave: () => void;
};

export default function EditMemberDialog({ editingMember, onEditMemberChange, onSave }: EditMemberDialogProps) {
  return (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>Edit Member</DialogTitle>
        <DialogDescription>Update member details and save them immediately.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="edit-name">Full Name</Label>
          <Input id="edit-name" value={editingMember.name} onChange={(event) => onEditMemberChange({ ...editingMember, name: event.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" value={editingMember.email} onChange={(event) => onEditMemberChange({ ...editingMember, email: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input id="edit-phone" value={editingMember.phone || ""} onChange={(event) => onEditMemberChange({ ...editingMember, phone: event.target.value })} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-designation">Designation</Label>
            <Input id="edit-designation" value={editingMember.designation} onChange={(event) => onEditMemberChange({ ...editingMember, designation: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-department">Department</Label>
            <Input id="edit-department" value={editingMember.department} onChange={(event) => onEditMemberChange({ ...editingMember, department: event.target.value })} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={editingMember.role} onValueChange={(value) => onEditMemberChange({ ...editingMember, role: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Manager">Manager</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Signatory">Signatory</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={editingMember.status ?? "Active"}
              onValueChange={(value) => onEditMemberChange({ ...editingMember, status: value as AppUser["status"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onEditMemberChange(null)}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={!editingMember.name.trim() || !editingMember.email.trim()}>
          Save Changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
