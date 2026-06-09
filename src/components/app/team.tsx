"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Loader2, Mail, Users } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Org = { id: string; name: string; role: string };
type Member = {
  id: string;
  role: string;
  user?: { name?: string | null; email?: string | null } | null;
};
type Invite = { id: string; email: string; status: string };

export function OrgSwitcher({
  organizations,
  activeOrganizationId,
}: {
  organizations: Org[];
  activeOrganizationId: string;
}) {
  const t = useT();
  const router = useRouter();
  const [, startSwitch] = useTransition();
  const [teamOpen, setTeamOpen] = useState(false);
  const active =
    organizations.find((o) => o.id === activeOrganizationId) ??
    organizations[0];

  function switchOrg(id: string) {
    if (id === activeOrganizationId) return;
    startSwitch(async () => {
      await authClient.organization.setActive({ organizationId: id });
      router.push("/app");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-sidebar-accent/60">
            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/15 text-[10px] font-semibold text-primary">
              {active?.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate">{active?.name}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[232px]">
          {organizations.map((o) => (
            <DropdownMenuItem key={o.id} onSelect={() => switchOrg(o.id)}>
              <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold">
                {o.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate">{o.name}</span>
              {o.id === activeOrganizationId && <Check className="size-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setTeamOpen(true)}>
            <Users className="size-4" /> {t.team.label}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TeamDialog
        open={teamOpen}
        onOpenChange={setTeamOpen}
        organizationId={activeOrganizationId}
      />
    </>
  );
}

function TeamDialog({
  open,
  onOpenChange,
  organizationId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
}) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await authClient.organization.getFullOrganization({
      query: { organizationId },
    });
    setMembers((data?.members ?? []) as Member[]);
    setInvites(
      ((data?.invitations ?? []) as Invite[]).filter(
        (i) => i.status === "pending",
      ),
    );
    setLoading(false);
  }

  useEffect(() => {
    if (!open) return;
    // Fetch members/invitations when the dialog opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    const { error } = await authClient.organization.inviteMember({
      email: email.trim(),
      role: "member",
      organizationId,
    });
    setInviting(false);
    if (error) {
      toast.error(error.message ?? t.team.inviteError);
      return;
    }
    setEmail("");
    toast.success(t.team.inviteSent);
    load();
  }

  async function cancelInvite(invitationId: string) {
    await authClient.organization.cancelInvitation({ invitationId });
    load();
  }

  function roleLabel(role: string) {
    if (role === "owner") return t.team.roleOwner;
    if (role === "admin") return t.team.roleAdmin;
    return t.team.roleMember;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.team.label}</DialogTitle>
        </DialogHeader>

        <form onSubmit={invite} className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="invite-email">{t.team.inviteEmail}</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.team.invitePlaceholder}
            />
          </div>
          <Button type="submit" disabled={inviting}>
            {inviting && <Loader2 className="size-4 animate-spin" />}
            {t.team.invite}
          </Button>
        </form>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.team.members}
          </p>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <div className="space-y-0.5">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 py-1.5">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px]">
                      {(m.user?.name || m.user?.email || "?")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      {m.user?.name || m.user?.email}
                    </div>
                    {m.user?.name && (
                      <div className="truncate text-xs text-muted-foreground">
                        {m.user?.email}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {roleLabel(m.role)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {invites.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.team.pending}
            </p>
            <div className="space-y-0.5">
              {invites.map((i) => (
                <div key={i.id} className="flex items-center gap-2 py-1.5">
                  <Mail className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {i.email}
                  </span>
                  <button
                    onClick={() => cancelInvite(i.id)}
                    className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                  >
                    {t.team.cancel}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
