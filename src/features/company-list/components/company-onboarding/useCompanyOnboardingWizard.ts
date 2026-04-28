import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GroupCompany } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { createCompanyOnboarding, getAllCompanies, type OnboardingPayload } from "@/services/company.service";
import type { GroupSelectionMode, CompanyOnboardingWizardContentProps, SignatoryForm, SignatoryWithId } from "./types";
import { emptySignatoryForm, getTodayDateInputValue, companyOnboardingSteps } from "./utils";

export function useCompanyOnboardingWizard({
  embedded = false,
  open = true,
  onOpenChange,
}: CompanyOnboardingWizardContentProps = {}) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [groups, setGroups] = useState<GroupCompany[]>([]);
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const todayDateInputValue = useMemo(() => getTodayDateInputValue(), []);
  const [groupSelectionMode, setGroupSelectionMode] = useState<GroupSelectionMode>("new");
  const [selectedGroupId, setSelectedGroupLocalId] = useState("");
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

  useEffect(() => {
    if (embedded && !open) return;

    let ignore = false;

    async function loadGroups() {
      try {
        const companyGroups = await getAllCompanies();
        if (!ignore) {
          setGroups(companyGroups);
        }
      } catch (error) {
        if (!ignore) {
          const statusMatch = error instanceof Error ? error.message.match(/Request failed:\s*(\d{3})/) : null;
          const statusCode = statusMatch ? Number(statusMatch[1]) : null;
          if (statusCode === 401 || statusCode === 403) {
            navigate("/login", { replace: true });
            return;
          }
          setGroups([]);
        }
      }
    }

    void loadGroups();

    return () => {
      ignore = true;
    };
  }, [embedded, navigate, open]);

  const selectedGroupData = groups.find((group) => group.id === selectedGroupId);
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
  const resolvedGroupCode = groupSelectionMode === "existing" ? selectedGroupData?.code ?? "" : "";
  const generatedCompanyCode = "";

  const handleGroupModeChange = (value: GroupSelectionMode) => {
    setGroupSelectionMode(value);
    setSelectedGroupLocalId("");
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
    setSelectedGroupLocalId(value);
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
      if (!ieCode.trim()) nextErrors.ieCode = "Required";
      if (!incDate.trim()) nextErrors.incDate = "Required";
      else if (incDate > todayDateInputValue) nextErrors.incDate = "Date cannot be later than today";
      if (!address.trim()) nextErrors.address = "Required";
    } else if (step === 2) {
      if (totalSignatories < 2) nextErrors.signatories = "Minimum 2 signatories required";
      else if (totalSignatories > 3) nextErrors.signatories = "You can add a maximum of 3 signatories";

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
      setStep((current) => Math.min(current + 1, companyOnboardingSteps.length - 1));
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
      registeredAt: incDate,
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
      if (embedded) onOpenChange?.(false);
      else navigate("/companies");
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
  const isGstPdfPreview = gstPreviewMimeType === "application/pdf" || gstDocumentName.toLowerCase().endsWith(".pdf");

  return {
    groups,
    step,
    setStep,
    isSubmitting,
    groupSelectionMode,
    setGroupSelectionMode,
    selectedGroupId,
    setSelectedGroupLocalId,
    groupName,
    setGroupName,
    remarks,
    setRemarks,
    companyName,
    setCompanyName,
    legalName,
    setLegalName,
    incDate,
    setIncDate,
    address,
    setAddress,
    gstin,
    setGstin,
    gstDocumentName,
    setGstDocumentName,
    gstDocumentFile,
    setGstDocumentFile,
    isGstPreviewOpen,
    setIsGstPreviewOpen,
    gstPreviewUrl,
    gstPreviewMimeType,
    ieCode,
    setIeCode,
    signatories,
    setSignatories,
    linkedSigIds,
    setLinkedSigIds,
    editingSignatoryIds,
    setEditingSignatoryIds,
    signatoryToRemove,
    setSignatoryToRemove,
    showNewSignatoryForm,
    setShowNewSignatoryForm,
    newSig,
    setNewSig,
    newSigErrors,
    setNewSigErrors,
    errors,
    setErrors,
    selectedGroupData,
    isExistingGroup,
    existingSignatories,
    totalSignatories,
    resolvedGroupCode,
    generatedCompanyCode,
    todayDateInputValue,
    payloadPreview,
    isGstImagePreview,
    isGstPdfPreview,
    handleGroupModeChange,
    handleGroupSelection,
    toggleLinkedSig,
    updateSignatory,
    toggleSignatoryEditing,
    validateStep,
    next,
    prev,
    addSignatory,
    removeSignatory,
    buildPayload,
    handleSubmit,
    handleCloseGstPreview,
    handlePreviewGstDocument,
    navigate,
    onOpenChange,
  };
}
