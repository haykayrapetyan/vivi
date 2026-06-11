import {
  Briefcase,
  Laptop,
  MapPin,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ParamKey, ParamRow } from "@/lib/vacancy-params";
import { cn } from "@/lib/utils";

const ICONS: Record<ParamKey, LucideIcon> = {
  salary: Wallet,
  workMode: Laptop,
  location: MapPin,
  employment: Briefcase,
  seniority: TrendingUp,
};

/** A wrapped row of icon highlight chips for a vacancy's key parameters.
 * Plain component (no hooks) so it works in both server and client trees. */
export function VacancyHighlights({
  rows,
  className,
}: {
  rows: ParamRow[];
  className?: string;
}) {
  if (!rows.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {rows.map((r) => {
        const Icon = ICONS[r.key];
        const isSalary = r.key === "salary";
        return (
          <span
            key={r.key}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm",
              isSalary
                ? "border-primary/30 bg-primary/10 font-medium"
                : "bg-card/60",
            )}
          >
            <Icon
              className={cn(
                "size-4",
                isSalary ? "text-primary" : "text-muted-foreground",
              )}
            />
            <span className={isSalary ? "" : "font-medium"}>{r.value}</span>
          </span>
        );
      })}
    </div>
  );
}
