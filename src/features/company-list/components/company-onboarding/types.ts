import type { Signatory } from "@/contexts/AppContext";

export type OnboardingStep = 0 | 1 | 2 | 3;

export type GroupSelectionMode = "new" | "existing" | "not_applicable";

export type SignatoryWithId = Signatory & { id: string };

export type SignatoryForm = SignatoryWithId & {
  employeeId: string;
  source: "new" | "existing";
};

export type CompanyOnboardingWizardContentProps = {
  embedded?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export type OnboardingFormState = {
  groupSelectionMode: GroupSelectionMode;
  selectedGroupId: string;
  groupName: string;
  remarks: string;
  companyName: string;
  legalName: string;
  incDate: string;
  address: string;
  gstin: string;
  gstDocumentName: string;
  gstDocumentFile: File | null;
  ieCode: string;
  signatories: SignatoryForm[];
};
