"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [accepting, setAccepting] = useState(false);

  async function accept() {
    setAccepting(true);
    const { error } = await authClient.organization.acceptInvitation({
      invitationId: id,
    });
    setAccepting(false);
    if (error) {
      toast.error(error.message ?? t.team.acceptError);
      return;
    }
    toast.success(t.team.accepted);
    router.push("/app");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="size-5" />
        </div>
        <h1 className="mb-1 text-base font-medium">{t.team.acceptTitle}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t.team.acceptDesc}</p>
        {isPending ? (
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        ) : session?.user ? (
          <Button className="w-full" onClick={accept} disabled={accepting}>
            {accepting && <Loader2 className="size-4 animate-spin" />}
            {t.team.accept}
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link href="/login">{t.team.loginToAccept}</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
