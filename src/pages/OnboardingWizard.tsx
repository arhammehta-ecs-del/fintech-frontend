import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext, Signatory } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, Plus, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = ["Group Company", "Company Details", "Authorized Signatories", "Preview & Submit"];

export default function OnboardingWizard() {
  const { groups } = useAppContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [groupSelectionMode, setGroupSelectionMode] = useState<"new" | "existing" | "not_applicable">("new");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [remarks, setRemarks] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [incDate, setIncDate] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [ieCode, setIeCode] = useState("");
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [linkedSigIds, setLinkedSigIds] = useState<Set<string>>(new Set());
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [newSig, setNewSig] = useState({ fullName: "", designation: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedGroupData = groups.find(g => g.id === selectedGroupId);
  const isNewGroup = groupSelectionMode === "new";
  const isExistingGroup = groupSelectionMode === "existing";
  const existingSignatories: Signatory[] = selectedGroupData
    ? selectedGroupData.subsidiaries.flatMap(s => s.signatories).filter((sig, i, arr) => arr.findIndex(s => s.email === sig.email) === i)
    : [];

  const toggleLinkedSig = (sig: Signatory) => {
    setLinkedSigIds(prev => {
      const next = new Set(prev);
      if (next.has(sig.id)) {
        next.delete(sig.id);
        setSignatories(s => s.filter(x => x.id !== sig.id));
      } else {
        next.add(sig.id);
        setSignatories(s => [...s, sig]);
      }
      return next;
    });
  };

  const totalSignatories = signatories.length;

  const validateStep = () => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (groupSelectionMode === "new") {
        if (!groupName.trim()) e.groupName = "Required";
        if (!groupCode.trim()) e.groupCode = "Required";
      } else if (groupSelectionMode === "existing") {
        if (!selectedGroupId) e.selectedGroupId = "Select a group";
      }
    } else if (step === 1) {
      if (!companyName.trim()) e.companyName = "Required";
      if (!legalName.trim()) e.legalName = "Required";
    } else if (step === 2) {
      if (totalSignatories < 2) e.signatories = "Minimum 2 signatories required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep(s => Math.min(s + 1, 3)); };
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const addSignatory = () => {
    if (!newSig.fullName || !newSig.email) return;
    setSignatories(prev => [...prev, { ...newSig, id: crypto.randomUUID() }]);
    setNewSig({ fullName: "", designation: "", email: "", phone: "" });
    setSigModalOpen(false);
  };

  const removeSignatory = (id: string) => setSignatories(prev => prev.filter(s => s.id !== id));

  const handleSubmit = () => {
    toast({ title: "Submission unavailable", description: "This screen no longer creates local demo data." });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">New Onboarding</h1>
        <p className="text-muted-foreground text-sm mt-1">Complete the steps below to onboard a new company</p>
      </div>

      {/* Stepper */}
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-[36rem] items-center gap-2 sm:min-w-0">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-colors",
              i < step ? "bg-primary text-primary-foreground" :
              i === step ? "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground"
            )}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn("text-xs font-medium hidden sm:block", i <= step ? "text-foreground" : "text-muted-foreground")}>{s}</span>
            {i < steps.length - 1 && <div className={cn("flex-1 h-px", i < step ? "bg-primary" : "bg-border")} />}
          </div>
        ))}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="pt-6">
          {step === 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label>Group Option</Label>
                <Select value={groupSelectionMode} onValueChange={(value: "new" | "existing" | "not_applicable") => setGroupSelectionMode(value)}>
                  <SelectTrigger className="w-full sm:max-w-xs">
                    <SelectValue placeholder="Select group option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New Group</SelectItem>
                    <SelectItem value="existing">Existing Group</SelectItem>
                    <SelectItem value="not_applicable">Not applicable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {groupSelectionMode === "new" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Group Name</Label>
                    <Input value={groupName} onChange={e => setGroupName(e.target.value)} />
                    {errors.groupName && <p className="text-sm text-destructive">{errors.groupName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Group Code</Label>
                    <Input value={groupCode} onChange={e => setGroupCode(e.target.value)} />
                    {errors.groupCode && <p className="text-sm text-destructive">{errors.groupCode}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Remarks</Label>
                    <Input value={remarks} onChange={e => setRemarks(e.target.value)} />
                  </div>
                </div>
              ) : groupSelectionMode === "existing" ? (
                <div className="space-y-2">
                  <Label>Select Group</Label>
                  <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                    <SelectTrigger><SelectValue placeholder="Choose a group" /></SelectTrigger>
                    <SelectContent>
                      {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.groupName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.selectedGroupId && <p className="text-sm text-destructive">{errors.selectedGroupId}</p>}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-5 text-sm text-muted-foreground">
                  No group will be linked for this onboarding request.
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} />
                {errors.companyName && <p className="text-sm text-destructive">{errors.companyName}</p>}
              </div>
              <div className="space-y-2">
                <Label>Legal Name</Label>
                <Input value={legalName} onChange={e => setLegalName(e.target.value)} />
                {errors.legalName && <p className="text-sm text-destructive">{errors.legalName}</p>}
              </div>
              <div className="space-y-2">
                <Label>Incorporation Date</Label>
                <Input type="date" value={incDate} onChange={e => setIncDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>GSTIN</Label>
                <Input value={gstin} onChange={e => setGstin(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>IE Code</Label>
                <Input value={ieCode} onChange={e => setIeCode(e.target.value)} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Label>Authorized Signatories</Label>
                <Dialog open={sigModalOpen} onOpenChange={setSigModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 self-start"><Plus className="h-3 w-3" /> Add Signatory</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add New Signatory</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2"><Label>Full Name</Label><Input value={newSig.fullName} onChange={e => setNewSig(p => ({ ...p, fullName: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Designation</Label><Input value={newSig.designation} onChange={e => setNewSig(p => ({ ...p, designation: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Email</Label><Input type="email" value={newSig.email} onChange={e => setNewSig(p => ({ ...p, email: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Phone</Label><Input value={newSig.phone} onChange={e => setNewSig(p => ({ ...p, phone: e.target.value }))} /></div>
                      <Button onClick={addSignatory} className="w-full">Add Signatory</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              {errors.signatories && <p className="text-sm text-destructive">{errors.signatories}</p>}

              {/* Existing signatories from selected group */}
              {isExistingGroup && existingSignatories.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Existing Signatories from Group</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {existingSignatories.map(s => (
                      <Card key={s.id} className={cn("p-4 shadow-sm cursor-pointer transition-colors border-2", linkedSigIds.has(s.id) ? "border-primary bg-primary/5" : "border-transparent")} onClick={() => toggleLinkedSig(s)}>
                        <div className="flex items-center gap-3">
                          <Checkbox checked={linkedSigIds.has(s.id)} onCheckedChange={() => toggleLinkedSig(s)} />
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{s.fullName}</p>
                            <p className="text-xs text-muted-foreground">{s.designation} · {s.email}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Newly added signatories */}
              {signatories.filter(s => !linkedSigIds.has(s.id)).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Newly Added</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {signatories.filter(s => !linkedSigIds.has(s.id)).map(s => (
                      <Card key={s.id} className="p-4 shadow-sm relative">
                        <button onClick={() => removeSignatory(s.id)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{s.fullName}</p>
                            <p className="text-xs text-muted-foreground">{s.designation} · {s.email}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {totalSignatories === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No signatories added yet. {isExistingGroup && existingSignatories.length > 0 ? "Select from existing or add" : "Add"} at least 2.
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Group</h3>
                <p className="text-sm text-foreground">
                  {groupSelectionMode === "new"
                    ? `${groupName} (${groupCode})`
                    : groupSelectionMode === "existing"
                      ? groups.find(g => g.id === selectedGroupId)?.groupName
                      : "Not applicable"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Company</h3>
                <div className="text-sm text-foreground space-y-1">
                  <p><strong>Name:</strong> {companyName}</p>
                  <p><strong>Legal Name:</strong> {legalName}</p>
                  {incDate && <p><strong>Incorporation:</strong> {incDate}</p>}
                  {address && <p><strong>Address:</strong> {address}</p>}
                  {gstin && <p><strong>GSTIN:</strong> {gstin}</p>}
                  {ieCode && <p><strong>IE Code:</strong> {ieCode}</p>}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Signatories ({signatories.length})</h3>
                <div className="space-y-1">
                  {signatories.map(s => (
                    <p key={s.id} className="text-sm text-foreground">{s.fullName} — {s.designation} ({s.email})</p>
                  ))}
                </div>
              </div>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Status: Pending Approval</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" className="w-full sm:w-auto" onClick={step === 0 ? () => navigate(-1) : prev}>
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        {step < 3 ? (
          <Button className="w-full sm:w-auto" onClick={next}>Continue</Button>
        ) : (
          <Button className="w-full sm:w-auto" onClick={handleSubmit}>Submit</Button>
        )}
      </div>
    </div>
  );
}
