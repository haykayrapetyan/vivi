import { requireUserAndOrg } from "@/lib/session";
import {
  getOrganization,
  getUserOrganizations,
  getUserTheme,
  listGroups,
  listVacancies,
} from "@/lib/data";
import { updateUserTheme } from "@/app/app/user-actions";
import { AppSidebar, MobileNav } from "@/components/app/sidebar";
import { ThemeArea } from "@/components/providers";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, organizationId } = await requireUserAndOrg();
  const [org, groups, vacancies, organizations, savedTheme] = await Promise.all([
    getOrganization(organizationId),
    listGroups(organizationId),
    listVacancies(organizationId),
    getUserOrganizations(user.id),
    getUserTheme(user.id),
  ]);

  type Item = {
    id: string;
    title: string;
    status: (typeof vacancies)[number]["status"];
  };
  const byGroup = new Map<string, Item[]>();
  const ungrouped: Item[] = [];
  for (const v of vacancies) {
    const item = { id: v.id, title: v.title, status: v.status };
    if (v.groupId) {
      const list = byGroup.get(v.groupId) ?? [];
      list.push(item);
      byGroup.set(v.groupId, list);
    } else {
      ungrouped.push(item);
    }
  }

  const groupItems = groups.map((g) => ({
    id: g.id,
    name: g.name,
    vacancies: byGroup.get(g.id) ?? [],
  }));

  const activeCompany = {
    name: org?.name ?? "Company",
    website: org?.website ?? null,
    descriptionMd: org?.descriptionMd ?? null,
    logo: org?.logo ?? null,
  };

  const sidebarProps = {
    user: {
      name: user.name,
      email: user.email,
      image: user.image ?? null,
    },
    organizations: organizations.map((o) => ({
      id: o.id,
      name: o.name,
      role: o.role,
    })),
    activeOrganizationId: organizationId,
    activeCompany,
    groups: groupItems,
    ungrouped,
  };

  return (
    <ThemeArea
      storageKey="vivi-app"
      initialTheme={savedTheme}
      onPersist={updateUserTheme}
    >
      <div className="flex h-dvh overflow-hidden bg-background">
        <AppSidebar {...sidebarProps} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav {...sidebarProps} />
          <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </ThemeArea>
  );
}
