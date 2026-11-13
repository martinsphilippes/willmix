import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import { getStore, type Requirement } from "@/lib/db";
import { canSubmitRequirement } from "@/lib/workflow/engine";
import { getDieCutView } from "@/lib/services/die-cut-step";
import { DIE_CUT_ITEMS, type DieCutItem } from "@/lib/die-cut-step";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  LinkButton,
  PageHeader,
  TextLink,
  formatDate,
} from "@/components/ui";
import { ActionError } from "@/components/action-error";
import { SubmitButton } from "@/components/submit-button";
import { RequirementForm } from "@/components/requirement-form";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { clearRequirementDocumentAction } from "../../../actions";
import { confirmDieCutTermsAction } from "../../../actions/die-cut-step";

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
    ? ([`dieCut.error.${code}`, `orders.error.${code}`]
        .map((key) => [key, t(key as DictionaryKey)])
        .find(([key, text]) => text !== key)?.[1] ?? fallbackError(t, code))
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
                        {state(termsDone ? moq : null)}
                      </div>
                      {p.negotiatedMoq !== null ||
                      p.negotiatedLeadTimeDays !== null ? (
                        <p className="text-xs text-zinc-600">
                          {t("dieCut.negotiated", {
                            moq: p.negotiatedMoq ?? "—",
                            days: p.negotiatedLeadTimeDays ?? "—",
                          })}
                        </p>
                      ) : null}
                      {termsDone ? (
                        <p className="text-xs text-zinc-500">
                          <span className="mr-2 text-zinc-800">
                            {t("dieCut.confirmed", {
                              moq: moq.value ?? "—",
                              days: lead.value ?? "—",
                            })}
                          </span>
                          {sentBy(lead)}
                        </p>
                      ) : null}
                      {canSend(moq) && canSend(lead) ? (
                        <form
                          action={confirmDieCutTermsAction}
                          className="space-y-2"
                          data-die-cut-terms
                        >
                          <input
                            type="hidden"
                            name="orderId"
                            value={order.id}
                          />
                          <input type="hidden" name="itemId" value={p.itemId} />
                          <p className="text-xs text-zinc-600">
                            {t("dieCut.terms.hint")}
                          </p>
                          <div className="flex flex-wrap items-end gap-2">
                            <Field label={t("dieCut.moq")}>
                              <Input
                                name="moq"
                                inputMode="numeric"
                                required
                                defaultValue={
                                  moq.value ?? p.negotiatedMoq ?? ""
                                }
                                className="w-36"
                              />
                            </Field>
                            <Field label={t("dieCut.leadTime")}>
                              <Input
                                name="leadTimeDays"
                                inputMode="numeric"
                                required
                                defaultValue={
                                  lead.value ?? p.negotiatedLeadTimeDays ?? ""
                                }
                                className="w-36"
                              />
                            </Field>
                            <SubmitButton pendingText="...">
                              {t("dieCut.terms.submit")}
                            </SubmitButton>
                          </div>
                        </form>
                      ) : null}
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
