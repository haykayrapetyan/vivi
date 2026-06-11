import { getServerDictionary } from "@/lib/i18n/server";
import { SettingsNav } from "@/components/app/settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getServerDictionary();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-xl font-semibold tracking-tight">
          {t.settings.title}
        </h1>
        <div className="mt-5">
          <SettingsNav />
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
