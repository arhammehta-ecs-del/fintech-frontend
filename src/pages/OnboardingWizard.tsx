import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext, Signatory } from "@/contexts/AppContext";
import { createCompanyOnboarding, type OnboardingPayload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, Pencil, Plus, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = ["Group Company", "Company Details", "New Signatory", "Preview & Submit"];

const normalizeCodeNamePart = (value: string, fallback: string) => {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (normalized || fallback).slice(0, 8).padEnd(8, "X");
};

const formatCodeDatePart = (date: Date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
};

const formatDisplayDate = (value: string) => {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

const getTodayDateInputValue = () => new Date().toISOString().slice(0, 10);

// const generateGroupCode = (groupName: string, onboardingDate: Date) =>
//   `${normalizeCodeNamePart(groupName, "GROUP")}${formatCodeDatePart(onboardingDate)}`;

// const generateCompanyCode = (companyName: string, onboardingDate: Date) =>
//   `${normalizeCodeNamePart(companyName, "COMPANY")}${formatCodeDatePart(onboardingDate)}`;

type GroupSelectionMode = "new" | "existing" | "not_applicable";

type SignatoryWithId = Signatory & { id: string };

type SignatoryForm = SignatoryWithId & {
  employeeId: string;
  source: "new" | "existing";
};

const emptySignatoryForm = {
  fullName: "",
  designation: "",
  email: "",
  phone: "",
  employeeId: "",
} satisfies Omit<SignatoryForm, "id" | "source">;

export default function OnboardingWizard() {
  return <OnboardingWizardContent />;
}

type OnboardingWizardContentProps = {
  embedded?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function OnboardingWizardContent({
  embedded = false,
  open = true,
  onOpenChange,
}: OnboardingWizardContentProps = {}) {
  const { groups } = useAppContext();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onboardingDate] = useState(() => new Date());
  const todayDateInputValue = useMemo(() => getTodayDateInputValue(), []);
  const [groupSelectionMode, setGroupSelectionMode] = useState<GroupSelectionMode>("new");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedExistingCompanyId, setSelectedExistingCompanyId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [incDate, setIncDate] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [gstDocumentName, setGstDocumentName] = useState("");
  const [gstDocumentFile, setGstDocumentFile] = useState<File | null>(null);
  const [isGstPreviewOpen, setIsGstPreviewOpen] = useState(false);
  const [gstPreviewUrl, setGstPreviewUrl] = useState("");
  const [gstPreviewMimeType, setGstPreviewMimeType] = useState("");
  const [ieCode, setIeCode] = useState("");
  const [signatories, setSignatories] = useState<SignatoryForm[]>([]);
  const [linkedSigIds, setLinkedSigIds] = useState<Set<string>>(new Set());
  const [editingSignatoryIds, setEditingSignatoryIds] = useState<Set<string>>(new Set());
  const [signatoryToRemove, setSignatoryToRemove] = useState<SignatoryForm | null>(null);
  const [showNewSignatoryForm, setShowNewSignatoryForm] = useState(false);
  const [newSig, setNewSig] = useState(emptySignatoryForm);
  const [newSigErrors, setNewSigErrors] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedGroupData = groups.find((group) => group.id === selectedGroupId);
  const selectedExistingCompany =
    selectedGroupData?.subsidiaries.find((company) => company.id === selectedExistingCompanyId) ?? null;
  const isExistingGroup = groupSelectionMode === "existing";

  const existingSignatories: SignatoryWithId[] = useMemo(
    () =>
      selectedGroupData
        ? selectedGroupData.subsidiaries
            .flatMap((subsidiary) => subsidiary.signatories)
            .filter((sig, index, items) => items.findIndex((item) => item.email === sig.email) === index)
            .map((sig) => ({
              ...sig,
              id: (sig as { id?: string }).id ?? sig.email,
            }))
        : [],
    [selectedGroupData],
  );

  const totalSignatories = signatories.length;
  // const generatedGroupCode = generateGroupCode(
  //   groupSelectionMode === "existing" ? selectedGroupData?.groupName ?? "" : groupName.trim(),
  //   onboardingDate,
  // );
  const resolvedGroupCode = groupSelectionMode === "existing" ? selectedGroupData?.code ?? "" : "";
  const generatedCompanyCode = "";

  const handleGroupModeChange = (value: GroupSelectionMode) => {
    setGroupSelectionMode(value);
    setSelectedGroupId("");
    setSelectedExistingCompanyId("");
    setLinkedSigIds(new Set());
    setEditingSignatoryIds(new Set());
    setSignatories([]);

    if (value === "not_applicable") {
      setGroupName("Not applicable");
    } else if (groupName === "Not applicable") {
      setGroupName("");
    }
  };

  const handleGroupSelection = (value: string) => {
    setSelectedGroupId(value);
    setSelectedExistingCompanyId("");
    setLinkedSigIds(new Set());
    setEditingSignatoryIds(new Set());
    setSignatories([]);
  };

  const toggleLinkedSig = (sig: SignatoryWithId) => {
    setLinkedSigIds((previous) => {
      const next = new Set(previous);

      if (next.has(sig.id)) {
        next.delete(sig.id);
        setSignatories((current) => current.filter((item) => item.id !== sig.id));
        setEditingSignatoryIds((current) => {
          const nextEditing = new Set(current);
          nextEditing.delete(sig.id);
          return nextEditing;
        });
      } else {
        next.add(sig.id);
        setSignatories((current) => [
          ...current,
          {
            ...sig,
            employeeId: "",
            source: "existing",
          },
        ]);
      }

      return next;
    });
  };

  const updateSignatory = (id: string, key: keyof SignatoryForm, value: string) => {
    setSignatories((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const toggleSignatoryEditing = (id: string) => {
    setEditingSignatoryIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const validateStep = () => {
    const nextErrors: Record<string, string> = {};

    if (step === 0) {
      if (groupSelectionMode === "new") {
        if (!groupName.trim()) nextErrors.groupName = "Required";
      } else if (groupSelectionMode === "existing") {
        if (!selectedGroupId) nextErrors.selectedGroupId = "Select a group";
      }
    } else if (step === 1) {
      if (!legalName.trim()) nextErrors.legalName = "Required";
      if (!companyName.trim()) nextErrors.companyName = "Required";
      if (!gstin.trim()) nextErrors.gstin = "Required";
      if (!gstDocumentFile) nextErrors.gstDocument = "Required";
      if (!ieCode.trim()) nextErrors.ieCode = "Required";
      if (!incDate.trim()) nextErrors.incDate = "Required";
      else if (incDate > todayDateInputValue) nextErrors.incDate = "Date cannot be later than today";
      if (!address.trim()) nextErrors.address = "Required";
    } else if (step === 2) {
      if (totalSignatories < 2) {
        nextErrors.signatories = "Minimum 2 signatories required";
      } else if (totalSignatories > 3) {
        nextErrors.signatories = "You can add a maximum of 3 signatories";
      }

      signatories.forEach((sig, index) => {
        const prefix = `signatory-${index}`;
        if (!sig.fullName.trim()) nextErrors[`${prefix}-fullName`] = "Name is required";
        if (!sig.email.trim()) nextErrors[`${prefix}-email`] = "Email is required";
        if (!sig.phone.trim()) nextErrors[`${prefix}-phone`] = "Phone is required";
        if (!sig.designation.trim()) nextErrors[`${prefix}-designation`] = "Designation is required";
      });
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const next = () => {
    if (validateStep()) {
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }
  };

  const prev = () => setStep((current) => Math.max(current - 1, 0));

  const addSignatory = () => {
    if (signatories.length >= 3) {
      toast({
        title: "Limit reached",
        description: "You can add a maximum of 3 signatories.",
        variant: "destructive",
      });
      return;
    }

    const nextErrors: Record<string, string> = {};
    if (!newSig.fullName.trim()) nextErrors.fullName = "Required";
    if (!newSig.email.trim()) nextErrors.email = "Required";
    if (!newSig.phone.trim()) nextErrors.phone = "Required";
    if (!newSig.designation.trim()) nextErrors.designation = "Required";

    if (Object.keys(nextErrors).length > 0) {
      setNewSigErrors(nextErrors);
      return;
    }

    setSignatories((current) => [
      ...current,
      {
        ...newSig,
        id: crypto.randomUUID(),
        source: "new",
      },
    ]);
    setNewSig(emptySignatoryForm);
    setNewSigErrors({});
    setShowNewSignatoryForm(false);
  };

  const removeSignatory = (id: string) => {
    setSignatories((current) => current.filter((item) => item.id !== id));
    setLinkedSigIds((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
    setEditingSignatoryIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const buildPayload = (): OnboardingPayload => ({
    group: {
      name:
        groupSelectionMode === "existing"
          ? selectedGroupData?.groupName ?? ""
          : groupSelectionMode === "not_applicable"
            ? "Not applicable"
            : groupName.trim(),
      groupCode: resolvedGroupCode,
      remarks: remarks.trim(),
    },
    company: {
      companyCode: generatedCompanyCode,
      name: legalName.trim().toUpperCase(),
      gst: gstin.trim(),
      brand: companyName.trim(),
      ieCode: ieCode.trim(),
      incorporationDate: incDate,
      address: address.trim(),
    },
    signatories: signatories.map((sig) => ({
      name: sig.fullName.trim(),
      email: sig.email.trim(),
      phone: sig.phone.trim(),
      designation: sig.designation.trim(),
      employeeId: sig.employeeId.trim(),
    })),
  });

  const handleSubmit = async () => {
    if (!validateStep()) return;

    const payload = buildPayload();
    setIsSubmitting(true);

    try {
      const response = await createCompanyOnboarding(payload, gstDocumentFile);
      toast({
        title: "Onboarding submitted",
        description: response.message || "The onboarding request was submitted successfully.",
      });
      if (embedded) {
        onOpenChange?.(false);
      } else {
        navigate("/corporates");
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : "Unable to submit onboarding request.";
      toast({
        title: "Submission failed",
        description,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseGstPreview = () => {
    setIsGstPreviewOpen(false);

    if (gstPreviewUrl) {
      URL.revokeObjectURL(gstPreviewUrl);
      setGstPreviewUrl("");
    }
    setGstPreviewMimeType("");
  };

  const handlePreviewGstDocument = () => {
    if (!gstDocumentFile) return;

    if (gstPreviewUrl) {
      URL.revokeObjectURL(gstPreviewUrl);
    }

    const objectUrl = URL.createObjectURL(gstDocumentFile);
    setGstPreviewUrl(objectUrl);
    setGstPreviewMimeType(gstDocumentFile.type || "");
    setIsGstPreviewOpen(true);
  };

  useEffect(() => {
    return () => {
      if (gstPreviewUrl) {
        URL.revokeObjectURL(gstPreviewUrl);
      }
    };
  }, [gstPreviewUrl]);

  const payloadPreview = buildPayload();
  const isGstImagePreview = gstPreviewMimeType.startsWith("image/");
  const isGstPdfPreview =
    gstPreviewMimeType === "application/pdf" || gstDocumentName.toLowerCase().endsWith(".pdf");
  const content = (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">New Onboarding</h1>
        <p className="mt-1 text-sm text-muted-foreground">Complete the steps below to onboard a new company</p>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-[36rem] items-center gap-2 sm:min-w-0">
          {steps.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  index <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {index < step ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className={cn("hidden text-xs font-medium sm:block", index <= step ? "text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
              {index < steps.length - 1 && <div className={cn("h-px flex-1", index < step ? "bg-primary" : "bg-border")} />}
            </div>
          ))}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="pt-6">
          {step === 0 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label>Group Option</Label>
                <Select value={groupSelectionMode} onValueChange={handleGroupModeChange}>
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
                    <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} />
                    {errors.groupName && <p className="text-sm text-destructive">{errors.groupName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Remarks</Label>
                    <Textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Enter remarks" />
                  </div>
                </div>
              ) : null}

              {groupSelectionMode === "existing" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Group</Label>
                    <Select value={selectedGroupId} onValueChange={handleGroupSelection}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.groupName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.selectedGroupId && <p className="text-sm text-destructive">{errors.selectedGroupId}</p>}
                  </div>

                  {selectedGroupData ? (
                    <p className="text-sm text-muted-foreground">A new company will be onboarded under the selected group.</p>
                  ) : null}

                  <div className="space-y-2">
                    <Label>Remarks</Label>
                    <Textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Enter remarks" />
                  </div>
                </div>
              ) : null}

              {groupSelectionMode === "not_applicable" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Group Name</Label>
                    <Input value="Not applicable" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Remarks</Label>
                    <Textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Enter remarks" />
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-right-4 duration-300 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Legal Name</Label>
                <Input value={legalName} onChange={(event) => setLegalName(event.target.value.toUpperCase())} />
                {errors.legalName && <p className="text-sm text-destructive">{errors.legalName}</p>}
              </div>
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
                {errors.companyName && <p className="text-sm text-destructive">{errors.companyName}</p>}
              </div>
              <div className="space-y-2">
                <Label>IE Code</Label>
                <Input value={ieCode} onChange={(event) => setIeCode(event.target.value)} />
                {errors.ieCode && <p className="text-sm text-destructive">{errors.ieCode}</p>}
              </div>
              <div className="space-y-2">
                <Label>Incorporation Date</Label>
                <Input type="date" value={incDate} max={todayDateInputValue} onChange={(event) => setIncDate(event.target.value)} />
                {errors.incDate && <p className="text-sm text-destructive">{errors.incDate}</p>}
              </div>
              <div className="space-y-2">
                <Label>GST</Label>
                <Input value={gstin} onChange={(event) => setGstin(event.target.value)} />
                {errors.gstin && <p className="text-sm text-destructive">{errors.gstin}</p>}
                <div className="space-y-2 pt-1">
                  <Label htmlFor="gstDocument">Upload Company GST</Label>
                  <input
                    id="gstDocument"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setGstDocumentFile(file);
                      setGstDocumentName(file?.name ?? "");
                      setErrors((current) => {
                        const next = { ...current };
                        delete next.gstDocument;
                        return next;
                      });
                    }}
                  />
                  <label
                    htmlFor="gstDocument"
                    className="flex min-h-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center transition-colors hover:border-primary/50 hover:bg-slate-100"
                  >
                    <span className="text-xs text-slate-500">
                      {gstDocumentName || "Click to choose image/document or drag here"}
                    </span>
                  </label>
                  <p className="text-center text-xs font-medium text-primary">+ Add New Attachment</p>
                  {errors.gstDocument && <p className="text-sm text-destructive">{errors.gstDocument}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea className="min-h-48 resize" value={address} onChange={(event) => setAddress(event.target.value)} />
                {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Label>New Signatory</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 self-start"
                  disabled={signatories.length >= 3}
                  onClick={() => {
                    setShowNewSignatoryForm(true);
                    setNewSigErrors({});
                  }}
                >
                  <Plus className="h-3 w-3" /> Add Signatory
                </Button>
              </div>

              {showNewSignatoryForm ? (
                <Card className="p-4 shadow-sm">
                  <div className="mb-3 text-sm font-semibold text-foreground">Add Signatory</div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={newSig.fullName}
                        onChange={(event) => {
                          setNewSig((current) => ({ ...current, fullName: event.target.value }));
                          setNewSigErrors((current) => ({ ...current, fullName: "" }));
                        }}
                      />
                      {newSigErrors.fullName && <p className="text-sm text-destructive">{newSigErrors.fullName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newSig.email}
                        onChange={(event) => {
                          setNewSig((current) => ({ ...current, email: event.target.value }));
                          setNewSigErrors((current) => ({ ...current, email: "" }));
                        }}
                      />
                      {newSigErrors.email && <p className="text-sm text-destructive">{newSigErrors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={newSig.phone}
                        onChange={(event) => {
                          setNewSig((current) => ({ ...current, phone: event.target.value }));
                          setNewSigErrors((current) => ({ ...current, phone: "" }));
                        }}
                      />
                      {newSigErrors.phone && <p className="text-sm text-destructive">{newSigErrors.phone}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Designation</Label>
                      <Input
                        value={newSig.designation}
                        onChange={(event) => {
                          setNewSig((current) => ({ ...current, designation: event.target.value }));
                          setNewSigErrors((current) => ({ ...current, designation: "" }));
                        }}
                      />
                      {newSigErrors.designation && <p className="text-sm text-destructive">{newSigErrors.designation}</p>}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Employee ID</Label>
                      <Input value={newSig.employeeId} onChange={(event) => setNewSig((current) => ({ ...current, employeeId: event.target.value }))} />
                    </div>
                    <div className="flex gap-2 sm:col-span-2">
                      <Button onClick={addSignatory} className="w-full sm:w-auto">
                        Add Signatory
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setShowNewSignatoryForm(false);
                          setNewSigErrors({});
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : null}

              {errors.signatories && (totalSignatories < 2 || totalSignatories > 3) ? <p className="text-sm text-destructive">{errors.signatories}</p> : null}

              {isExistingGroup && existingSignatories.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Existing Signatories from Group</Label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {existingSignatories.map((sig) => (
                      <Card
                        key={sig.id}
                        className={cn(
                          "cursor-pointer border-2 p-4 transition-colors",
                          linkedSigIds.has(sig.id) ? "border-primary bg-primary/5" : "border-transparent",
                        )}
                        onClick={() => toggleLinkedSig(sig)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={linkedSigIds.has(sig.id)}
                            onClick={(event) => event.stopPropagation()}
                            onCheckedChange={() => toggleLinkedSig(sig)}
                          />
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{sig.fullName}</p>
                            <p className="text-xs text-muted-foreground">
                              {sig.designation || "Signatory"} · {sig.email}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : null}

              {signatories.length > 0 ? (
                <div className="space-y-3">
                  {signatories.map((sig, index) => (
                    <Card key={sig.id} className="p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{sig.fullName || `Signatory ${index + 1}`}</p>
                          {sig.source === "existing" ? <p className="text-xs text-muted-foreground">Existing group signatory</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => toggleSignatoryEditing(sig.id)} className="text-muted-foreground hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => setSignatoryToRemove(sig)} className="text-muted-foreground hover:text-destructive">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {editingSignatoryIds.has(sig.id) ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={sig.fullName} onChange={(event) => updateSignatory(sig.id, "fullName", event.target.value)} />
                            {errors[`signatory-${index}-fullName`] && <p className="text-sm text-destructive">{errors[`signatory-${index}-fullName`]}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input value={sig.email} onChange={(event) => updateSignatory(sig.id, "email", event.target.value)} />
                            {errors[`signatory-${index}-email`] && <p className="text-sm text-destructive">{errors[`signatory-${index}-email`]}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input value={sig.phone} onChange={(event) => updateSignatory(sig.id, "phone", event.target.value)} />
                            {errors[`signatory-${index}-phone`] && <p className="text-sm text-destructive">{errors[`signatory-${index}-phone`]}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label>Designation</Label>
                            <Input value={sig.designation} onChange={(event) => updateSignatory(sig.id, "designation", event.target.value)} />
                            {errors[`signatory-${index}-designation`] && <p className="text-sm text-destructive">{errors[`signatory-${index}-designation`]}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label>Employee ID</Label>
                            <Input value={sig.employeeId} onChange={(event) => updateSignatory(sig.id, "employeeId", event.target.value)} />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                          <p className="text-sm text-foreground">
                            <span className="font-medium tracking-wide text-slate-500">Name:</span>{" "}
                            <span className="font-semibold text-slate-900">{sig.fullName}</span>
                          </p>
                          <p className="min-w-0 text-sm text-foreground">
                            <span className="font-medium tracking-wide text-slate-500">Email:</span>{" "}
                            <span className="break-all font-semibold text-slate-900">{sig.email}</span>
                          </p>
                          <p className="text-sm text-foreground">
                            <span className="font-medium tracking-wide text-slate-500">Phone:</span>{" "}
                            <span className="font-semibold text-slate-900">{sig.phone}</span>
                          </p>
                          <p className="text-sm text-foreground">
                            <span className="font-medium tracking-wide text-slate-500">Designation:</span>{" "}
                            <span className="font-semibold text-slate-900">{sig.designation}</span>
                          </p>
                          {sig.employeeId.trim() ? (
                            <p className="text-sm text-foreground sm:col-span-2">
                              <span className="font-medium tracking-wide text-slate-500">Employee ID:</span>{" "}
                              <span className="font-semibold text-slate-900">{sig.employeeId}</span>
                            </p>
                          ) : null}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">No signatories added yet. Minimum 2 signatories required.</div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-4">
                  <Card className="p-4">
                    <h3 className="mb-3 inline-block border-b border-slate-300 pb-1 text-sm font-semibold text-slate-700">Group Details</h3>
                    <div className="space-y-1.5 text-sm text-foreground">
                      <p>
                        <span className="font-medium tracking-wide text-slate-500">Group Name:</span>{" "}
                        <span className="font-semibold text-slate-900">{payloadPreview.group.name || "-"}</span>
                      </p>
                      {/* {payloadPreview.group.groupCode ? (
                        <p>
                          <span className="font-medium tracking-wide text-slate-500">Group Code:</span>{" "}
                          <span className="font-semibold text-slate-900">{payloadPreview.group.groupCode}</span>
                        </p>
                      ) : null} */}
                      {payloadPreview.group.remarks ? (
                        <p>
                          <span className="font-medium tracking-wide text-slate-500">Remarks:</span>{" "}
                          <span className="font-semibold text-slate-900">{payloadPreview.group.remarks}</span>
                        </p>
                      ) : null}
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h3 className="mb-3 inline-block border-b border-slate-300 pb-1 text-sm font-semibold text-slate-700">Company Details</h3>
                    <div className="space-y-1.5 text-sm text-foreground">
                      {/* <p className="flex items-start gap-1">
                        <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">Company Code</span>
                        <span className="font-medium tracking-wide text-slate-500">:</span>
                        <span className="font-semibold text-slate-900">{payloadPreview.company.companyCode}</span>
                      </p> */}
                      <p className="flex items-start gap-1">
                        <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">Legal Name</span>
                        <span className="font-medium tracking-wide text-slate-500">:</span>
                        <span className="font-semibold text-slate-900">{payloadPreview.company.name}</span>
                      </p>
                      <p className="flex items-start gap-1">
                        <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">Company Name</span>
                        <span className="font-medium tracking-wide text-slate-500">:</span>
                        <span className="font-semibold text-slate-900">{payloadPreview.company.brand}</span>
                      </p>
                      <p className="flex items-start gap-1">
                        <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">GST</span>
                        <span className="font-medium tracking-wide text-slate-500">:</span>
                        <span className="font-semibold text-slate-900">{payloadPreview.company.gst}</span>
                      </p>
                      <p className="flex items-start gap-1">
                        <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">GST Document</span>
                        <span className="font-medium tracking-wide text-slate-500">:</span>
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="break-all font-semibold text-slate-900">{gstDocumentName || "-"}</span>
                          {gstDocumentFile ? (
                            <button
                              type="button"
                              onClick={handlePreviewGstDocument}
                              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                            >
                              Preview
                            </button>
                          ) : null}
                        </span>
                      </p>
                      <p className="flex items-start gap-1">
                        <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">IE Code</span>
                        <span className="font-medium tracking-wide text-slate-500">:</span>
                        <span className="font-semibold text-slate-900">{payloadPreview.company.ieCode}</span>
                      </p>
                      <p className="flex items-start gap-1">
                        <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">Incorporation Date</span>
                        <span className="font-medium tracking-wide text-slate-500">:</span>
                        <span className="font-semibold text-slate-900">{formatDisplayDate(payloadPreview.company.incorporationDate)}</span>
                      </p>
                      <p className="flex items-start gap-1">
                        <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">Address</span>
                        <span className="font-medium tracking-wide text-slate-500">:</span>
                        <span className="font-semibold text-slate-900">{payloadPreview.company.address}</span>
                      </p>
                    </div>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="inline-block border-b border-slate-300 pb-1 text-sm font-semibold text-slate-700">New Signatory</h3>
                    </div>
                    <div className="space-y-3">
                      {payloadPreview.signatories.map((sig, index) => (
                        <div key={`${sig.email}-${sig.name}`} className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Signatory {index + 1}</p>
                          <div className="grid grid-cols-1 gap-y-1.5 text-sm text-foreground sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] sm:gap-x-4">
                            <p className="min-w-0">
                              <span className="font-medium tracking-wide text-slate-500">Name:</span>{" "}
                              <span className="font-semibold text-slate-900">{sig.name}</span>
                            </p>
                            <p className="min-w-0">
                              <span className="font-medium tracking-wide text-slate-500">Email:</span>{" "}
                              <span className="break-all font-semibold text-slate-900">{sig.email}</span>
                            </p>
                            <p className="min-w-0">
                              <span className="font-medium tracking-wide text-slate-500">Phone:</span>{" "}
                              <span className="font-semibold text-slate-900">{sig.phone}</span>
                            </p>
                            <p className="min-w-0">
                              <span className="font-medium tracking-wide text-slate-500">Designation:</span>{" "}
                              <span className="font-semibold text-slate-900">{sig.designation}</span>
                            </p>
                            {sig.employeeId ? (
                              <p className="min-w-0 sm:col-span-2">
                                <span className="font-medium tracking-wide text-slate-500">Employee ID:</span>{" "}
                                <span className="font-semibold text-slate-900">{sig.employeeId}</span>
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>

              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                Status: Not Submitted
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" className="w-full sm:w-auto" onClick={step === 0 ? () => navigate(-1) : prev} disabled={isSubmitting}>
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        {step < steps.length - 1 ? (
          <Button className="w-full sm:w-auto" onClick={next}>
            Continue
          </Button>
        ) : (
          <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        )}
      </div>

      <AlertDialog open={Boolean(signatoryToRemove)} onOpenChange={(open) => !open && setSignatoryToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Signatory</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to remove the signatory?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (signatoryToRemove) {
                  removeSignatory(signatoryToRemove.id);
                }
                setSignatoryToRemove(null);
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isGstPreviewOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleCloseGstPreview();
          }
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-hidden p-0">
          <div className="border-b border-slate-200 px-4 py-3">
            <DialogTitle className="text-base text-slate-900">GST Document Preview</DialogTitle>
            <p className="mt-1 truncate text-sm text-slate-500">{gstDocumentName || "GST document"}</p>
          </div>

          <div className="h-[72vh] bg-slate-50 p-3">
            {gstPreviewUrl ? (
              isGstImagePreview ? (
                <img src={gstPreviewUrl} alt={gstDocumentName || "GST document"} className="h-full w-full rounded-md object-contain" />
              ) : isGstPdfPreview ? (
                <iframe src={gstPreviewUrl} title="GST document preview" className="h-full w-full rounded-md border border-slate-200 bg-white" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-slate-300 bg-white p-4 text-center">
                  <p className="text-sm text-slate-600">Preview is not available for this file type.</p>
                  <a href={gstPreviewUrl} download={gstDocumentName || "gst-document"} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
                    Download File
                  </a>
                </div>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (!embedded) {
    return content;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange?.(nextOpen);
      }}
    >
      <DialogContent className="flex h-[100dvh] w-[100vw] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[88vh] sm:w-[min(95vw,72rem)] sm:max-w-[72rem] sm:rounded-lg">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
