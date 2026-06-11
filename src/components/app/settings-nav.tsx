"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function SettingsNav() {
  const t = useT();
  const pathname = usePathname();
  const items = [
    { href: "/app/settings", label: t.settings.navProfile },
    { href: "/app/settings/company", label: t.settings.navCompany },
    { href: "/app/settings/members", label: t.settings.navMembers },
  ];

  return (
    <nav className="flex gap-1 border-b">
      {items.map((it) => {
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "relative px-3 py-2 text-sm transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {it.label}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
