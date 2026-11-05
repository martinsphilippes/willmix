import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import { PartyForm } from "@/components/party-form";
import { PARTY_TYPES } from "@/lib/db/schema";

export default async function NewPartyPage({
  searchParams,
}: PageProps<"/app/parties/new">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  const { error, type } = await searchParams;
  const defaultType = (PARTY_TYPES as readonly string[]).includes(String(type))
    ? (type as (typeof PARTY_TYPES)[number])
    : undefined;
  const t = await getT();
  return (
    <>
      <PageHeader
        help={{ body: "help.parties.body" }}
        t={t}
        title={t("parties.new")}
      />
      {error ? <Alert tone="danger">{t("common.error")}</Alert> : null}
      <Card className="mt-3 max-w-2xl">
        <PartyForm t={t} defaultType={defaultType} />
      </Card>
    </>
  );
}
