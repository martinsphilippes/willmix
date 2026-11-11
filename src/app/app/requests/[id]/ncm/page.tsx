import { notFound, redirect } from "next/navigation";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import {
  canClassifyNcm,
  ncmWorkFor,
  scheduleNcmSuggestion,
} from "@/lib/services/request-ncm";
import { getT } from "@/i18n/server";
import { fallbackError } from "@/i18n/error-text";
import {
  Alert,
  Card,
  DescriptionList,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { RequestNcmCard } from "@/components/request-ncm-card";

/**
 * NCM da solicitação para o despachante: só a classificação e os dados do
 * produto que ela pede (nome, descrição, especificação, material). Sem
 * cliente, fornecedor, quantidade nem preço: ele não abre a solicitação. A
 * Wellmix confirma o NCM na própria solicitação e é levada para lá.
 */
export default async function RequestNcmPage({
  params,
  searchParams,
}: PageProps<"/app/requests/[id]/ncm">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  if (isWellmix(user)) redirect(`/app/requests/${id}#ncm`);
  if (!canClassifyNcm(user)) redirect("/app?denied=requests");
  // Despachante: a fila do NCM está nas Pendências; sem essa tela no perfil
  // (Gestão de telas), a classificação também não abre.
  requireScreen(user, "tasks");
  const { error, ncmConfirmed, ncmSuggested, ncmAi } = await searchParams;
  const work = await ncmWorkFor(user, id);
  if (!work) notFound();
  const t = await getT();
  // Primeira visita sem sugestões: a IA sugere depois que a página responde.
  if (work.neverSuggested && work.editable) scheduleNcmSuggestion(id);

  const known = (key: string) =>
    t(key as DictionaryKey) !== key ? t(key as DictionaryKey) : null;
  const errorText =
    typeof error === "string"
      ? (known(`pricing.error.${error}`) ??
        known(`ncm.error.${error}`) ??
        fallbackError(t, error))
      : null;
  const aiCode = typeof ncmAi === "string" ? ncmAi.replace(/^ai_/, "") : null;
  const aiReason = aiCode
    ? aiCode === "not_configured"
      ? t("ncm.ai.not_configured")
      : (known(`ai.error.${aiCode}`) ?? aiCode)
    : null;

  return (
    <>
      <PageHeader
        t={t}
        title={t("ncm.work.title")}
        subtitle={
          work.number
            ? t("ncm.work.subtitleNumber", {
                n: work.number,
                product: work.productName,
              })
            : work.productName
        }
        actions={
          <LinkButton href="/app/tasks">{t("ncm.work.backToTasks")}</LinkButton>
        }
      />
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      {!work.editable ? (
        <Alert tone="info">{t("ncm.work.closed")}</Alert>
      ) : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 lg:col-span-2">
          <RequestNcmCard
            t={t}
            requestId={work.requestId}
            ncm={work.ncm}
            suggestions={work.suggestions}
            suggestionsPending={work.neverSuggested}
            hasTable={work.hasTable}
            editable={work.editable}
            outsider
            notice={
              ncmConfirmed
                ? t("ncm.confirmedOk")
                : typeof ncmSuggested === "string"
                  ? t("ncm.suggestedOk", { count: ncmSuggested })
                  : null
            }
            aiNotice={
              aiReason ? t("ncm.aiUnavailable", { reason: aiReason }) : null
            }
          />
        </div>
        <Card title={t("common.product")}>
          <div data-ncm-product>
            <DescriptionList
              items={[
                [t("common.name"), work.productName],
                [t("catalog.category"), work.category ?? "—"],
                [t("catalog.material"), work.material ?? "—"],
                [t("catalog.color"), work.color ?? "—"],
                [t("ncm.work.supplierHs"), work.supplierHs ?? "—"],
              ]}
            />
            {work.description ? (
              <div className="mt-3 border-t border-zinc-100 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("ncm.work.description")}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-zinc-800">
                  {work.description}
                </p>
              </div>
            ) : null}
            {work.specification ? (
              <div className="mt-3 border-t border-zinc-100 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("requests.specification")}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-zinc-800">
                  {work.specification}
                </p>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  );
}
