import { requireUserAndOrg } from "@/lib/session";
import { MembersManager } from "@/components/app/members-manager";

export default async function MembersSettingsPage() {
  const { organizationId } = await requireUserAndOrg();
  return <MembersManager organizationId={organizationId} />;
}
