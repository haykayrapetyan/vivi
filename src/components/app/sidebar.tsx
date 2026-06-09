"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  Loader2,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { createVacancy, deleteVacancy, renameVacancy } from "@/app/app/actions";
import { deleteCompany } from "@/app/app/company-actions";
import type { VacancyStatus } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { OrgSwitcher } from "@/components/app/team";
import { CompanyDialog } from "@/components/app/company-dialog";

type VacancyItem = { id: string; title: string; status: VacancyStatus };
type CompanyItem = {
  id: string;
  name: string;
  website: string | null;
  descriptionMd: string | null;
  vacancies: VacancyItem[];
};

const statusDot: Record<VacancyStatus, string> = {
  draft: "bg-muted-foreground/40",
  published: "bg-emerald-500",
  closed: "bg-amber-500",
};

export function AppSidebar({
  user,
  organizations,
  activeOrganizationId,
  companies,
}: {
  user: { name: string; email: string; image: string | null };
  organizations: { id: string; name: string; role: string }[];
  activeOrganizationId: string;
  companies: CompanyItem[];
}) {
  const t = useT();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <aside className="flex h-full w-[272px] shrink-0 flex-col border-r bg-sidebar">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Vivi
        </Link>
        <div className="flex items-center">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>

      <div className="px-3 pb-2">
        <OrgSwitcher
          organizations={organizations}
          activeOrganizationId={activeOrganizationId}
        />
      </div>

      <div className="px-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-4" />
          {t.company.add}
        </Button>
      </div>

      <ScrollArea className="mt-3 flex-1 px-2">
        <div className="space-y-1 pb-3">
          {companies.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-medium">{t.company.noCompanies}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.company.firstHint}
              </p>
            </div>
          ) : (
            companies.map((c) => <CompanyGroup key={c.id} company={c} />)
          )}
        </div>
      </ScrollArea>

      <UserMenu user={user} />

      <CompanyDialog open={addOpen} onOpenChange={setAddOpen} />
    </aside>
  );
}

function CompanyGroup({ company }: { company: CompanyItem }) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [adding, startAdd] = useTransition();
  const [deleting, startDelete] = useTransition();

  return (
    <div>
      <div className="group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent/40">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="flex size-4 shrink-0 items-center justify-center rounded bg-primary/15 text-[9px] font-semibold text-primary">
            {company.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {company.name}
          </span>
        </button>

        <button
          title={t.company.addVacancy}
          aria-label={t.company.addVacancy}
          disabled={adding}
          onClick={() => startAdd(() => createVacancy(company.id))}
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        >
          {adding ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="menu"
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Settings2 className="size-4" />
              {t.company.edit}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={deleting}
              onSelect={() => {
                if (confirm(t.company.deleteConfirm)) {
                  startDelete(() => deleteCompany(company.id));
                }
              }}
            >
              <Trash2 className="size-4" />
              {t.company.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {open && (
        <div className="mt-0.5 ml-[15px] border-l pl-2">
          {company.vacancies.length === 0 ? (
            <button
              disabled={adding}
              onClick={() => startAdd(() => createVacancy(company.id))}
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="size-3.5" />
              {t.company.addVacancy}
            </button>
          ) : (
            company.vacancies.map((v) => (
              <VacancyRow
                key={v.id}
                vacancy={v}
                active={pathname === `/app/v/${v.id}`}
              />
            ))
          )}
        </div>
      )}

      <CompanyDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        company={company}
      />
    </div>
  );
}

function VacancyRow({
  vacancy,
  active,
}: {
  vacancy: VacancyItem;
  active: boolean;
}) {
  const t = useT();
  const [renameOpen, setRenameOpen] = useState(false);
  const [title, setTitle] = useState(vacancy.title);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/60",
        )}
      >
        <span
          className={cn("size-1.5 shrink-0 rounded-full", statusDot[vacancy.status])}
        />
        <Link
          href={`/app/v/${vacancy.id}`}
          className="min-w-0 flex-1 truncate"
          title={vacancy.title}
        >
          {vacancy.title}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label={t.common.edit}
            >
              <MoreHorizontal className="size-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
              <Pencil className="size-4" />
              {t.sidebar.rename}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => startTransition(() => deleteVacancy(vacancy.id))}
            >
              <Trash2 className="size-4" />
              {t.common.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.sidebar.renameTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename">{t.sidebar.nameLabel}</Label>
            <Input
              id="rename"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await renameVacancy(vacancy.id, title);
                  setRenameOpen(false);
                })
              }
            >
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function UserMenu({
  user,
}: {
  user: { name: string; email: string; image: string | null };
}) {
  const router = useRouter();
  const t = useT();
  const initials = (user.name || user.email).slice(0, 2).toUpperCase();

  return (
    <div className="border-t p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-sidebar-accent/60">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {user.email}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-56">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {user.name || t.sidebar.noName}
            <div className="truncate">{user.email}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              signOut({
                fetchOptions: { onSuccess: () => router.push("/login") },
              })
            }
          >
            <LogOut className="size-4" />
            {t.sidebar.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
