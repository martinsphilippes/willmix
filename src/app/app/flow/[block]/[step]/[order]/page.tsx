import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  findStep,
  isPerProductStep,
  partnerStepsOf,
  stepHelpKey,
  stepLabelKey,
} from "@/lib/flow";
import { FlowOrderInStep } from "@/components/flow-order-step";
import { Alert, PageHeader } from "@/components/ui";

/*
 * O pedido na tela do passo (dono, 14/11/2026; docs/FLOW_MENU.md): tudo o
 * que o passo tem para este pedido, feito e aberto, com o formulário onde
 * ainda dá para agir; as ações voltam para cá. A Wellmix vê tudo do passo;
 * o parceiro, só os passos dele e só o que é dele (dono, 14/11/2026).
 * Nos passos por produto (Certificação), ?item=<item do pedido> abre só o
 * produto da linha em que se clicou "Resolver".
 */
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export default async function FlowOrderStepPage({
  params,
  searchParams,
}: PageProps<"/app/flow/[block]/[step]/[order]">) {
  const { block, step: key, order: orderId } = await params;
  const step = findStep(block, key);
  if (!step || step.badgeOnly || !ID.test(orderId)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/app/flow/${block}/${key}/${orderId}`);
  // Parceiro (dono, 14/11/2026): só os passos dele e os pedidos dele (a
  // checagem do pedido, canViewOrder, fica no componente).
  const wellmix = isWellmix(user);
  if (
    !wellmix &&
    !partnerStepsOf(user.role).some(
      (x) => x.block === step.block && x.key === step.key,
    )
  )
    notFound();
  requireScreen(user, wellmix ? step.screen : "orders");
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? String(sp[k]) : null);
  const t = await getT();
  const oneOf = (v: string | null, list: string[], prefix: string) =>
    v && list.includes(v) ? t(`${prefix}.${v}` as DictionaryKey) : null;
  const done = str("importStep") ?? str("certStep");
  const item = str("item");
  const view = await FlowOrderInStep({
    user,
    step,
    orderId,
    t,
    focus: item && isPerProductStep(step) && ID.test(item) ? item : null,
    notices: {
      import: oneOf(
        done,
        ["submitted", "validated", "rejected"],
        "importFlow.done",
      ),
      production: oneOf(
        str("production"),
        ["saved", "followup", "scheduled", "inspected", "fixed"],
        "production.done",
      ),
      receiving: oneOf(
        str("receiving"),
        ["saved", "counted", "ric", "returned", "closed"],
        "receiving.done",
      ),
      artwork: oneOf(
        str("artwork"),
        ["designer", "reported", "fixed", "accepted", "reopened"],
        "artwork.done",
      ),
      freight: str("freight"),
      freightN: /^\d{1,3}$/.test(str("freightN") ?? "")
        ? Number(str("freightN"))
        : 0,
    },
  });
  if (!view) notFound();
  return (
    <div data-flow-order-step={`${block}/${key}`}>
      <PageHeader
        title={t(stepLabelKey(step))}
        subtitle={t(stepHelpKey(step))}
      />
      {str("saved") === "1" ? (
        <div className="mb-3">
          <Alert tone="success">{t("flow.work.saved")}</Alert>
        </div>
      ) : null}
      {view}
    </div>
  );
}
