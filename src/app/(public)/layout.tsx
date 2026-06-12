import Link from "next/link";
import { ThemeArea } from "@/components/providers";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Public/candidate pages get their own theme storage, independent of the
  // recruiter dashboard's theme.
  return (
    <ThemeArea storageKey="vivi-public">
      <div className="flex min-h-dvh flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-5 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} Vivi — AI recruiting</span>
            <nav className="flex items-center gap-4">
              <Link
                href="/privacy"
                className="transition-colors hover:text-foreground"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="transition-colors hover:text-foreground"
              >
                Terms
              </Link>
            </nav>
          </div>
        </footer>
      </div>
    </ThemeArea>
  );
}
