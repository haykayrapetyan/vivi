import { ThemeArea } from "@/components/providers";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Public/candidate pages get their own theme storage, independent of the
  // recruiter dashboard's theme.
  return <ThemeArea storageKey="vivi-public">{children}</ThemeArea>;
}
