import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { errorTextFor } from "@/i18n/error-text";
import { getStore, type Requirement } from "@/lib/db";
import { canSubmitRequirement } from "@/lib/workflow/engine";
import { getDieCutView } from "@/lib/services/die-cut-step";
import {
  DIE_CUT_ITEMS,
  formatTermsNumber,
  type DieCutItem,
} from "@/lib/die-cut-step";
import {
  Alert,
  Badge,
  Card,
  LinkButton,
  PageHeader,
  TextLink,
  formatDate,
} from "@/components/ui";
import { ActionError } from "@/components/action-error";
import { RequirementForm } from "@/components/requirement-form";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { clearRequirementDocumentAction } from "../../../actions";
import { confirmDieCutTermsAction } from "../../../actions/die-cut-step";
import { DieCutTerms } from "./_components/die-cut-terms";

/** Quem confirmou por último o pedido mínimo e o prazo (o envio mais recente). */
const lastConfirmed = (a: Requirement, b: Requirement) =>
  (b.submittedAt ?? "") > (a.submittedAt ?? "") ? b : a;

/*
 * Quadro "Die Cut" do pedido de compra (decisão do dono, 13/11/2026): os
 * quatro itens do fornecedor, produto a produto, numa tela só: die-cut, foto
 * em alta, pedido mínimo e prazo de entrega. São os itens da raia dele na
 * Preparação (docs/PURCHASE_ORDER.md); só a Wellmix e o fornecedor do pedido
 * abrem.
 */
