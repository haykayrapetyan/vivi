import { requireUser } from "@/lib/session";
import { SettingsForm } from "@/components/app/settings-form";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <SettingsForm
      name={user.name}
      email={user.email}
      image={user.image ?? null}
    />
  );
}
