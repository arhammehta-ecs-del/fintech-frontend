import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Briefcase,
  Building2,
  Calendar,
  Check,ChevronRight,Expand,IdCard,
  Mail,
  Minimize2,
  Phone,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppContext, type OrgNode } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";

const steps = ["Basic Details", "Select Node", "Access Rights", "Review and Submit"];

const permissionStructure = {
  transactional: {
    label: "Transactional",
    items: [
      { key: "purchaseOrder", label: "Purchase Order" },
      { key: "payment", label: "Payment" },
      { key: "invoice", label: "Invoice" },
    ],
  },
  operational: {
    label: "Operational",
    items: [{ key: "master", label: "Master Records" }],
  },
  systemAccess: {
    label: "System Access",
    items: [
      { key: "orgStructure", label: "Org Structure" },
      { key: "userManagement", label: "User Management" },
      { key: "workflow", label: "Workflow Config" },
    ],
  },
} as const;

const transactionalItems: TransactionalPermissionItem[] = ["payment", "purchaseOrder", "invoice"];

type PermissionAction = "manager" | "user" | "viewer";
type PermissionCategory = keyof typeof permissionStructure;
type PermissionBucket = Record<PermissionAction, boolean>;
type TransactionalPermissionItem = "purchaseOrder" | "payment" | "invoice";

export type NewMemberPermissions = {
  transactional: {
    purchaseOrder: PermissionBucket;
    payment: PermissionBucket;
    invoice: PermissionBucket;
  };
  operational: {
    master: PermissionBucket;
  };
  systemAccess: {
    orgStructure: PermissionBucket;
    userManagement: PermissionBucket;
    workflow: PermissionBucket;
  };
};

export type NewMemberOnboardingFormData = {
  basic: {
    name: string;
    email: string;
    phone: string;
    onboardingDate: string;
    designation: string;
    employeeId: string;
    reportingManager: string;
  };
  permissions: NewMemberPermissions;
  nodeSelections: Array<{
    nodeId: string;
    nodeName: string;
    nodePath: string;
    permissions: NewMemberPermissions;
  }>;
  transactionalPrimary: TransactionalPermissionItem | null;
};

type NewMemberOnboardingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: NewMemberOnboardingFormData) => void | Promise<void>;
};

const createInitialFormData = (): NewMemberOnboardingFormData => ({
  basic: {
    name: "",
    email: "",
    phone: "",
    onboardingDate: "",
    designation: "",
    employeeId: "",
    reportingManager: "",
  },
  permissions: {
    transactional: {
      purchaseOrder: { manager: false, user: false, viewer: false },
      payment: { manager: false, user: false, viewer: false },
      invoice: { manager: false, user: false, viewer: false },
    },
    operational: {
      master: { manager: false, user: false, viewer: false },
    },
    systemAccess: {
      orgStructure: { manager: false, user: false, viewer: false },
      userManagement: { manager: false, user: false, viewer: false },
      workflow: { manager: false, user: false, viewer: false },
    },
  },
  nodeSelections: [],
  transactionalPrimary: null,
});

const createInitialPermissions = (): NewMemberPermissions => ({
  transactional: {
    purchaseOrder: { manager: false, user: false, viewer: false },
    payment: { manager: false, user: false, viewer: false },
    invoice: { manager: false, user: false, viewer: false },
  },
  operational: {
    master: { manager: false, user: false, viewer: false },
  },
  systemAccess: {
    orgStructure: { manager: false, user: false, viewer: false },
    userManagement: { manager: false, user: false, viewer: false },
    workflow: { manager: false, user: false, viewer: false },
  },
});

const parseSlashDate = (value: string): Date | null => {
  const parts = value.split("/");
  if (parts.length !== 3) return null;

  const [dayText, monthText, yearText] = parts;
  if (dayText.length !== 2 || monthText.length !== 2 || yearText.length !== 4) return null;

  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;

  const date = new Date(year, month - 1, day);
  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return isValid ? date : null;
};

const formatDateLabel = (value: string) => {
  if (!value) return "-";

  const slashDate = parseSlashDate(value);
  if (slashDate) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(slashDate);
  }

  const isoDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(isoDate.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(isoDate);
};

const formatDateWithSlashes = (input: string): string => {
  const cleaned = input.replace(/\D/g, "");
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
};

