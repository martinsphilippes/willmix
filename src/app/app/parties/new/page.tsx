import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWillmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import { PartyForm } from "@/components/party-form";

export default async function NewPartyPage({
  searchParams,
}: PageProps<"/app/parties/new">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWillmix(user);
  const { error } = await searchParams;
  const t = await getT();
  return (
    <>
      <PageHeader title={t("parties.new")} />
      {error ? <Alert tone="danger">{t("common.error")}</Alert> : null}
      <Card className="mt-4 max-w-2xl">
        <PartyForm t={t} />
      </Card>
    </>
  );
}
