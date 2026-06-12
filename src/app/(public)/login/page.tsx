"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck, Sparkles } from "lucide-react";
import { authClient, signIn } from "@/lib/auth-client";
import { useT } from "@/lib/i18n/client";
import { interpolate } from "@/lib/i18n/dictionaries";
import { isEmail } from "@/lib/validation";
import { DRAFT_COOKIE } from "@/lib/draft";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

const OTP_LENGTH = 5;

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Cookie is only readable after hydration; reflect it into the banner.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasDraft(new RegExp(`(?:^|; )${DRAFT_COOKIE}=`).test(document.cookie));
  }, []);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError(t.validation.emailRequired);
      return;
    }
    if (!isEmail(email)) {
      setError(t.validation.emailInvalid);
      return;
    }
    setError(undefined);
    setLoading(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "sign-in",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? t.auth.errorSend);
      return;
    }
    setCode("");
    setSent(true);
  }

  async function verify(otp: string) {
    setError(undefined);
    setLoading(true);
    const { error } = await signIn.emailOtp({ email: email.trim(), otp });
    if (error) {
      setLoading(false);
      setCode("");
      setError(t.auth.errorVerify);
      codeRef.current?.focus();
      return;
    }
    router.push("/app");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== OTP_LENGTH) {
      setError(t.auth.errorVerify);
      return;
    }
    await verify(code);
  }

  function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setCode(digits);
    if (error) setError(undefined);
    // Submit as soon as all digits are in — no extra click needed.
    if (digits.length === OTP_LENGTH && !loading) void verify(digits);
  }

  async function handleResend() {
    setLoading(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "sign-in",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? t.auth.errorSend);
      return;
    }
    setCode("");
    setError(undefined);
    toast.success(t.auth.codeResent);
    codeRef.current?.focus();
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t.common.home}
        </Link>
      </div>
      <div className="absolute top-5 right-5 flex items-center gap-1">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-2" />
          <p className="text-sm text-muted-foreground">
            {t.common.brandSubtitle}
          </p>
        </div>

        {hasDraft && !sent && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-sm text-foreground">
            <Sparkles className="size-4 shrink-0 text-primary" />
            {t.auth.draftSaved}
          </div>
        )}

        {sent ? (
          <form
            onSubmit={handleVerify}
            className="rounded-xl border bg-card p-8 text-center"
            noValidate
          >
            <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailCheck className="size-5" />
            </div>
            <h1 className="mb-1 text-base font-medium">
              {t.auth.checkEmailTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              {interpolate(t.auth.checkEmailDesc, { email })}
            </p>
            <div className="mt-5 space-y-2">
              <Label htmlFor="otp" className="sr-only">
                {t.auth.codeLabel}
              </Label>
              <Input
                ref={codeRef}
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={"•".repeat(OTP_LENGTH)}
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                aria-invalid={!!error}
                disabled={loading}
                autoFocus
                className="h-12 text-center font-mono text-xl tracking-[0.5em]"
              />
              <FieldError>{error}</FieldError>
            </div>
            <Button
              type="submit"
              className="mt-4 w-full"
              disabled={loading || code.length !== OTP_LENGTH}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {t.auth.verifyCode}
            </Button>
            <div className="mt-3 flex items-center justify-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={handleResend}
                disabled={loading}
              >
                {t.auth.resendCode}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => {
                  setSent(false);
                  setCode("");
                  setError(undefined);
                }}
                disabled={loading}
              >
                {t.auth.useAnotherEmail}
              </Button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleSendCode}
            className="rounded-xl border bg-card p-8"
            noValidate
          >
            <h1 className="mb-1 text-base font-medium">{t.auth.title}</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              {t.auth.subtitle}
            </p>
            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t.auth.emailPlaceholder}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(undefined);
                }}
                aria-invalid={!!error}
                autoFocus
              />
              <FieldError>{error}</FieldError>
            </div>
            <Button type="submit" className="mt-5 w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {t.auth.sendCode}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t.auth.terms}
        </p>
      </div>
    </main>
  );
}
