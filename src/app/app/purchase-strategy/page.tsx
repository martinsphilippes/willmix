import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { can, canSeePurchasePrice } from "@/lib/auth/function-access";
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
  requestKey,
  sameLastSupplier,
  strategySuppliers,
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
 * uma fila só do Comprador com reposições e encomendas. Por solicitação
 * (todos os produtos dela juntos; dono, 18/11/2026), com a última compra de
 * cada produto e, em "cotar", os fornecedores do País × Família marcados;
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
    listByIds(store, "parties", [
      ...allDemands.map((d) => d.customerId),
      ...decisions.flatMap((d) => d.supplierIds ?? []),
    ]),
    lastPurchases(productIds),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const partyName = (id: string) =>
    parties.find((p) => p.id === id)?.name ?? "—";
  const canChoose = canChooseStrategy(user);
  const canApprove = canApproveStrategy(user);
  const canOrder =
    can(user, "purchaseOrder.generate") && canOpen(user, "orders");
  // Preço da última compra: só com "Ver preço de compra" (dono, 15/11/2026;
  // docs/LINHA_DE_VISAO.md, seção 7). Sem ela, o pedido sai com o preço
  // gravado na decisão.
  const seesPrice = canSeePurchasePrice(user);

  // Fila: por solicitação, com todos os produtos dela (dono, 18/11/2026).
  const groups = new Map<string, Request[]>();
  for (const d of waiting) {
    const key = requestKey(d);
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  // País × Família e os fornecedores de cada solicitação (para "cotar").
  const origins = new Map(
    canChoose
      ? await Promise.all(
          [...groups.entries()]
            .filter(([, demands]) => demands.every((d) => d.productId))
            .map(
              async ([key, demands]) =>
                [key, await strategySuppliers(demands)] as const,
            ),
        )
      : [],
  );
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
        {seesPrice ? (
          <div>
            <dt className="text-zinc-500">{t("strategy.last.price")}</dt>
            <dd className="font-medium tabular-nums">
              {ref.unitPrice !== null
                ? `${ref.currency ?? ""} ${ref.unitPrice.toLocaleString(t.intl, { maximumFractionDigits: 4 })}`
                : "—"}
            </dd>
          </div>
        ) : null}
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
      {checkbox ? <input type="hidden" name="demandIds" value={d.id} /> : null}
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
              // Produto fora do catálogo: a solicitação espera o cadastro.
              const noProduct = demands.some((d) => !d.productId);
              const origin = origins.get(key);
              const number = demands[0].number;
              // "Fornecedor da última compra" vale para um produto só, com
              // compra anterior (o servidor confere).
              const anyLast = productsHere.some((id) => references.has(id));
              // Todos os produtos com compra anterior do mesmo fornecedor
              // (dono, 18/11/2026).
              const lastOk = sameLastSupplier(productsHere, references);
              return (
                <form
                  key={key}
                  action={chooseStrategyAction}
                  className="group rounded-2xl border border-zinc-200 p-3"
                  data-strategy-group={key}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      {number
                        ? t("strategy.request", { n: number })
                        : t("strategy.requestNoNumber")}
                    </h3>
                    <span className="text-xs text-zinc-600">
                      {partyName(demands[0].customerId)} ·{" "}
                      {t("strategy.requestProducts", { n: demands.length })}
                    </span>
                    {origin ? (
                      <Badge tone="neutral">
                        <span data-strategy-origin>
                          {origin.countryName || origin.familyName
                            ? `${origin.countryName || "—"} › ${origin.familyName || "—"}`
                            : t("strategy.originMissing")}
                        </span>
                      </Badge>
                    ) : null}
                  </div>
                  {noProduct ? (
                    <p className="mt-1 text-xs text-amber-800">
                      {t("strategy.noProduct")}: {t("strategy.noProductHint")}
                    </p>
                  ) : canChoose ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("strategy.wholeRequest")}
                    </p>
                  ) : null}
                  {[...productsHere, ...(noProduct ? [null] : [])].map(
                    (pid) => (
                      <div key={pid ?? "none"} className="mt-3 space-y-1">
                        <p className="text-sm font-medium text-zinc-800">
                          {pid
                            ? productNameText(
                                t,
                                productById.get(pid)?.name ?? "",
                              )
                            : t("strategy.noProduct")}
                        </p>
                        {pid ? reference(references.get(pid)) : null}
                        <ul className="divide-y divide-zinc-100">
                          {demands
                            .filter((d) => (d.productId ?? null) === pid)
                            .map((d) => demandRow(d, canChoose && !noProduct))}
                        </ul>
                      </div>
                    ),
                  )}
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
                            disabled={!lastOk}
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
                                ? productsHere.every((id) => references.has(id))
                                  ? "strategy.lastSameSupplier"
                                  : "strategy.lastAllProducts"
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
                      {origin ? (
                        <fieldset
                          className="hidden rounded-xl border border-zinc-200 p-2 group-has-[[data-strategy-choice=quote]:checked]:block"
                          data-strategy-suppliers={origin.suppliers.length}
                        >
                          <input type="hidden" name="supplierList" value="1" />
                          <legend className="px-1 text-xs font-medium text-zinc-700">
                            {t("strategy.suppliers.title", {
                              n: origin.suppliers.length,
                            })}
                          </legend>
                          {origin.suppliers.length ? (
                            <>
                              <p className="mb-1 text-xs text-zinc-500">
                                {t("strategy.suppliers.hint")}
                              </p>
                              <ul className="grid gap-1 sm:grid-cols-2">
                                {origin.suppliers.map((sup) => (
                                  <li key={sup.id}>
                                    <label className="flex items-start gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        name="supplierIds"
                                        value={sup.id}
                                        defaultChecked
                                        className="mt-0.5 h-4 w-4"
                                        data-strategy-supplier={sup.id}
                                      />
                                      <span>
                                        {sup.name}
                                        <span className="block text-xs text-zinc-500">
                                          {[
                                            sup.type !== "supplier"
                                              ? t(
                                                  `messages.type.${sup.type}` as DictionaryKey,
                                                )
                                              : null,
                                            ...sup.reasons.map((r) =>
                                              t(`strategy.suppliers.${r}`),
                                            ),
                                          ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                        </span>
                                      </span>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : (
                            <p
                              className="text-xs text-amber-800"
                              data-strategy-suppliers-empty
                            >
                              {t("strategy.suppliers.empty")}
                            </p>
                          )}
                        </fieldset>
                      ) : null}
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
              // Uma linha por produto da solicitação, com a quantidade somada
              // e a última compra de cada um (todos do mesmo fornecedor).
              const orderLines = [
                ...new Set(demands.map((r) => r.productId).filter(Boolean)),
              ].map((productId) => ({
                productId: productId as string,
                quantity: demands
                  .filter((r) => r.productId === productId)
                  .reduce((sum, r) => sum + r.quantity, 0),
                ref: d.reference?.find((x) => x.productId === productId),
              }));
              const leadTimes = orderLines
                .map((l) => l.ref?.leadTimeDays)
                .filter((n): n is number => typeof n === "number");
              const leadTime = leadTimes.length ? Math.max(...leadTimes) : null;
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
                    <Badge
                      tone={d.status === "pending" ? "warning" : "success"}
                    >
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
                  {d.choice === "last_supplier"
                    ? orderLines.map((line) => (
                        <div key={line.productId} className="mt-2 space-y-0.5">
                          {orderLines.length > 1 ? (
                            <p className="text-xs font-medium text-zinc-800">
                              {productNameText(
                                t,
                                productById.get(line.productId)?.name ?? "",
                              )}
                            </p>
                          ) : null}
                          {reference(line.ref)}
                        </div>
                      ))
                    : null}
                  {d.choice === "quote" ? (
                    <p
                      className="mt-2 text-xs text-zinc-700"
                      data-strategy-decision-suppliers={
                        d.supplierIds?.length ?? ""
                      }
                    >
                      <span className="font-medium">
                        {d.supplierIds
                          ? t("strategy.suppliers.chosen", {
                              n: d.supplierIds.length,
                            })
                          : t("strategy.suppliers.lines")}
                      </span>
                      {d.supplierIds?.length
                        ? `: ${d.supplierIds.map(partyName).join(", ")}`
                        : null}
                    </p>
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
                        {orderLines.map((line) => (
                          <div
                            key={line.productId}
                            className="grid gap-2 sm:col-span-5 sm:grid-cols-5"
                            data-strategy-order-line={line.productId}
                          >
                            <input
                              type="hidden"
                              name="productIds"
                              value={line.productId}
                            />
                            <p className="self-end pb-2 text-sm font-medium text-zinc-800 sm:col-span-2">
                              {productNameText(
                                t,
                                productById.get(line.productId)?.name ??
                                  line.productId,
                              )}
                            </p>
                            <Field label={t("common.quantity")}>
                              <Input
                                name={`quantity__${line.productId}`}
                                inputMode="numeric"
                                defaultValue={String(line.quantity)}
                                required
                              />
                            </Field>
                            {seesPrice ? (
                              <Field label={t("strategy.last.price")}>
                                <Input
                                  name={`unitPrice__${line.productId}`}
                                  inputMode="decimal"
                                  defaultValue={
                                    line.ref?.unitPrice != null
                                      ? String(line.ref.unitPrice)
                                      : ""
                                  }
                                  data-strategy-order-price
                                />
                              </Field>
                            ) : null}
                          </div>
                        ))}
                        {seesPrice ? (
                          <Field label={t("strategy.currency")}>
                            <Input
                              name="currency"
                              defaultValue={ref.currency ?? "USD"}
                              maxLength={3}
                              required
                            />
                          </Field>
                        ) : null}
                        <Field label={t("strategy.last.leadTime")}>
                          <Input
                            name="leadTimeDays"
                            inputMode="numeric"
                            defaultValue={
                              leadTime !== null ? String(leadTime) : ""
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
                      {t("strategy.quotePending")}{" "}
                      {d.quoteId ? (
                        <Link
                          href={`/app/purchase-quotes/${d.quoteId}`}
                          className={linkClass}
                          data-strategy-quote-link={d.quoteId}
                        >
                          {t("strategy.openQuote")}
                        </Link>
                      ) : null}
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
