"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  Building2,
  ChevronRight,
  FolderPlus,
  Loader2,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Sun,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";
import {
  createVacancy,
  deleteVacancy,
  moveVacancyToGroup,
  renameVacancy,
} from "@/app/app/actions";
import { deleteGroup } from "@/app/app/group-actions";
import type { VacancyStatus } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTheme } from "@/components/providers";
import { OrgSwitcher } from "@/components/app/team";
import { GroupDialog } from "@/components/app/group-dialog";
import { UserAvatar } from "@/components/app/user-avatar";
import type { CompanyProfile } from "@/components/app/company-form";

type VacancyItem = {
  id: string;
  title: string;
  status: VacancyStatus;
  /** Unread autonomous agent messages in this vacancy's chat. */
  unread: number;
};
type GroupItem = { id: string; name: string; vacancies: VacancyItem[] };
type GroupOption = { id: string; name: string };

// Drag-and-drop: a vacancy id travels in the dataTransfer under this type.
const VACANCY_MIME = "application/x-vivi-vacancy";

/** A drop target for a dragged vacancy. Highlights while a vacancy hovers over
 * it and calls onDropVacancy(id) on drop. */
function DropZone({
  onDropVacancy,
  disabled,
  className,
  activeClassName,
  children,
}: {
  onDropVacancy: (vacancyId: string) => void;
  disabled?: boolean;
  className?: string;
  activeClassName?: string;
  children?: React.ReactNode;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        // Ignore moves between child elements inside the zone.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setOver(false);
      }}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(false);
        const id =
          e.dataTransfer.getData(VACANCY_MIME) ||
          e.dataTransfer.getData("text/plain");
        if (id) onDropVacancy(id);
      }}
      className={cn(className, over && activeClassName)}
    >
      {children}
    </div>
  );
}

const statusDot: Record<VacancyStatus, string> = {
  draft: "bg-muted-foreground/40",
  published: "bg-emerald-500",
  closed: "bg-amber-500",
  archived: "bg-muted-foreground/20",
};

type SidebarProps = {
  user: { name: string; email: string; image: string | null };
  organizations: { id: string; name: string; role: string }[];
  activeOrganizationId: string;
  activeCompany: CompanyProfile;
  groups: GroupItem[];
  ungrouped: VacancyItem[];
  /** Hidden from the main tree; shown in a collapsed section at the bottom. */
  archived: VacancyItem[];
};

function SidebarBody({
  user,
  organizations,
  activeOrganizationId,
  activeCompany,
  groups,
  ungrouped,
  archived,
}: SidebarProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [creating, startCreate] = useTransition();
  const [, startMove] = useTransition();
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const empty = groups.length === 0 && ungrouped.length === 0;
  const groupOptions: GroupOption[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
  }));

  function move(vacancyId: string, groupId: string | null) {
    setDragging(false);
    startMove(async () => {
      try {
        await moveVacancyToGroup(vacancyId, groupId);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t.panel.saveError);
      }
    });
  }

  return (
    <>
      <div className="px-3 pt-3 pb-2">
        <OrgSwitcher
          organizations={organizations}
          activeOrganizationId={activeOrganizationId}
          activeCompany={activeCompany}
        />
      </div>

      <div className="flex gap-2 px-3">
        <Button
          size="sm"
          className="flex-1 justify-start gap-2"
          disabled={creating}
          onClick={() => startCreate(() => createVacancy())}
        >
          {creating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {t.sidebar.newVacancy}
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="size-8 shrink-0"
          title={t.group.add}
          aria-label={t.group.add}
          onClick={() => setAddGroupOpen(true)}
        >
          <FolderPlus className="size-4" />
        </Button>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2">
        <div className="space-y-0.5 pb-3">
          {empty ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              {t.sidebar.noVacancies}
            </p>
          ) : (
            <>
              <DropZone
                onDropVacancy={(id) => move(id, null)}
                disabled={!dragging}
                className="space-y-0.5 rounded-lg"
                activeClassName="ring-2 ring-primary/40"
              >
                {ungrouped.map((v) => (
                  <VacancyRow
                    key={v.id}
                    vacancy={v}
                    active={pathname === `/app/v/${v.id}`}
                    currentGroupId={null}
                    groupOptions={groupOptions}
                    onMoveGroup={move}
                    onDragStart={() => setDragging(true)}
                    onDragEnd={() => setDragging(false)}
                  />
                ))}
                {dragging && ungrouped.length === 0 && (
                  <p className="rounded-lg border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">
                    {t.group.dropToUngroup}
                  </p>
                )}
              </DropZone>
              {groups.map((g) => (
                <GroupSection
                  key={g.id}
                  group={g}
                  groupOptions={groupOptions}
                  dragging={dragging}
                  onMove={move}
                  onDragStart={() => setDragging(true)}
                  onDragEnd={() => setDragging(false)}
                />
              ))}
            </>
          )}
          {archived.length > 0 && (
            <ArchivedSection
              archived={archived}
              groupOptions={groupOptions}
              onMove={move}
              onDragStart={() => setDragging(true)}
              onDragEnd={() => setDragging(false)}
            />
          )}
        </div>
      </div>

      <UserMenu user={user} />

      <GroupDialog open={addGroupOpen} onOpenChange={setAddGroupOpen} />
    </>
  );
}