const slashToIsoDate = (value: string): string => {
  const parsed = parseSlashDate(value);
  if (!parsed) return "";

  const year = String(parsed.getFullYear());
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isoToSlashDate = (value: string): string => {
  const parts = value.split("-");
  if (parts.length !== 3) return "";

  const [year, month, day] = parts;
  if (year.length !== 4 || month.length !== 2 || day.length !== 2) return "";

  const parsed = parseSlashDate(`${day}/${month}/${year}`);
  return parsed ? `${day}/${month}/${year}` : "";
};

const isDateInFuture = (dateString: string): boolean => {
  const date = parseSlashDate(dateString);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
};

type ValidationErrors = Record<string, string>;

const validateStep = (step: number, formData: NewMemberOnboardingFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (step === 1) {
    const { name, email, phone, onboardingDate, designation, employeeId, reportingManager } = formData.basic;

    if (!name.trim()) errors.name = "Required";
    if (!email.trim()) errors.email = "Required";
    if (!phone.trim()) errors.phone = "Required";
    else if (!/^\d{10}$/.test(phone)) errors.phone = "Enter a valid 10-digit phone number";
    if (!onboardingDate.trim()) errors.onboardingDate = "Required";
    if (!designation.trim()) errors.designation = "Required";
    if (!employeeId.trim()) errors.employeeId = "Required";
    if (!reportingManager.trim()) errors.reportingManager = "Required";
  }

  return errors;
};

function InputGroup({
  label,
  icon,
  value,
  onChange,
  type = "text",
  placeholder,
  max,
  maxLength,
  inputMode,
  error,
  
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  max?: string;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  error?: string;
  
}) {
  return (
    <div className="group space-y-1">
      <Label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-primary">{label}</Label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary">
          {icon}
        </div>
        <Input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          max={max}
          maxLength={maxLength}
          inputMode={inputMode}
          className="h-11 w-full border-slate-200 bg-white pl-12 pr-4 placeholder:text-slate-300 focus:border-primary focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder={placeholder}
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col border-b border-slate-200/60 pb-2 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-700">{value || <span className="italic text-slate-300">Not provided</span>}</span>
    </div>
  );
}

function findOrgNode(node: OrgNode | null, nodeId: string): OrgNode | null {
  if (!node) return null;
  if (node.id === nodeId) return node;

  for (const child of node.children) {
    const match = findOrgNode(child, nodeId);
    if (match) return match;
  }

  return null;
}

function getOrgNodeTheme(nodeType: string) {
  const normalized = nodeType.trim().toUpperCase();

  if (normalized === "DIVISION") {
    return {
      edge: "bg-sky-400",
      card: "border-slate-200",
      hover: "hover:border-sky-200 hover:bg-sky-50/40",
      selected: "border-sky-300 bg-sky-50/60 shadow-[0_0_0_4px_rgba(96,165,250,0.08)]",
    };
  }

  if (normalized === "LOCATION") {
    return {
      edge: "bg-emerald-400",
      card: "border-slate-200",
      hover: "hover:border-emerald-200 hover:bg-emerald-50/40",
      selected: "border-emerald-300 bg-emerald-50/60 shadow-[0_0_0_4px_rgba(52,211,153,0.08)]",
    };
  }

  if (normalized === "DEPARTMENT") {
    return {
      edge: "bg-amber-400",
      card: "border-slate-200",
      hover: "hover:border-amber-200 hover:bg-amber-50/40",
      selected: "border-amber-200 bg-amber-50/60 shadow-[0_0_0_4px_rgba(251,191,36,0.08)]",
    };
  }

  if (normalized === "ROOT") {
    return {
      edge: "",
      card: "border border-slate-200",
      hover: "hover:border-slate-300 hover:bg-slate-50",
      selected: "border-slate-300 bg-slate-50 shadow-[0_8px_24px_rgba(15,23,42,0.06)]",
    };
  }

  return {
    edge: "bg-slate-300",
    card: "border-slate-200",
    hover: "hover:border-slate-300 hover:bg-slate-50",
    selected: "border-slate-300 bg-slate-50 shadow-[0_8px_24px_rgba(15,23,42,0.04)]",
  };
}

function getOrgNodeBadgeTheme(nodeType: string) {
  const normalized = nodeType.trim().toUpperCase();

  if (normalized === "DIVISION") {
    return "border border-sky-200 bg-sky-50 text-sky-600";
  }

  if (normalized === "LOCATION") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-600";
  }

  if (normalized === "DEPARTMENT") {
    return "border border-amber-200 bg-amber-50 text-amber-600";
  }

  return "border border-slate-200 bg-slate-50 text-slate-500";
}

function getOrgNodePermissionChipTheme(nodeType: string) {
  const normalized = nodeType.trim().toUpperCase();

  if (normalized === "DIVISION") {
    return "border border-sky-200 bg-sky-100 text-sky-700";
  }

  if (normalized === "LOCATION") {
    return "border border-emerald-200 bg-emerald-100 text-emerald-700";
  }

  if (normalized === "DEPARTMENT") {
    return "border border-amber-200 bg-amber-100 text-amber-700";
  }

  return "border border-slate-200 bg-slate-100 text-slate-600";
}

