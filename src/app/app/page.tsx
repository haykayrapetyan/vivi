import { Building2, MessagesSquare } from "lucide-react";
import { requireUserAndOrg } from "@/lib/session";
import { listCompanies } from "@/lib/data";
import { getServerDictionary } from "@/lib/i18n/server";
import { AppHomeCta } from "@/components/app/app-home-cta";

export default async function AppHome() {
  const t = await getServerDictionary();
  const { organizationId } = await requireUserAndOrg();
  const companies = await listCompanies(organizationId);
  const hasCompanies = companies.length > 0;

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {hasCompanies ? (
          <MessagesSquare className="size-6" />
        ) : (
          <Building2 className="size-6" />
        )}
      </div>
      <h1 className="text-lg font-medium">
        {hasCompanies ? t.appHome.title : t.company.noCompanies}
      </h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasCompanies ? t.appHome.subtitle : t.company.firstHint}
      </p>
      <div className="mt-6">
        <AppHomeCta firstCompanyId={hasCompanies ? companies[0].id : null} />
      </div>
    </div>
  );
}
