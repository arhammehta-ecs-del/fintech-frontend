import { CorporateListView } from "@/features/corporate";
import { OnboardingWizardContent } from "@/features/onboarding";

export default function CorporateListPage() {
  return <CorporateListView OnboardingWizardRenderer={OnboardingWizardContent} />;
}
