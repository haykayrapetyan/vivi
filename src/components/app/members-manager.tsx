"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useT } from "@/lib/i18n/client";
import { isEmail } from "@/lib/validation";
import { interpolate } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UserAvatar } from "@/components/app/user-avatar";

type Member = {
  id: string;
  role: string;
  user?: { name?: string | null; email?: string | null; image?: string | null } | null;
};
type Invite = { id: string; email: string; status: string };

export function MembersManager({ organizationId }: { organizationId: string }) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [inviting, setInviting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Invite | null>(null);
  const [cancelling, setCancelling] = useState(false);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setEmailError(t.validation.emailRequired);
      return;
    }
    if (!isEmail(email)) {
      setEmailError(t.validation.emailInvalid);
      return;
    }
    setEmailError(undefined);
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

  async function cancelInvite() {
    if (!cancelTarget) return;
    setCancelling(true);
    await authClient.organization.cancelInvitation({
      invitationId: cancelTarget.id,
    });
    setCancelling(false);
    setCancelTarget(null);
    load();
  }

  function roleLabel(role: string) {
    if (role === "owner") return t.team.roleOwner;
    if (role === "admin") return t.team.roleAdmin;
    return t.team.roleMember;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={invite} className="space-y-1.5" noValidate>
        <Label htmlFor="invite-email">{t.team.inviteEmail}</Label>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(undefined);
              }}
              placeholder={t.team.invitePlaceholder}
              aria-invalid={!!emailError}
            />
          </div>
          <Button type="submit" disabled={inviting}>
            {inviting && <Loader2 className="size-4 animate-spin" />}
            {t.team.invite}
          </Button>
        </div>
        <FieldError>{emailError}</FieldError>
      </form>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.team.members}
        </p>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="divide-y rounded-xl border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 px-3 py-2.5">
                <UserAvatar user={m.user ?? {}} size="sm" />
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
          <div className="divide-y rounded-xl border">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-2.5 px-3 py-2.5">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {i.email}
                </span>
                <button
                  onClick={() => setCancelTarget(i)}
                  className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                >
                  {t.team.cancel}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(v) => {
          if (!v) setCancelTarget(null);
        }}
        title={t.team.cancelInviteTitle}
        description={
          cancelTarget
            ? interpolate(t.team.cancelInviteConfirm, {
                email: cancelTarget.email,
              })
            : ""
        }
        confirmLabel={t.team.cancelInviteTitle}
        cancelLabel={t.common.cancel}
        destructive
        pending={cancelling}
        onConfirm={cancelInvite}
      />
    </div>
  );
}
