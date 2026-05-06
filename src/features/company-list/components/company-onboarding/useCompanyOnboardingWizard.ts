import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GroupCompany } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { createCompanyOnboarding, getAllCompanies, type OnboardingPayload } from "@/services/company.service";
import type { GroupSelectionMode, CompanyOnboardingWizardContentProps, SignatoryForm, SignatoryWithId } from "./types";
import { emptySignatoryForm, getTodayDateInputValue, companyOnboardingSteps } from "./utils";

export function useCompanyOnboardingWizard({
  embedded = false,
  open = true,
  onOpenChange,
  onSubmitted,
}: CompanyOnboardingWizardContentProps = {}) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [groups, setGroups] = useState<GroupCompany[]>([]);
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const todayDateInputValue = useMemo(() => getTodayDateInputValue(), []);
  const [groupSelectionMode, setGroupSelectionMode] = useState<GroupSelectionMode>("");
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
  const [editingSignatoryDrafts, setEditingSignatoryDrafts] = useState<Record<string, SignatoryForm>>({});
  const [signatoryToRemove, setSignatoryToRemove] = useState<SignatoryForm | null>(null);
  const [showNewSignatoryForm, setShowNewSignatoryForm] = useState(false);
  const [newSig, setNewSig] = useState(emptySignatoryForm);
  const [newSigErrors, setNewSigErrors] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [signatoryValidationAttempted, setSignatoryValidationAttempted] = useState(false);

  const resetWizardState = () => {
    setStep(0);
    setIsSubmitting(false);
    setGroupSelectionMode("");
    setSelectedGroupLocalId("");
    setGroupName("");
    setRemarks("");
    setCompanyName("");
    setLegalName("");
    setIncDate("");
    setAddress("");
    setGstin("");
    setGstDocumentName("");
    setGstDocumentFile(null);
    setIsGstPreviewOpen(false);
    setGstPreviewUrl("");
    setGstPreviewMimeType("");
    setIeCode("");
    setSignatories([]);
    setLinkedSigIds(new Set());
    setEditingSignatoryIds(new Set());
    setEditingSignatoryDrafts({});
    setSignatoryToRemove(null);
    setShowNewSignatoryForm(false);
    setNewSig(emptySignatoryForm);
    setNewSigErrors({});
    setErrors({});
    setSignatoryValidationAttempted(false);
  };

  useEffect(() => {
    if (!open) return;
    resetWizardState();
  }, [open]);

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
    setEditingSignatoryDrafts({});
    setSignatories([]);

    if (value === "not_applicable") {
      setGroupName("Independent");
    } else if (value === "") {
      setGroupName("");
    } else if (groupName === "Independent") {
      setGroupName("");
    }
  };

  const handleGroupSelection = (value: string) => {
    setSelectedGroupLocalId(value);
    setLinkedSigIds(new Set());
    setEditingSignatoryIds(new Set());
    setEditingSignatoryDrafts({});
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
        setEditingSignatoryDrafts((current) => {
          if (!current[sig.id]) return current;
          const next = { ...current };
          delete next[sig.id];
          return next;
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

  const startSignatoryEditing = (id: string) => {
    const target = signatories.find((item) => item.id === id);
    if (!target) return;

    setEditingSignatoryIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    setEditingSignatoryDrafts((current) => ({ ...current, [id]: { ...target } }));
  };

  const updateSignatoryDraft = (id: string, key: keyof SignatoryForm, value: string) => {
    setEditingSignatoryDrafts((current) => {
      const draft = current[id];
      if (!draft) return current;
      return { ...current, [id]: { ...draft, [key]: value } };
    });
  };

  const cancelSignatoryEditing = (id: string) => {
    setEditingSignatoryIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setEditingSignatoryDrafts((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const saveSignatoryEditing = (id: string) => {
    const draft = editingSignatoryDrafts[id];
    if (!draft) return;

    setSignatories((current) => current.map((item) => (item.id === id ? { ...draft } : item)));
    cancelSignatoryEditing(id);
  };

  const validateStep = () => {
    const nextErrors: Record<string, string> = {};

    if (step === 0) {
      if (!groupSelectionMode) nextErrors.groupSelectionMode = "Select a group option";
      if (groupSelectionMode === "new") {
        if (!groupName.trim()) nextErrors.groupName = "Required";
      } else if (groupSelectionMode === "existing") {
        if (!selectedGroupId) nextErrors.selectedGroupId = "Select a group";
      }
    } else if (step === 1) {
      if (!legalName.trim()) nextErrors.legalName = "Required";
      if (!gstin.trim()) nextErrors.gstin = "Required";
      if (!incDate.trim()) nextErrors.incDate = "Required";
      else if (incDate > todayDateInputValue) nextErrors.incDate = "Date cannot be later than today";
      if (!address.trim()) nextErrors.address = "Required";
    } else if (step === 2) {
      setSignatoryValidationAttempted(true);
      if (totalSignatories < 2) nextErrors.signatories = "Minimum 2 signatories required";
      else if (totalSignatories > 3) nextErrors.signatories = "You can add a maximum of 3 signatories";

      const duplicateIndices = new Set<number>();
      const emailIndexMap = new Map<string, number[]>();
      const phoneIndexMap = new Map<string, number[]>();

      signatories.forEach((sig, index) => {
        const emailKey = sig.email.trim().toLowerCase();
        const phoneKey = sig.phone.replace(/\D/g, "");

        if (emailKey) {
          const existing = emailIndexMap.get(emailKey) ?? [];
          existing.push(index);
          emailIndexMap.set(emailKey, existing);
        }

        if (phoneKey) {
          const existing = phoneIndexMap.get(phoneKey) ?? [];
          existing.push(index);
          phoneIndexMap.set(phoneKey, existing);
        }
      });

      emailIndexMap.forEach((indices) => {
        if (indices.length > 1) {
          indices.forEach((index) => duplicateIndices.add(index));
        }
      });

      phoneIndexMap.forEach((indices) => {
        if (indices.length > 1) {
          indices.forEach((index) => duplicateIndices.add(index));
        }
      });

      if (duplicateIndices.size > 0) {
        nextErrors.signatories = "Details can't be same";
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
    setSignatoryValidationAttempted(false);
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
    setEditingSignatoryDrafts((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setSignatoryValidationAttempted(false);
  };

  const buildPayload = (): OnboardingPayload => {
    const isIndependent = groupSelectionMode === "not_applicable";

    return {
      group: isIndependent
        ? { name: "Independent", groupCode: null, remarks: "" }
        : {
            name:
              groupSelectionMode === "existing"
                ? selectedGroupData?.groupName ?? ""
                : groupName.trim(),
            groupCode: resolvedGroupCode || null,
            remarks: remarks.trim(),
          },
      company: {
        name: legalName.trim().toUpperCase(),
        gst: gstin.trim().toUpperCase(),
        brand: companyName.trim() ? companyName.trim() : null,
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
    };
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    const payload = buildPayload();
    setIsSubmitting(true);

    try {
      const response = await createCompanyOnboarding(payload, gstDocumentFile);
      await onSubmitted?.();
      toast({
        title: "Onboarding submitted",
        description: response.message || "The onboarding request was submitted successfully.",
      });
      if (embedded) onOpenChange?.(false);
      else navigate("/companies");
    } catch (error) {
      const description = getApiErrorMessage(error, "Unable to submit onboarding request.");
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
    editingSignatoryDrafts,
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
    signatoryValidationAttempted,
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
    startSignatoryEditing,
    updateSignatoryDraft,
    cancelSignatoryEditing,
    saveSignatoryEditing,
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
