import { requireUserAndOrg } from "@/lib/session";
import { getUserOrganizations, listCompanies, listVacancies } from "@/lib/data";
import { AppSidebar } from "@/components/app/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, organizationId } = await requireUserAndOrg();
  const [companies, vacancies, organizations] = await Promise.all([
    listCompanies(organizationId),
    listVacancies(organizationId),
    getUserOrganizations(user.id),
  ]);

  const byCompany = new Map<
    string,
    { id: string; title: string; status: (typeof vacancies)[number]["status"] }[]
  >();
  for (const v of vacancies) {
    if (!v.companyId) continue;
    const list = byCompany.get(v.companyId) ?? [];
    list.push({ id: v.id, title: v.title, status: v.status });
    byCompany.set(v.companyId, list);
  }

  const companyItems = companies.map((c) => ({
    id: c.id,
    name: c.name,
    website: c.website,
    descriptionMd: c.descriptionMd,
    vacancies: byCompany.get(c.id) ?? [],
  }));

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <AppSidebar
        user={{
          name: user.name,
          email: user.email,
          image: user.image ?? null,
        }}
        organizations={organizations.map((o) => ({
          id: o.id,
          name: o.name,
          role: o.role,
        }))}
        activeOrganizationId={organizationId}
        companies={companyItems}
      />
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