/** Desktop sidebar (md and up). */
export function AppSidebar(props: SidebarProps) {
  return (
    <aside className="hidden h-full w-[272px] shrink-0 flex-col border-r bg-sidebar md:flex">
      <SidebarBody {...props} />
    </aside>
  );
}

// The mobile sidebar drawer lives once in the layout; the hamburger that opens
// it is placed inline by each page (in its own header row) via MobileMenuButton,
// so there's no separate top bar stacked above the page header.
const MobileMenuContext = createContext<(() => void) | null>(null);

/** Holds the mobile sidebar drawer (left Sheet) and exposes an opener via
 * context to any MobileMenuButton rendered inside `children`. */
export function MobileMenuProvider({
  children,
  ...props
}: SidebarProps & { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer on navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  return (
    <MobileMenuContext.Provider value={() => setOpen(true)}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="flex w-[272px] flex-col gap-0 bg-sidebar p-0"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody {...props} />
        </SheetContent>
      </Sheet>
    </MobileMenuContext.Provider>
  );
}

/** Hamburger that opens the mobile sidebar drawer. Hidden on md+. Place it in
 * a page's header row (e.g. next to the vacancy title). */
export function MobileMenuButton({ className }: { className?: string }) {
  const open = useContext(MobileMenuContext);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Menu"
      onClick={() => open?.()}
      className={cn("md:hidden", className)}
    >
      <Menu className="size-5" />
    </Button>
  );
}