export default async function DieCutPage({
  params,
  searchParams,
}: PageProps<"/app/orders/[id]/die-cut">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "orders");
  const { id } = await params;
  const { error, saved, fields, at } = await searchParams;
  const view = await getDieCutView(user, id);
  if (!view) notFound();
  const t = await getT();
  const { order, products, documents } = view;

  const code = typeof error === "string" ? error : "";
  const errorText = code
    ? errorTextFor(t, code, ["dieCut.error", "orders.error"])
    : null;
  const savedKey = `dieCut.saved.${typeof saved === "string" ? saved : ""}`;
  const savedText =
    !code && t(savedKey as DictionaryKey) !== savedKey
      ? t(savedKey as DictionaryKey)
      : null;

  const userIds = [
    ...new Set(
      products
        .flatMap((p) => DIE_CUT_ITEMS.map((i) => p.items[i]?.submittedByUserId))
        .filter((x): x is string => !!x),
    ),
  ];
  const users = userIds.length
    ? await getStore().list("users", { filter: { id: userIds } })
    : [];
  const sentBy = (r: Requirement) =>
    `${users.find((u) => u.id === r.submittedByUserId)?.name ?? "—"} · ${formatDate(r.submittedAt, t)}`;
  /** Pedido mínimo e prazo no formato do idioma (132000 → "132.000"). */
  const termsNumber = (value: string | number | null | undefined) =>
    formatTermsNumber(value, t.intl);

  const state = (r: Requirement | null) =>
    r?.status === "done" ? (
      <Badge tone="success">{t("dieCut.state.done")}</Badge>
    ) : (
      <Badge tone="warning">{t("dieCut.state.pending")}</Badge>
    );
  const canSend = (r: Requirement | null): r is Requirement =>
    !!r && view.open && view.canAct && canSubmitRequirement(user, order, r);

  /** Die-cut e foto em alta: o arquivo enviado (com excluir) ou o envio. */
  const fileItem = (item: "dieline" | "hd", r: Requirement | null) => {
    const doc = r?.documentId ? (documents.get(r.documentId) ?? null) : null;
    return (
      <li
        className="flex flex-col gap-2 py-3"
        data-die-cut-item={item}
        data-done={r?.status === "done" ? "yes" : "no"}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-zinc-900">
            {t(`dieCut.item.${item}`)}
          </span>
          {state(r)}
        </div>
        <p className="text-xs text-zinc-600">{t(`dieCut.${item}.hint`)}</p>
        {r?.status === "done" && doc ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {doc.mime.startsWith("image/") ? (
              <a href={`/api/files/${doc.id}`} target="_blank">
                {/* eslint-disable-next-line @next/next/no-img-element -- arquivo protegido em /api/files */}
                <img
                  src={`/api/files/${doc.id}`}
                  alt={t(`dieCut.item.${item}`)}
                  loading="lazy"
                  className="h-16 w-16 rounded-lg border border-zinc-200 bg-zinc-50 object-cover"
                />
              </a>
            ) : null}
            <TextLink href={`/api/files/${doc.id}`} target="_blank">
              {doc.name} (v{doc.version})
            </TextLink>
            {canSend(r) ? (
              <form action={clearRequirementDocumentAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="requirementId" value={r.id} />
                <input type="hidden" name="returnTo" value="die-cut" />
                <ConfirmDeleteButton
                  label={t("requirement.remove")}
                  confirmText={t("requirement.removeConfirm")}
                  className="h-6! w-6!"
                />
              </form>
            ) : null}
            <span>{sentBy(r)}</span>
          </div>
        ) : null}
        {r?.status !== "done" && canSend(r) ? (
          <div className="@container">
            <RequirementForm
              requirement={r}
              orderId={order.id}
              t={t}
              returnTo="die-cut"
            />
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <>
      <PageHeader
        t={t}
        title={t("dieCut.title")}
        subtitle={t("dieCut.subtitle", { n: order.number })}
        actions={
          <LinkButton href={`/app/orders/${order.id}`}>
            {t("dieCut.back")}
          </LinkButton>
        }
      />
      <p className="mb-3 max-w-3xl text-sm leading-relaxed text-zinc-600">
        {t("dieCut.hint")}
      </p>
      <div className="mb-3 space-y-2">
        <ActionError
          t={t}
          code={error}
          text={errorText}
          fields={fields}
          token={at}
        />
        {savedText ? <Alert tone="success">{savedText}</Alert> : null}
        {!view.open ? <Alert tone="info">{t("dieCut.closed")}</Alert> : null}
        {products.length === 0 ? (
          <Alert tone="info">{t("dieCut.empty")}</Alert>
        ) : null}
      </div>
      <div className="space-y-3">
        {products.map((p) => {
          const moq = p.items.moq;
          const lead = p.items.leadTime;
          const termsDone = moq?.status === "done" && lead?.status === "done";
          const missing = p.missing.map((i: DieCutItem) =>
            t(`dieCut.item.${i}`),
          );
          return (
            <Card
              key={p.itemId}
              title={p.name}
              actions={
                p.complete ? (
                  <Badge tone="success">{t("dieCut.state.done")}</Badge>
                ) : (
                  <Badge tone="warning">{t("dieCut.state.pending")}</Badge>
                )
              }
            >
              <div
                id={`item-${p.itemId}`}
                className="scroll-mt-24"
                data-die-cut-product={p.itemId}
                data-complete={p.complete ? "yes" : "no"}
              >
                <p
                  className={
                    p.complete
                      ? "text-sm text-emerald-700"
                      : "text-sm text-amber-700"
                  }
                >
                  {p.complete
                    ? t("dieCut.complete")
                    : t("dieCut.missing", { list: missing.join(", ") })}
                </p>
                <ul className="mt-1 divide-y divide-zinc-100">
                  {fileItem("dieline", p.items.dieline)}
                  {fileItem("hd", p.items.hd)}
                  {moq && lead ? (
                    <li
                      className="flex flex-col gap-2 py-3"
                      data-die-cut-item="terms"
                      data-done={termsDone ? "yes" : "no"}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-zinc-900">
                          {t("dieCut.item.moq")} · {t("dieCut.item.leadTime")}
                        </span>
                        {termsDone ? (
                          <Badge tone="success">
                            {t("dieCut.terms.confirmedBadge")}
                          </Badge>
                        ) : (
                          state(null)
                        )}
                      </div>
                      {p.negotiatedMoq !== null ||
                      p.negotiatedLeadTimeDays !== null ? (
                        <p className="text-xs text-zinc-600">
                          {t("dieCut.negotiated", {
                            moq: termsNumber(p.negotiatedMoq),
                            days: termsNumber(p.negotiatedLeadTimeDays),
                          })}
                        </p>
                      ) : null}
                      {/* Confirmado: o resumo no lugar do formulário, com
                          "Editar" enquanto a etapa deixa corrigir (dono,
                          13/11/2026). Muda o registro salvo, o bloco remonta
                          e volta ao resumo. */}
                      <DieCutTerms
                        key={`${moq.submittedAt ?? ""}|${lead.submittedAt ?? ""}`}
                        action={confirmDieCutTermsAction}
                        orderId={order.id}
                        itemId={p.itemId}
                        confirmed={termsDone}
                        canEdit={canSend(moq) && canSend(lead)}
                        initial={{
                          moq: String(moq.value ?? p.negotiatedMoq ?? ""),
                          leadTimeDays: String(
                            lead.value ?? p.negotiatedLeadTimeDays ?? "",
                          ),
                        }}
                        summary={
                          termsDone ? (
                            <>
                              <span
                                className="text-sm font-semibold text-zinc-900 tabular-nums"
                                data-die-cut-terms-values
                              >
                                {t("dieCut.terms.values", {
                                  moq: termsNumber(moq.value),
                                  days: termsNumber(lead.value),
                                })}
                              </span>
                              <span
                                className="text-xs text-zinc-500"
                                data-die-cut-terms-by
                              >
                                {sentBy(lastConfirmed(moq, lead))}
                              </span>
                            </>
                          ) : null
                        }
                        labels={{
                          hint: t("dieCut.terms.hint"),
                          moq: t("dieCut.moq"),
                          leadTime: t("dieCut.leadTime"),
                          submit: t("dieCut.terms.submit"),
                          edit: t("common.edit"),
                          editAria: p.name
                            ? t("dieCut.terms.editAria", { product: p.name })
                            : null,
                          cancel: t("common.cancel"),
                        }}
                      />
                    </li>
                  ) : null}
                </ul>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
