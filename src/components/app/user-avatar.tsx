import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Renders a user's avatar image with an initials fallback. Used everywhere a
 * person is shown (sidebar, members, vacancy owner). */
export function UserAvatar({
  user,
  className,
  size = "default",
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const label = user.name || user.email || "?";
  const initials = label.slice(0, 2).toUpperCase();
  return (
    <Avatar size={size} className={cn(className)}>
      {user.image && <AvatarImage src={user.image} alt="" />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