function GroupSection({
  group,
  groupOptions,
  dragging,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  group: GroupItem;
  groupOptions: GroupOption[];
  dragging: boolean;
  onMove: (vacancyId: string, groupId: string | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [adding, startAdd] = useTransition();
  const [deleting, startDelete] = useTransition();

  return (
    <DropZone
      onDropVacancy={(id) => onMove(id, group.id)}
      disabled={!dragging}
      className="mt-1 rounded-lg"
      activeClassName="ring-2 ring-primary/40 bg-sidebar-accent/20"
    >
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
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {group.name}
          </span>
        </button>

        <button
          title={t.group.addVacancy}
          aria-label={t.group.addVacancy}
          disabled={adding}
          onClick={() => startAdd(() => createVacancy(group.id))}
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
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              {t.group.rename}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={deleting}
              onSelect={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-4" />
              {t.group.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {open && (
        <div className="mt-0.5 pl-6">
          {group.vacancies.length === 0 ? (
            <button
              disabled={adding}
              onClick={() => startAdd(() => createVacancy(group.id))}
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="size-3.5" />
              {t.group.addVacancy}
            </button>
          ) : (
            group.vacancies.map((v) => (
              <VacancyRow
                key={v.id}
                vacancy={v}
                active={pathname === `/app/v/${v.id}`}
                currentGroupId={group.id}
                groupOptions={groupOptions}
                onMoveGroup={onMove}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ))
          )}
        </div>
      )}

      <GroupDialog open={editOpen} onOpenChange={setEditOpen} group={group} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t.group.delete}
        description={t.group.deleteConfirm}
        confirmLabel={t.group.delete}
        cancelLabel={t.common.cancel}
        destructive
        pending={deleting}
        onConfirm={() =>
          startDelete(async () => {
            await deleteGroup(group.id);
            setConfirmOpen(false);
          })
        }
      />
    </DropZone>
  );
}

const NO_GROUP = "none";

/** Collapsed-by-default home for archived vacancies — out of the way, but
 * still searchable by eye and fully navigable. */
function ArchivedSection({
  archived,
  groupOptions,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  archived: VacancyItem[];
  groupOptions: GroupOption[];
  onMove: (vacancyId: string, groupId: string | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border-t pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/40 hover:text-foreground"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            open && "rotate-90",
          )}
        />
        <Archive className="size-3.5 shrink-0" />
        {t.sidebar.archived}
        <span className="ml-auto tabular-nums">{archived.length}</span>
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 opacity-75">
          {archived.map((v) => (
            <VacancyRow
              key={v.id}
              vacancy={v}
              active={pathname === `/app/v/${v.id}`}
              currentGroupId={null}
              groupOptions={groupOptions}
              onMoveGroup={onMove}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VacancyRow({
  vacancy,
  active,
  currentGroupId,
  groupOptions,
  onMoveGroup,
  onDragStart,
  onDragEnd,
}: {
  vacancy: VacancyItem;
  active: boolean;
  currentGroupId: string | null;
  groupOptions: GroupOption[];
  onMoveGroup: (vacancyId: string, groupId: string | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useT();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(vacancy.title);
  const [groupValue, setGroupValue] = useState(currentGroupId ?? NO_GROUP);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(VACANCY_MIME, vacancy.id);
          e.dataTransfer.setData("text/plain", vacancy.id);
          e.dataTransfer.effectAllowed = "move";
          setDragging(true);
          onDragStart();
        }}
        onDragEnd={() => {
          setDragging(false);
          onDragEnd();
        }}
        className={cn(
          "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/60",
          dragging && "opacity-50",
        )}
      >
        <span
          className={cn("size-1.5 shrink-0 rounded-full", statusDot[vacancy.status])}
        />
        <Link
          href={`/app/v/${vacancy.id}`}
          draggable={false}
          className="min-w-0 flex-1 truncate"
          title={vacancy.title}
        >
          {vacancy.title}
        </Link>
        {vacancy.unread > 0 && (
          <span
            className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground"
            title={`${vacancy.unread} new agent update(s)`}
          >
            {vacancy.unread > 9 ? "9+" : vacancy.unread}
          </span>
        )}
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
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              {t.common.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t.sidebar.deleteTitle}
        description={t.sidebar.deleteConfirm}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        destructive
        pending={pending}
        onConfirm={() => startTransition(() => deleteVacancy(vacancy.id))}
      />

      <Dialog
        open={renameOpen}
        onOpenChange={(v) => {
          setRenameOpen(v);
          if (v) {
            // Reset to current values when (re)opening.
            setTitle(vacancy.title);
            setGroupValue(currentGroupId ?? NO_GROUP);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.sidebar.renameTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename">{t.sidebar.nameLabel}</Label>
              <Input
                id="rename"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rename-group">{t.sidebar.group}</Label>
              <Select value={groupValue} onValueChange={setGroupValue}>
                <SelectTrigger id="rename-group" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GROUP}>{t.sidebar.noGroup}</SelectItem>
                  {groupOptions.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const nextGroup = groupValue === NO_GROUP ? null : groupValue;
                  if (nextGroup !== currentGroupId) {
                    onMoveGroup(vacancy.id, nextGroup);
                  }
                  if (title.trim() !== vacancy.title) {
                    await renameVacancy(vacancy.id, title);
                  }
                  setRenameOpen(false);
                })
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
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
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return (
    <div className="border-t p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-sidebar-accent/60">
            <UserAvatar user={user} size="sm" />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {user.name?.trim() || user.email}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-60">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {user.name || t.sidebar.noName}
            <div className="truncate">{user.email}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/app/settings">
              <Settings className="size-4" />
              {t.sidebar.profileSettings}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/app/settings/company">
              <Building2 className="size-4" />
              {t.team.companySettings}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/app/settings/members">
              <UserPlus className="size-4" />
              {t.team.manage}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setTheme(dark ? "light" : "dark");
            }}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {dark ? t.sidebar.switchToLight : t.sidebar.switchToDark}
          </DropdownMenuItem>
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
