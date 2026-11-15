import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { can } from "@/lib/auth/function-access";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { productNameText } from "@/i18n";
import { getStore, type LastPurchase, type Request } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import {
  canApproveStrategy,
  canChooseStrategy,
  lastPurchases,
  openDecisions,
  waitingDemands,
} from "@/lib/services/purchase-strategy";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
  formatDate,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import { DemandTags } from "@/components/demand-tags";
import {
  chooseStrategyAction,
  decideStrategyAction,
  orderFromStrategyAction,
} from "../actions/purchase-demand";

/*
 * Estratégia de compra (mapa B10?; dono, 15/11/2026; docs/PURCHASE_DEMAND.md):
 * uma fila só do Comprador com reposições e encomendas. Por linha de produto,
 * as demandas que esperam a escolha, com a última compra de cada produto;
 * depois, as estratégias esperando a aprovação da Diretoria de compras e as
 * aprovadas a gerar pedido de compra.
 */
export default async function PurchaseStrategyPage({
  searchParams,
}: PageProps<"/app/purchase-strategy">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "quotes");
  if (!isWellmix(user)) redirect("/app");
  const { error, chosen, decided } = await searchParams;
  const t = await getT();
  const store = getStore();
  const [waiting, decisions] = await Promise.all([
    waitingDemands(),
    openDecisions(),
  ]);
  const decisionDemandIds = decisions.flatMap((d) => d.demandIds);
  const decisionDemands = decisionDemandIds.length
    ? await store.list("requests", { filter: { id: decisionDemandIds } })
    : [];
  const allDemands = [...waiting, ...decisionDemands];
  const productIds = [
    ...new Set(allDemands.map((d) => d.productId).filter(Boolean)),
  ] as string[];
  const [products, parties, references] = await Promise.all([
    listByIds(store, "products", productIds),
    listByIds(
      store,
      "parties",
      allDemands.map((d) => d.customerId),
    ),
    lastPurchases(productIds),
  ]);
  const lines = await listByIds(
    store,
    "product_lines",
    products.map((p) => p.lineId).filter(Boolean) as string[],
  );
  const productById = new Map(products.map((p) => [p.id, p]));
  const lineName = (id: string | null) =>
    (id && lines.find((l) => l.id === id)?.name) || t("strategy.noLine");
  const partyName = (id: string) =>
    parties.find((p) => p.id === id)?.name ?? "—";
  const canChoose = canChooseStrategy(user);
  const canApprove = canApproveStrategy(user);
  const canOrder =
    can(user, "purchaseOrder.generate") && canOpen(user, "orders");

  // Fila: por linha do produto (as demandas sem produto do catálogo ficam
  // numa linha à parte: só dá para cotar depois de cadastrar o produto).
  const groups = new Map<string, Request[]>();
  for (const d of waiting) {
    const p = d.productId ? productById.get(d.productId) : null;
    const key = p ? (p.lineId ?? `product:${p.id}`) : "none";
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const errorCode = typeof error === "string" ? error : "";
  const errorKey = `strategy.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;

  const reference = (ref: LastPurchase | undefined) =>
    ref ? (
      <dl
        className="grid gap-x-4 gap-y-0.5 text-xs text-zinc-700 sm:grid-cols-3"
        data-last-purchase={ref.orderNumber}
      >
        <div>
          <dt className="text-zinc-500">{t("strategy.last.supplier")}</dt>
          <dd className="font-medium">{ref.supplierName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("strategy.last.price")}</dt>
          <dd className="font-medium tabular-nums">
            {ref.unitPrice !== null
              ? `${ref.currency ?? ""} ${ref.unitPrice.toLocaleString(t.intl, { maximumFractionDigits: 4 })}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("strategy.last.date")}</dt>
          <dd>
            <Link href={`/app/orders/${ref.orderId}`} className={linkClass}>
              #{ref.orderNumber}
            </Link>{" "}
            · {formatDate(ref.date, t)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("strategy.last.leadTime")}</dt>
          <dd>
            {ref.leadTimeDays !== null
              ? t("strategy.days", { n: ref.leadTimeDays })
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("strategy.last.incoterm")}</dt>
          <dd>{ref.incoterm ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("strategy.last.moq")}</dt>
          <dd className="tabular-nums">
            {ref.moq !== null ? ref.moq.toLocaleString(t.intl) : "—"}
          </dd>
        </div>
      </dl>
    ) : (
      <p className="text-xs font-medium text-amber-800" data-no-last-purchase>
        {t("strategy.noLastPurchase")}
      </p>
    );

  const demandRow = (d: Request, checkbox: boolean) => (
    <li
      key={d.id}
      className="flex flex-wrap items-start gap-x-3 gap-y-1 py-1.5"
      data-strategy-demand={d.id}
    >
      {checkbox ? (
        <input
          type="checkbox"
          name="demandIds"
          value={d.id}
          defaultChecked
          className="mt-1 h-4 w-4"
          aria-label={productNameText(t, d.productName)}
        />
      ) : null}
      <span className="min-w-0 flex-1 text-sm">
        <Link href={`/app/requests/${d.id}`} className={linkClass}>
          {d.number ? `nº ${d.number}` : "—"}
        </Link>{" "}
        · {d.quantity.toLocaleString(t.intl)} {d.unit}
        {d.desiredAt
          ? ` · ${t("demand.desiredAt")}: ${formatDate(d.desiredAt, t)}`
          : ""}
        <span className="block text-xs text-zinc-600">
          {partyName(d.customerId)}
        </span>
        <DemandTags t={t} request={d} />
      </span>
    </li>
  );

  return (
    <div data-strategy-page={waiting.length}>
      <PageHeader
        t={t}
        title={t("strategy.title")}
        subtitle={t("strategy.subtitle")}
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {typeof chosen === "string" ? (
        <div className="mb-3" role="status" data-strategy-chosen>
          <Alert tone="success">{t("strategy.chosen", { n: chosen })}</Alert>
        </div>
      ) : null}
      {typeof decided === "string" ? (
        <div className="mb-3" role="status" data-strategy-decided>
          <Alert tone="success">{t("strategy.decided", { n: decided })}</Alert>
        </div>
      ) : null}

      <Card title={t("strategy.waiting", { n: waiting.length })}>
        {groups.size ? (
          <div className="space-y-4">
            {[...groups.entries()].map(([key, demands]) => {
              const productsHere = [
                ...new Set(demands.map((d) => d.productId).filter(Boolean)),
              ] as string[];
              const first = productsHere[0]
                ? productById.get(productsHere[0])
                : null;
              const noProduct = key === "none";
              // "Fornecedor da última compra" vale para um produto só, com
              // compra anterior: a opção fica liberada se algum produto do
              // grupo tem compra (o servidor confere o que foi marcado).
              const anyLast = productsHere.some((id) => references.has(id));
              const lastOk =
                productsHere.length === 1 && !!references.get(productsHere[0]);
              return (
                <form
                  key={key}
                  action={chooseStrategyAction}
                  className="rounded-2xl border border-zinc-200 p-3"
                  data-strategy-group={key}
                >
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {noProduct
                      ? t("strategy.noProduct")
                      : lineName(first?.lineId ?? null)}
                  </h3>
                  {noProduct ? (
                    <p className="mt-1 text-xs text-amber-800">
                      {t("strategy.noProductHint")}
                    </p>
                  ) : null}
                  {(noProduct ? [null] : productsHere).map((pid) => (
                    <div key={pid ?? "none"} className="mt-3 space-y-1">
                      {pid ? (
                        <>
                          <p className="text-sm font-medium text-zinc-800">
                            {productNameText(
                              t,
                              productById.get(pid)?.name ?? "",
                            )}
                          </p>
                          {reference(references.get(pid))}
                        </>
                      ) : null}
                      <ul className="divide-y divide-zinc-100">
                        {demands
                          .filter((d) => (d.productId ?? null) === pid)
                          .map((d) => demandRow(d, canChoose && !noProduct))}
                      </ul>
                    </div>
                  ))}
                  {canChoose && !noProduct ? (
                    <div className="mt-3 grid gap-2 border-t border-zinc-100 pt-3">
                      <fieldset className="space-y-1 text-sm">
                        <legend className="mb-1 text-xs font-medium text-zinc-600">
                          {t("strategy.question")}
                        </legend>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="choice"
                            value="last_supplier"
                            disabled={!anyLast}
                            defaultChecked={lastOk}
                            data-strategy-choice="last_supplier"
                          />
                          {t("strategy.choice.last_supplier")}
                        </label>
                        {!lastOk ? (
                          <p
                            className="pl-6 text-xs text-zinc-500"
                            data-strategy-last-disabled={!anyLast || undefined}
                          >
                            {t(
                              anyLast
                                ? "strategy.lastOneProduct"
                                : "strategy.noLastPurchase",
                            )}
                          </p>
                        ) : null}
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="choice"
                            value="quote"
                            defaultChecked={!lastOk}
                            data-strategy-choice="quote"
                          />
                          {t("strategy.choice.quote")}
                        </label>
                      </fieldset>
                      <Field label={t("demand.notes")}>
                        <Textarea name="note" rows={2} />
                      </Field>
                      <div>
                        <SubmitButton data-strategy-submit>
                          {t("strategy.submit")}
                        </SubmitButton>
                      </div>
                    </div>
                  ) : null}
                </form>
              );
            })}
          </div>
        ) : (
          <Empty>{t("strategy.waitingEmpty")}</Empty>
        )}
      </Card>

      <Card title={t("strategy.open", { n: decisions.length })}>
        {decisions.length ? (
          <div className="space-y-3">
            {decisions.map((d) => {
              const demands = decisionDemands.filter((r) =>
                d.demandIds.includes(r.id),
              );
              const ref = d.reference?.[0];
              return (
                <section
                  key={d.id}
                  id={`decision-${d.id}`}
                  className="rounded-2xl border border-zinc-200 p-3"
                  data-strategy-decision={d.status}
                  data-strategy-decision-choice={d.choice}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      {t("strategy.decision", { n: d.number })}
                    </h3>
                    <Badge tone={d.status === "pending" ? "warning" : "success"}>
                      {t(`strategy.status.${d.status}` as DictionaryKey)}
                    </Badge>
                    <Badge tone="neutral">
                      {t(`strategy.choice.${d.choice}`)}
                    </Badge>
                  </div>
                  {d.note ? (
                    <p className="mt-1 text-xs text-zinc-600">{d.note}</p>
                  ) : null}
                  <ul className="mt-2 divide-y divide-zinc-100">
                    {demands.map((r) => demandRow(r, false))}
                  </ul>
                  {d.choice === "last_supplier" ? (
                    <div className="mt-2">{reference(ref)}</div>
                  ) : null}
                  {d.status === "pending" && canApprove ? (
                    <form
                      action={decideStrategyAction}
                      className="mt-3 grid gap-2 border-t border-zinc-100 pt-3"
                      data-strategy-approve-form
                    >
                      <input type="hidden" name="id" value={d.id} />
                      <Field label={t("strategy.approvalNote")}>
                        <Textarea name="note" rows={2} />
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <SubmitButton
                          name="decision"
                          value="approve"
                          data-strategy-approve
                        >
                          {t("strategy.approve")}
                        </SubmitButton>
                        <SubmitButton
                          name="decision"
                          value="reject"
                          variant="secondary"
                          data-strategy-reject
                        >
                          {t("strategy.reject")}
                        </SubmitButton>
                      </div>
                    </form>
                  ) : d.status === "pending" ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      {t("strategy.waitingApproval")}
                    </p>
                  ) : null}
                  {d.status === "approved" &&
                  d.choice === "last_supplier" &&
                  ref ? (
                    canOrder ? (
                      <form
                        action={orderFromStrategyAction}
                        className="mt-3 grid gap-2 border-t border-zinc-100 pt-3 sm:grid-cols-5"
                        data-strategy-order-form
                      >
                        <input type="hidden" name="id" value={d.id} />
                        <Field label={t("common.quantity")}>
                          <Input
                            name="quantity"
                            inputMode="numeric"
                            defaultValue={String(d.quantity)}
                            required
                          />
                        </Field>
                        <Field label={t("strategy.last.price")}>
                          <Input
                            name="unitPrice"
                            inputMode="decimal"
                            defaultValue={
                              ref.unitPrice !== null ? String(ref.unitPrice) : ""
                            }
                            data-strategy-order-price
                          />
                        </Field>
                        <Field label={t("strategy.currency")}>
                          <Input
                            name="currency"
                            defaultValue={ref.currency ?? "USD"}
                            maxLength={3}
                            required
                          />
                        </Field>
                        <Field label={t("strategy.last.leadTime")}>
                          <Input
                            name="leadTimeDays"
                            inputMode="numeric"
                            defaultValue={
                              ref.leadTimeDays !== null
                                ? String(ref.leadTimeDays)
                                : ""
                            }
                          />
                        </Field>
                        <Field label={t("strategy.last.incoterm")}>
                          <Select
                            name="incoterm"
                            defaultValue={
                              ref.incoterm === "EXW" || ref.incoterm === "FOB"
                                ? ref.incoterm
                                : ""
                            }
                          >
                            <option value="">—</option>
                            <option value="FOB">FOB</option>
                            <option value="EXW">EXW</option>
                          </Select>
                        </Field>
                        <div className="sm:col-span-5">
                          <SubmitButton data-strategy-order>
                            {t("strategy.generateOrder")}
                          </SubmitButton>
                        </div>
                      </form>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-500">
                        {t("strategy.waitingOrder")}
                      </p>
                    )
                  ) : null}
                  {d.status === "approved" && d.choice === "quote" ? (
                    <p
                      className="mt-2 text-xs text-zinc-600"
                      data-strategy-quote-pending
                    >
                      {t("strategy.quotePending")}
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : (
          <Empty>{t("strategy.openEmpty")}</Empty>
        )}
      </Card>
    </div>
  );
}
