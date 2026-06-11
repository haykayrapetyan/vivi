import { requireUserAndOrg } from "@/lib/session";
import { getOrganization } from "@/lib/data";
import { CompanyForm } from "@/components/app/company-form";

export default async function CompanySettingsPage() {
  const { organizationId } = await requireUserAndOrg();
  const org = await getOrganization(organizationId);

  return (
    <CompanyForm
      company={{
        name: org?.name ?? "Company",
        website: org?.website ?? null,
        descriptionMd: org?.descriptionMd ?? null,
        logo: org?.logo ?? null,
      }}
    />
  );
}
