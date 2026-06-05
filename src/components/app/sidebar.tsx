"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import {
  createVacancy,
  deleteVacancy,
  renameVacancy,
} from "@/app/app/actions";
import type { VacancyStatus } from "@/lib/db/schema";
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

type VacancyItem = { id: string; title: string; status: VacancyStatus };

const statusDot: Record<VacancyStatus, string> = {
  draft: "bg-muted-foreground/40",
  published: "bg-emerald-500",
  closed: "bg-amber-500",
};

export function AppSidebar({
  user,
  vacancies,
}: {
  user: { name: string; email: string; image: string | null };
  vacancies: VacancyItem[];
}) {
  const pathname = usePathname();
  const [creating, startCreate] = useTransition();

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-r bg-sidebar">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Vivi
        </Link>
      </div>

      <div className="px-3">
        <Button
          className="w-full justify-start gap-2"
          size="sm"
          disabled={creating}
          onClick={() => startCreate(() => createVacancy())}
        >
          <Plus className="size-4" />
          Новая вакансия
        </Button>
      </div>

      <ScrollArea className="mt-3 flex-1 px-3">
        <div className="space-y-0.5 pb-3">
          {vacancies.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Пока нет вакансий.
              <br />
              Создайте первую.
            </p>
          ) : (
            vacancies.map((v) => (
              <VacancyRow
                key={v.id}
                vacancy={v}
                active={pathname === `/app/v/${v.id}`}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <UserMenu user={user} />
    </aside>
  );
}

function VacancyRow({
  vacancy,
  active,
}: {
  vacancy: VacancyItem;
  active: boolean;
}) {
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
              aria-label="Действия"
            >
              <MoreHorizontal className="size-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
              <Pencil className="size-4" />
              Переименовать
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                startTransition(() => deleteVacancy(vacancy.id))
              }
            >
              <Trash2 className="size-4" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать вакансию</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename">Название</Label>
            <Input
              id="rename"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Отмена
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
              Сохранить
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
            {user.name || "Без имени"}
            <div className="truncate">{user.email}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              signOut({
                fetchOptions: {
                  onSuccess: () => router.push("/login"),
                },
              })
            }
          >
            <LogOut className="size-4" />
            Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