function OrgNodeTree({
  node,
  selectedNodeId,
  onSelect,
  depth = 0,
}: {
  node: OrgNode;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  depth?: number;
}) {
  const isSelected = selectedNodeId === node.id;
  const theme = getOrgNodeTheme(node.nodeType);
  const isRoot = node.nodeType.trim().toUpperCase() === "ROOT";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "relative flex w-full items-center justify-between overflow-hidden rounded-xl bg-white px-4 py-3 text-left transition-all",
          theme.card,
          isSelected ? theme.selected : cn("border-slate-200", theme.hover),
        )}
        style={{ marginLeft: depth * 16 }}
      >
        {!isRoot ? <span className={cn("absolute left-0 top-[12%] h-[76%] w-[4px] rounded-r-full", theme.edge)} aria-hidden="true" /> : null}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{node.name}</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div>
        </div>
      </button>

      {node.children.length > 0 ? (
        <div className="space-y-2">
          {node.children.map((child) => (
            <OrgNodeTree key={child.id} node={child} selectedNodeId={selectedNodeId} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PermissionRow<C extends PermissionCategory>({
  category,
  itemKey,
  label,
  checked,
  onToggle,
}: {
  category: C;
  itemKey: keyof NewMemberOnboardingFormData["permissions"][C];
  label: string;
  checked: PermissionBucket;
  onToggle: (category: C, itemKey: keyof NewMemberOnboardingFormData["permissions"][C], action: PermissionAction) => void;
}) {
  return (
    <div className="grid grid-cols-4 items-center border-b border-slate-200/90 px-3 py-2.5 transition-colors">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {(["manager", "user", "viewer"] as PermissionAction[]).map((action) => (
        <div key={action} className="flex justify-center">
          <button
            type="button"
            aria-pressed={checked[action]}
            aria-label={`${label} ${action}`}
            onClick={() => onToggle(category, itemKey, action)}
            className={cn(
              "flex h-6.5 w-6.5 items-center justify-center rounded-sm border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(53,83,233)]/30",
              checked[action]
                ? "border-[rgb(53,83,233)] bg-[rgb(53,83,233)] text-white shadow-[0_6px_14px_rgba(53,83,233,0.28)]"
                : "border-slate-300 bg-white text-transparent hover:border-slate-400 hover:bg-slate-50",
            )}
          >
            <Check className={cn("h-3.5 w-3.5 transition-transform duration-150", checked[action] ? "scale-100" : "scale-0")} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function NewMemberOnboardingDialog({ open, onOpenChange, onSubmit }: NewMemberOnboardingDialogProps) {
  const { orgStructure } = useAppContext();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(createInitialFormData);
  const onboardingDatePickerRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [expandedAccessNodeId, setExpandedAccessNodeId] = useState<string | null>(null);
  const [nodePermissions, setNodePermissions] = useState<Record<string, NewMemberPermissions>>({});
  const [infoNodeId, setInfoNodeId] = useState<string | null>(null);
  const [isReviewAccessExpanded, setIsReviewAccessExpanded] = useState(true);
  const reviewAccessNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setFormData(createInitialFormData());
    setErrors({});
    setSelectedNodeId(orgStructure?.id ?? null);
    setSelectedNodeIds([]);
    setExpandedAccessNodeId(null);
    setNodePermissions({});
    setInfoNodeId(null);
    setIsReviewAccessExpanded(true);
  }, [open, orgStructure]);

  const selectedNodes = useMemo(
    () => selectedNodeIds.map((nodeId) => findOrgNode(orgStructure, nodeId)).filter((node): node is OrgNode => Boolean(node)),
    [orgStructure, selectedNodeIds],
  );

  const reviewNodes = useMemo(() => selectedNodes, [selectedNodes]);

  useEffect(() => {
    if (step !== 4 || !isReviewAccessExpanded || !expandedAccessNodeId) return;
    const target = reviewAccessNodeRefs.current[expandedAccessNodeId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step, isReviewAccessExpanded, expandedAccessNodeId]);

  useEffect(() => {
    if (selectedNodes.length === 0) {
      setExpandedAccessNodeId(null);
      setNodePermissions({});
      return;
    }

    setNodePermissions((current) => {
      const next: Record<string, NewMemberPermissions> = {};

      for (const node of selectedNodes) {
        next[node.id] = current[node.id] ?? createInitialPermissions();
      }

      return next;
    });

    setExpandedAccessNodeId((current) =>
      current && selectedNodes.some((node) => node.id === current) ? current : selectedNodes[0].id,
    );
  }, [selectedNodes]);

  const removeSelectedNode = (nodeId: string) => {
    setSelectedNodeIds((current) => current.filter((id) => id !== nodeId));
    setSelectedNodeId((current) => (current === nodeId ? orgStructure?.id ?? null : current));
    setExpandedAccessNodeId((current) => (current === nodeId ? null : current));
  };

  const handleNodeSelect = (nodeId: string) => {
    setErrors((current) => {
      const next = { ...current };
      delete next.nodeSelection;
      return next;
    });

    setSelectedNodeId(nodeId);
    setSelectedNodeIds((current) => {
      if (current.includes(nodeId)) {
        return current.filter((id) => id !== nodeId);
      }
      return [...current, nodeId];
    });
  };

  const updateBasic = <K extends keyof NewMemberOnboardingFormData["basic"]>(field: K, value: NewMemberOnboardingFormData["basic"][K]) => {
    setFormData((current) => ({
      ...current,
      basic: {
        ...current.basic,
        [field]: value,
      },
    }));
  };

  const togglePermission = <C extends PermissionCategory>(
    nodeId: string,
    category: C,
    item: keyof NewMemberOnboardingFormData["permissions"][C],
    action: PermissionAction,
  ) => {
    setErrors((current) => {
      const next = { ...current };
      delete next.accessRights;
      return next;
    });

    setNodePermissions((current) => {
      const currentPermissions = current[nodeId] ?? createInitialPermissions();
      const currentItem = currentPermissions[category][item];
      const nextItem = {
        ...currentItem,
        [action]: !currentItem[action],
      };

      const nextPermissions = {
        ...current,
        [nodeId]: {
          ...currentPermissions,
          [category]: {
            ...currentPermissions[category],
            [item]: nextItem,
          },
        },
      };

      if (category === "transactional") {
        const nextTransactionalItem = item as TransactionalPermissionItem;
        const nextItemHasAnyRight = Object.values(nextItem).some(Boolean);

        setFormData((prev) => {
          if (nextItemHasAnyRight) {
            // First transactional item the user enables becomes primary by default.
            return prev.transactionalPrimary ? prev : { ...prev, transactionalPrimary: nextTransactionalItem };
          }

          if (prev.transactionalPrimary !== nextTransactionalItem) {
            return prev;
          }

          // If current primary is fully unchecked, promote the next enabled transactional item.
          const fallbackPrimary = transactionalItems.find((transactionalItem) => {
            const rights = nextPermissions[nodeId].transactional[transactionalItem];
            return Object.values(rights).some(Boolean);
          }) ?? null;

          return { ...prev, transactionalPrimary: fallbackPrimary };
        });
      }

      return nextPermissions;
    });
  };

  const nextStep = () => {
    const nextErrors = validateStep(step, formData);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setStep((current) => Math.min(current + 1, 4));
    }
  };
  const prevStep = () => setStep((current) => Math.max(current - 1, 1));
  const todayIsoDate = useMemo(() => new Date().toISOString().split("T")[0], []);

  const openOnboardingDatePicker = () => {
    const dateInput = onboardingDatePickerRef.current;
    if (!dateInput) return;

    if ("showPicker" in dateInput && typeof dateInput.showPicker === "function") {
      dateInput.showPicker();
      return;
    }

    dateInput.click();
  };

  const activePermissionCount = useMemo(
    () =>
      Object.values(nodePermissions).reduce((nodeCount, permissions) => {
        return (
          nodeCount +
          Object.values(permissions).reduce((count, category) => {
            return count + Object.values(category).reduce((categoryCount, item) => categoryCount + Object.values(item).filter(Boolean).length, 0);
          }, 0)
        );
      }, 0),
    [nodePermissions],
  );

  const handlePrimaryAction = async () => {
    if (step === 1 || step === 2 || step === 3) {
      const nextErrors = validateStep(step, formData);

      if (step === 2 && selectedNodeIds.length === 0) {
        nextErrors.nodeSelection = "You need to select at least one node.";
      }

      if (step === 3) {
        const pendingNodes = selectedNodes.filter((node) => {
          const permissions = nodePermissions[node.id];
          if (!permissions) return true;

          const selectedCount = Object.values(permissions).reduce((categoryTotal, categoryItems) => {
            return categoryTotal + Object.values(categoryItems).reduce((itemTotal, item) => itemTotal + Object.values(item).filter(Boolean).length, 0);
          }, 0);

          return selectedCount === 0;
        });

        if (pendingNodes.length > 0) {
          nextErrors.accessRights = `You need to select rights for: ${pendingNodes.map((node) => node.name).join(", ")}.`;
          setExpandedAccessNodeId(pendingNodes[0].id);
        }
      }

      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        return;
      }

      if (step === 3) {
        setExpandedAccessNodeId(selectedNodes[0]?.id ?? null);
      }

      setStep((current) => Math.min(current + 1, 4));
      return;
    }

    if (onSubmit) {
      const fallbackPermissions = createInitialPermissions();
      const firstSelectedNodeId = selectedNodeIds[0];

      const payloadFormData: NewMemberOnboardingFormData = {
        ...formData,
        permissions: firstSelectedNodeId ? (nodePermissions[firstSelectedNodeId] ?? fallbackPermissions) : fallbackPermissions,
        nodeSelections: selectedNodes.map((node) => ({
          nodeId: node.id,
          nodeName: node.name,
          nodePath: node.nodePath,
          permissions: nodePermissions[node.id] ?? fallbackPermissions,
        })),
      };

      await onSubmit(payloadFormData);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-[100vw] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[92vh] sm:w-[min(96vw,76rem)] sm:max-w-[76rem] sm:rounded-lg">
        <div
          className={cn(
            "mx-auto flex h-full w-full max-w-6xl flex-col px-6 py-6 sm:px-8 sm:py-8",
            step === 1 ? "space-y-4 sm:space-y-5 sm:py-6" : step === 2 ? "space-y-4 sm:space-y-5 sm:py-6" : "space-y-6",
          )}
        >
          <div>
            <DialogHeader className="text-left">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground">New Member Onboarding</DialogTitle>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="pb-1">
            <div className="flex w-full items-center gap-3 sm:gap-4">
              {steps.map((label, index) => {
                const currentStep = index + 1;
                const isActive = step >= currentStep;
                const isComplete = step > currentStep;

                return (
                  <React.Fragment key={label}>
                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                          isActive ? "bg-[rgb(53,83,233)] text-white" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isComplete ? <Check className="h-4 w-4" /> : currentStep}
                      </div>
                      <span
                        className={cn(
                          "hidden whitespace-nowrap text-xs font-medium sm:block",
                          isActive ? "text-[rgb(53,83,233)]" : "text-muted-foreground",
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className="flex min-w-[2rem] flex-1 items-center">
                        <div className={cn("h-px w-full", step > currentStep ? "bg-[rgb(53,83,233)]" : "bg-border")} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <Card className="flex min-h-0 flex-1 overflow-hidden border-slate-200 shadow-sm">
            <CardContent
              className={cn(
                step === 4 ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
                step === 1 ? "p-5 pt-5 sm:p-6 sm:pt-6" : step === 3 ? "p-5 pt-5 sm:p-6 sm:pt-6" : "p-6 pt-6 sm:p-8 sm:pt-8",
              )}
            >
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <InputGroup label="Full Name" icon={<User size={18} />} value={formData.basic.name} onChange={(value) => { setErrors((e) => {const n = {...e}; delete n.name; return n;}); updateBasic("name", value); }} placeholder="John Doe" error={errors.name} required />
                    <InputGroup
                      label="Corporate Email"
                      icon={<Mail size={18} />}
                      value={formData.basic.email}
                      onChange={(value) => { setErrors((e) => {const n = {...e}; delete n.email; return n;}); updateBasic("email", value); }}
                      type="email"
                      placeholder="john.d@company.com"
                      error={errors.email}
                      required
                    />
                    <InputGroup
                      label="Phone Number"
                      icon={<Phone size={18} />}
                      value={formData.basic.phone}
                      onChange={(value) => {
                        const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
                        setErrors((e) => {
                          const n = { ...e };
                          delete n.phone;
                          return n;
                        });
                        updateBasic("phone", digitsOnly);
                      }}
                      placeholder="0000000000"
                      inputMode="numeric"
                      maxLength={10}
                      error={errors.phone}
                      required
                    />
                    <div className="group space-y-1">
                      <Label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-primary">Onboarding Date</Label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={openOnboardingDatePicker}
                          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          aria-label="Open onboarding date calendar"
                        >
                          <Calendar size={18} />
                        </button>
                        <Input
                          type="text"
                          value={formData.basic.onboardingDate}
                          onChange={(event) => {
                            const formatted = formatDateWithSlashes(event.target.value);
                            if (formatted.length === 10 && isDateInFuture(formatted)) {
                              return;
                            }
                            setErrors((e) => {const n = {...e}; delete n.onboardingDate; return n;});
                            updateBasic("onboardingDate", formatted);
                          }}
                          inputMode="numeric"
                          maxLength={10}
                          className="h-11 w-full border-slate-200 bg-white pl-12 pr-4 placeholder:text-slate-300 focus:border-primary focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="DD/MM/YYYY"
                        />
                        <input
                          ref={onboardingDatePickerRef}
                          type="date"
                          value={slashToIsoDate(formData.basic.onboardingDate)}
                          max={todayIsoDate}
                          onChange={(event) => {
                            const slashDate = isoToSlashDate(event.target.value);
                            if (!slashDate) return;
                            setErrors((e) => {const n = {...e}; delete n.onboardingDate; return n;});
                            updateBasic("onboardingDate", slashDate);
                          }}
                          className="pointer-events-none absolute h-0 w-0 opacity-0"
                          tabIndex={-1}
                          aria-hidden="true"
                        />
                      </div>
                      {errors.onboardingDate ? <p className="text-xs text-destructive">{errors.onboardingDate}</p> : null}
                    </div>
                    <InputGroup
                      label="Designation"
                      icon={<Briefcase size={18} />}
                      value={formData.basic.designation}
                      onChange={(value) => { setErrors((e) => {const n = {...e}; delete n.designation; return n;}); updateBasic("designation", value); }}
                      placeholder="Senior Analyst"
                      error={errors.designation}
                      required
                    />
                    <InputGroup
                      label="Employee ID"
                      icon={<IdCard size={18} />}
                      value={formData.basic.employeeId}
                      onChange={(value) => { setErrors((e) => {const n = {...e}; delete n.employeeId; return n;}); updateBasic("employeeId", value); }}
                      placeholder="EMP-10294"
                      error={errors.employeeId}
                      required
                    />
                    <div className="md:col-span-2">
                      <InputGroup
                        label="Reporting Manager"
                        icon={<Users size={18} />}
                        value={formData.basic.reportingManager}
                        onChange={(value) => { setErrors((e) => {const n = {...e}; delete n.reportingManager; return n;}); updateBasic("reportingManager", value); }}
                        placeholder="Select manager name"
                        error={errors.reportingManager}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {errors.nodeSelection ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {errors.nodeSelection}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                      <div className="mb-4">
                        <h3 className="text-base font-semibold text-slate-800">Select Node</h3>
                      </div>

                      {orgStructure ? (
                        <div className="max-h-[26rem] overflow-y-auto overflow-x-hidden pr-4 [scrollbar-gutter:stable]">
                          <OrgNodeTree node={orgStructure} selectedNodeId={selectedNodeId} onSelect={handleNodeSelect} />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                          Org structure is not available yet.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Selected Node</h4>
                      <div className="mt-4 min-h-[22rem] space-y-3">
                        {selectedNodes.length > 0 ? (
                          selectedNodes.map((node, index) => (
                            <div key={node.id} className={cn("relative flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3", getOrgNodeTheme(node.nodeType).card)}>
                              {node.nodeType.trim().toUpperCase() !== "ROOT" ? (
                                <span className={cn("absolute left-0 top-[12%] h-[76%] w-[4px] rounded-r-full", getOrgNodeTheme(node.nodeType).edge)} aria-hidden="true" />
                              ) : null}
                              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", getOrgNodeBadgeTheme(node.nodeType))}>
                                {index + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-800">{node.name}</div>
                                <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeSelectedNode(node.id)}
                                className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                aria-label={`Remove ${node.name}`}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
                            Selected nodes will appear here in preference order.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300 sm:space-y-5">
                  {errors.accessRights ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {errors.accessRights}
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">Selected Nodes</h3>
                      </div>
                      <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-600">
                        {selectedNodes.length} selected
                      </Badge>
                    </div>

                    {selectedNodes.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex gap-3 overflow-x-auto pb-1">
                        {selectedNodes.map((node, index) => (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => setExpandedAccessNodeId(node.id)}
                            onDoubleClick={() => setInfoNodeId((current) => (current === node.id ? null : node.id))}
                            className={cn(
                              "relative flex shrink-0 items-center gap-3 overflow-hidden rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition-all",
                              expandedAccessNodeId === node.id ? "border-slate-300 bg-slate-50/80" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60",
                            )}
                          >
                            {node.nodeType.trim().toUpperCase() !== "ROOT" ? (
                              <span className={cn("absolute left-0 top-[12%] h-[76%] w-[4px] rounded-r-full", getOrgNodeTheme(node.nodeType).edge)} aria-hidden="true" />
                            ) : null}
                            <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold", getOrgNodeBadgeTheme(node.nodeType))}>
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-sm font-semibold text-slate-800">{node.name}</div>
                                {index === 0 ? (
                                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                    Primary
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                          </button>
                        ))}
                        </div>

                        {infoNodeId ? (
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            {(() => {
                              const infoNode = selectedNodes.find((node) => node.id === infoNodeId);
                              if (!infoNode) return null;
                              const infoIndex = selectedNodes.findIndex((node) => node.id === infoNodeId);

                              return (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold", getOrgNodeBadgeTheme(infoNode.nodeType))}>
                                        {infoIndex + 1}
                                      </div>
                                      <div>
                                        <div className="text-sm font-semibold text-slate-800">{infoNode.name}</div>
                                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{infoNode.nodeType}</div>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setInfoNodeId(null)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                      aria-label="Close node info"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Preference</div>
                                      <div className="mt-1 font-semibold text-slate-700">{infoIndex + 1}</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Node Type</div>
                                      <div className="mt-1 font-semibold text-slate-700">{infoNode.nodeType}</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Node Path</div>
                                      <div className="mt-1 break-all font-semibold text-slate-700">{infoNode.nodePath || "-"}</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                        No nodes selected yet.
                      </div>
                    )}
                  </div>

                  {selectedNodes.length > 0 ? (
                    <div className="space-y-4">
                      {selectedNodes.map((node, index) => {
                        const isExpanded = expandedAccessNodeId === node.id;
                        const permissions = nodePermissions[node.id] ?? createInitialPermissions();

                        return (
                          <div key={node.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <button
                              type="button"
                              onClick={() => setExpandedAccessNodeId((current) => (current === node.id ? null : node.id))}
                              className="relative flex w-full items-center justify-between gap-4 overflow-hidden border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                            >
                              {node.nodeType.trim().toUpperCase() !== "ROOT" ? (
                                <span className={cn("absolute left-0 top-[12%] h-[76%] w-[4px] rounded-r-full", getOrgNodeTheme(node.nodeType).edge)} aria-hidden="true" />
                              ) : null}
                              <div className="flex min-w-0 items-center gap-3">
                                <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", getOrgNodeBadgeTheme(node.nodeType))}>
                                  {index + 1}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="truncate text-sm font-semibold text-slate-800">{node.name}</div>
                                  </div>
                                  <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div>
                                </div>
                              </div>
                              <ChevronRight className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", isExpanded ? "rotate-90" : "")} />
                            </button>

                            {isExpanded ? (
                              <div className="space-y-4 p-4">
                                <div className="grid grid-cols-4 rounded-t-lg bg-[rgba(30,66,189,1)] px-4 py-2.5 text-[11px] font-semibold text-white">
                                  <div>Department / Item</div>
                                  <div className="text-center">Manager</div>
                                  <div className="text-center">User</div>
                                  <div className="text-center">Viewer</div>
                                </div>

                                {(Object.entries(permissionStructure) as Array<[PermissionCategory, (typeof permissionStructure)[PermissionCategory]]>).map(([categoryKey, section]) => (
                                  <div key={`${node.id}-${categoryKey}`} className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
                                    <div className="border-b border-slate-300/60 bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-700">
                                      {section.label}
                                    </div>
                                    {section.items.map((item) => (
                                      <PermissionRow
                                        key={item.key}
                                        category={categoryKey}
                                        itemKey={item.key as never}
                                        label={item.label}
                                        checked={permissions[categoryKey][item.key]}
                                        onToggle={(category, itemKey, action) => togglePermission(node.id, category, itemKey, action)}
                                      />
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
                      Select at least one node to configure access rights.
                    </div>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="flex h-full min-h-0 flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center gap-2 text-[rgb(53,83,233)]">
                    <ShieldCheck size={24} />
                    <h3 className="text-lg font-bold">Review Final Access Policy</h3>
                  </div>

                  <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6">
                      <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">Basic Details</h4>
                      <dl className="space-y-3">
                        <SummaryItem label="Full Name" value={formData.basic.name} />
                        <SummaryItem label="Employee ID" value={formData.basic.employeeId} />
                        <SummaryItem label="Designation" value={formData.basic.designation} />
                        <SummaryItem label="Reporting to" value={formData.basic.reportingManager} />
                        <SummaryItem label="Email" value={formData.basic.email} />
                        <SummaryItem label="Joining" value={formatDateLabel(formData.basic.onboardingDate)} />
                      </dl>
                    </div>

                    <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-6">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Access Rights</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsReviewAccessExpanded((current) => !current)}
                          className="h-8 w-8 rounded-md border border-slate-200 p-0 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                          aria-label={isReviewAccessExpanded ? "Collapse access rights" : "Expand access rights"}
                        >
                          {isReviewAccessExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                      <div
                        className={cn(
                          "min-h-0 flex-1 overflow-x-hidden",
                          isReviewAccessExpanded ? "max-h-[26rem] space-y-4 overflow-y-auto snap-y snap-proximity [scrollbar-gutter:stable]" : "overflow-hidden",
                        )}
                      >
                        {isReviewAccessExpanded ? (
                          reviewNodes.map((node, index) => {
                          const permissions = nodePermissions[node.id];
                          if (!permissions) return null;

                          const sections = (Object.entries(permissions) as Array<[PermissionCategory, NewMemberOnboardingFormData["permissions"][PermissionCategory]]>)
                            .map(([categoryKey, items]) => {
                              const selectedItems = (Object.entries(items) as Array<[keyof typeof items, PermissionBucket]>)
                                .map(([itemKey, rights]) => ({
                                  itemKey,
                                  activeRights: Object.entries(rights)
                                    .filter(([, value]) => value)
                                    .map(([key]) => key),
                                }))
                                .filter((entry) => entry.activeRights.length > 0);

                              return selectedItems.length > 0 ? { categoryKey, selectedItems } : null;
                            })
                            .filter(Boolean) as Array<{
                              categoryKey: PermissionCategory;
                              selectedItems: Array<{ itemKey: string | number | symbol; activeRights: string[] }>;
                            }>;

                          if (sections.length === 0) return null;

                          return (
                            <div
                              key={node.id}
                              ref={(element) => {
                                reviewAccessNodeRefs.current[node.id] = element;
                              }}
                              className={cn(
                                "relative snap-start space-y-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-4",
                                expandedAccessNodeId === node.id && "border-slate-200",
                              )}
                            >
                              {node.nodeType.trim().toUpperCase() !== "ROOT" ? (
                                <span
                                  className={cn("absolute left-0 top-[10%] h-[80%] w-[4px] rounded-r-full", getOrgNodeTheme(node.nodeType).edge)}
                                  aria-hidden="true"
                                />
                              ) : null}
                              <div className="flex items-center gap-3">
                                <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold", getOrgNodeBadgeTheme(node.nodeType))}>
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-slate-800">{node.name}</div>
                                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div>
                                </div>
                              </div>

                              <div className="space-y-5">
                                {sections.map(({ categoryKey, selectedItems }) => (
                                  <div key={`${node.id}-${categoryKey}`} className="space-y-2.5">
                                    <div className="border-b border-slate-200 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                      {permissionStructure[categoryKey].label}
                                    </div>
                                    {selectedItems.map(({ itemKey, activeRights }) => (
                                      <div key={String(itemKey)} className="flex items-start justify-between gap-3 text-sm">
                                        <span className="text-slate-600">
                                          {String(itemKey)
                                            .replace(/([A-Z])/g, " $1")
                                            .trim()
                                            .replace(/^./, (char) => char.toUpperCase())}
                                        </span>
                                        <div className="flex flex-wrap justify-end gap-1">
                                          {activeRights.map((right) => (
                                            <span
                                              key={right}
                                              className={cn(
                                                "rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em]",
                                                getOrgNodePermissionChipTheme(node.nodeType),
                                              )}
                                            >
                                              {right}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                          })
                        ) : (
                          <div className="space-y-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Selected Nodes</div>
                            <div className="space-y-2">
                              {selectedNodes.length > 0 ? (
                                selectedNodes.map((node, index) => (
                                  <button
                                    key={`${node.id}-collapsed`}
                                    type="button"
                                    onClick={() => {
                                      setExpandedAccessNodeId(node.id);
                                      setIsReviewAccessExpanded(true);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                                  >
                                    <div className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold", getOrgNodeBadgeTheme(node.nodeType))}>
                                      {index + 1}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="truncate text-xs font-semibold text-slate-700">{node.name}</div>
                                      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{node.nodeType}</div>
                                    </div>
                                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-400" />
                                  </button>
                                ))
                              ) : (
                                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                                  No nodes selected.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </CardContent>
          </Card>

          <DialogFooter className={cn("border-t border-border bg-background px-0", step === 1 || step === 3 ? "py-3" : "py-4")}>
            <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" className="w-full sm:w-auto" onClick={step === 1 ? () => onOpenChange(false) : prevStep}>
                {step === 1 ? "Cancel" : "Back"}
              </Button>

              <Button className="w-full bg-[rgb(53,83,233)] text-white hover:bg-[rgb(53,83,233)]/90 sm:w-auto" onClick={handlePrimaryAction}>
                {step === 4 ? (onSubmit ? "Confirm & Create User" : "Close Preview") : "Continue"}
                {step < 4 ? <ChevronRight className="ml-2 h-4 w-4" /> : null}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NewMemberOnboardingDialog;
