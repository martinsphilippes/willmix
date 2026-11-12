import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import { Alert, Card, PageHeader, TextLink } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { summaryStatus } from "@/lib/services/order-summary";
import { rebuildOrderSummariesAction } from "../../actions/order-summary";

export const maxDuration = 300;

/**
 * Configurações → Resumos dos pedidos (docs/RESUMOS.md): a última
 * reconstrução completa e o botão para reconstruir agora. Só admin.
 */
export default async function OrderSummariesPage({
  searchParams,
}: PageProps<"/app/settings/summaries">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "settings");
  if (user.role !== "admin") redirect("/app/settings");
  const t = await getT();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const ran = one(sp.ran) === "1";
  const error = one(sp.error);
  const status = await summaryStatus().catch(() => null);
  const when = (iso: string) =>
    new Date(iso).toLocaleString(t.intl, { timeZone: "America/Sao_Paulo" });
  const stats = status
    ? [
        [t("summaries.builtAt"), when(status.builtAt)],
        [t("summaries.orders"), status.orders.toLocaleString(t.intl)],
        [t("summaries.written"), status.written.toLocaleString(t.intl)],
        [t("summaries.removed"), status.removed.toLocaleString(t.intl)],
        [t("summaries.duration"), `${(status.ms / 1000).toFixed(1)} s`],
      ]
    : [];

  return (
    <>
      <PageHeader
        title={t("summaries.title")}
        subtitle={t("summaries.subtitle")}
        actions={
          <TextLink href="/app/settings" className="text-sm">
            {t("reset.back")}
          </TextLink>
        }
      />
      {ran ? <Alert tone="success">{t("summaries.done")}</Alert> : null}
      {error ? (
        <Alert tone="danger">{t("summaries.error", { detail: error })}</Alert>
      ) : null}
      <Card className="mt-3" title={t("summaries.status")}>
        {status ? (
          <dl
            className="grid gap-3 text-sm sm:grid-cols-5"
            data-summaries-status
          >
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-zinc-500">{label}</dt>
                <dd className="font-medium text-zinc-900">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-zinc-600" data-summaries-never>
            {t("summaries.never")}
          </p>
        )}
        <form action={rebuildOrderSummariesAction} className="mt-4 space-y-2">
          <SubmitButton
            variant="primary"
            pendingText={t("summaries.rebuilding")}
            data-summaries-rebuild
          >
            {t("summaries.rebuild")}
          </SubmitButton>
          <p className="text-xs text-zinc-500">{t("summaries.rebuildHint")}</p>
        </form>
      </Card>
    </>
  );
}
