import { CompanyListView } from "@/features/company-list";
import { CompanyOnboardingWizardContent } from "@/features/company-list";

export default function CompanyListPage() {
  return <CompanyListView CompanyOnboardingWizardRenderer={CompanyOnboardingWizardContent} />;
}
