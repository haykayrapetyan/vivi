"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { uploadUserAvatar } from "@/app/app/user-actions";
import { downscaleImage } from "@/lib/image-resize";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { UserAvatar } from "@/components/app/user-avatar";

export function SettingsForm({
  name,
  email,
  image,
}: {
  name: string;
  email: string;
  image: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [savingName, startName] = useTransition();
  const [avatar, setAvatar] = useState(image);
  const [avatarBusy, setAvatarBusy] = useState(false);

  function saveName() {
    if (!displayName.trim()) {
      setNameError(t.validation.nameRequired);
      return;
    }
    setNameError(undefined);
    startName(async () => {
      const { error } = await authClient.updateUser({
        name: displayName.trim(),
      });
      if (error) {
        toast.error(t.settings.saveError);
        return;
      }
      router.refresh();
      toast.success(t.settings.saved);
    });
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarBusy(true);
    try {
      const img = await downscaleImage(file);
      const fd = new FormData();
      fd.append("file", img, "avatar.webp");
      const { image: url } = await uploadUserAvatar(fd);
      setAvatar(url);
      router.refresh();
      toast.success(t.settings.saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.settings.saveError);
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card/50 p-5">
        <h2 className="mb-4 text-sm font-medium">{t.settings.avatar}</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <UserAvatar user={{ name, email, image: avatar }} size="lg" />
            {avatarBusy && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
                <Loader2 className="size-4 animate-spin" />
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="avatar"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Upload className="size-3.5" />
              {t.settings.avatarUpload}
            </Label>
            <input
              id="avatar"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={avatarBusy}
              onChange={onAvatarChange}
            />
            <p className="text-xs text-muted-foreground">
              {t.settings.avatarHint}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card/50 p-5">
        <h2 className="mb-4 text-sm font-medium">{t.settings.account}</h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t.settings.name}</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (nameError) setNameError(undefined);
                }}
                placeholder={t.settings.namePlaceholder}
                aria-invalid={!!nameError}
              />
              <Button
                onClick={saveName}
                disabled={savingName || displayName.trim() === name}
              >
                {savingName && <Loader2 className="size-4 animate-spin" />}
                {t.common.save}
              </Button>
            </div>
            <FieldError>{nameError}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t.settings.email}</Label>
            <Input id="email" value={email} disabled readOnly />
          </div>
        </div>
      </section>
    </div>
  );
}
