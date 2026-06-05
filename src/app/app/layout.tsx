import { requireUser } from "@/lib/session";
import { listVacancies } from "@/lib/data";
import { AppSidebar } from "@/components/app/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const vacancies = await listVacancies(user.id);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <AppSidebar
        user={{
          name: user.name,
          email: user.email,
          image: user.image ?? null,
        }}
        vacancies={vacancies.map((v) => ({
          id: v.id,
          title: v.title,
          status: v.status,
        }))}
      />
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
