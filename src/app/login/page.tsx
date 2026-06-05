"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await signIn.magicLink({
      email: email.trim(),
      callbackURL: "/app",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Не удалось отправить ссылку");
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          На главную
        </Link>
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-2 text-2xl font-semibold tracking-tight">Vivi</div>
          <p className="text-sm text-muted-foreground">
            AI-рекрутинг с видеоинтервью
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailCheck className="size-5" />
            </div>
            <h1 className="mb-1 text-base font-medium">Проверьте почту</h1>
            <p className="text-sm text-muted-foreground">
              Мы отправили ссылку для входа на{" "}
              <span className="text-foreground">{email}</span>. Ссылка действует
              5 минут.
            </p>
            <Button
              variant="ghost"
              className="mt-5 text-sm"
              onClick={() => setSent(false)}
            >
              Использовать другой email
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border bg-card p-8"
          >
            <h1 className="mb-1 text-base font-medium">Вход в аккаунт</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Введите email — отправим ссылку для входа.
            </p>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="mt-5 w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Отправить ссылку
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Продолжая, вы соглашаетесь с условиями использования.
        </p>
      </div>
    </main>
  );
}
