import { cn } from "@/lib/utils";

/** Inline validation message rendered under a form field (in-app, never a
 * native browser bubble). Renders nothing when there's no error. */
export function FieldError({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn("text-xs text-destructive", className)}
    >
      {children}
    </p>
  );
}
