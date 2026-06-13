import { requireUserAndOrg } from "@/lib/session";
import {
  getOrganization,
  getUnreadAgentCounts,
  getUserOrganizations,
  getUserTheme,
  listGroups,
  listVacancies,
} from "@/lib/data";
import { updateUserTheme } from "@/app/app/user-actions";
import { AppSidebar, MobileMenuProvider } from "@/components/app/sidebar";
import { ThemeArea } from "@/components/providers";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, organizationId } = await requireUserAndOrg();
  const [org, groups, vacancies, organizations, savedTheme, unreadCounts] =
    await Promise.all([
      getOrganization(organizationId),
      listGroups(organizationId),
      listVacancies(organizationId),
      getUserOrganizations(user.id),
      getUserTheme(user.id),
      getUnreadAgentCounts(organizationId, user.id),
    ]);

  type Item = {
    id: string;
    title: string;
    status: (typeof vacancies)[number]["status"];
    unread: number;
  };
  const byGroup = new Map<string, Item[]>();
  const ungrouped: Item[] = [];
  // Archived vacancies are hidden from the main tree but stay reachable in a
  // collapsed "Archived" section at the bottom.
  const archived: Item[] = [];
  for (const v of vacancies) {
    const item = {
      id: v.id,
      title: v.title,
      status: v.status,
      unread: unreadCounts.get(v.id) ?? 0,
    };
    if (v.status === "archived") {
      archived.push(item);
    } else if (v.groupId) {
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
    slug: org?.slug ?? null,
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
    archived,
  };

  return (
    <ThemeArea
      storageKey="vivi-app"
      initialTheme={savedTheme}
      onPersist={updateUserTheme}
    >
      <div className="flex h-dvh overflow-hidden bg-background">
        <AppSidebar {...sidebarProps} />
        <MobileMenuProvider {...sidebarProps}>
          <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {children}
          </main>
        </MobileMenuProvider>
      </div>
    </ThemeArea>
  );
}
