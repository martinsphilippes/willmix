import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { SHEET_CURRENCIES, SHEET_INCOTERMS } from "@/lib/db/schema";
import {
  pendingProposal,
  supplierCanAnswer,
  supplierRequestDecisions,
} from "@/lib/supplier-requests";
import {
  getSupplierRequest,
  supplierRequestGroup,
} from "@/lib/services/supplier-requests";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Textarea,
  cx,
  formatMoney,
  linkClass,
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  answerSupplierRequestAction,
  decideSupplierRequestAction,
} from "../../actions/supplier-requests";
import { STATUS_TONE, answerText } from "../_components/status";
import {
  RequestProductCard,
  type RequestProductData,
} from "../_components/request-product";
import { canOpen } from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { SupplierNoLoginAlert } from "@/components/supplier-no-login";
import { partiesWithoutLogin } from "@/lib/services/portal-access";
import {
  notifyLateSupplierRequests,
  slaOf,
  supplierRequestSlaMinutes,
} from "@/lib/services/supplier-request-negotiation";
import { NegotiationCard, SlaBadge } from "../_components/negotiation";
import { can } from "@/lib/auth/function-access";
import { SupplierRequestTable } from "../_components/supplier-table";
import { RequestTimeline } from "../_components/timeline";
import { RequestChat, type ChatMessage } from "../_components/request-chat";
import { dateTime } from "../_components/negotiation";
import { canPostMessage } from "@/lib/supplier-requests";

/*
 * Uma solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md). O fornecedor vê
 * o item, a quantidade e o que a Wellmix precisa, e responde (até a Wellmix
 * decidir). A Wellmix vê também o booking, o Superplan do item e as
 * alternativas, registra a resposta quando ela chega por fora e decide.
 */

const SIGNAL_TONE: Record<string, Tone> = {
  viable: "success",
  below: "warning",
  loss: "danger",
};

export default async function SupplierRequestPage({
  params,
  searchParams,
}: PageProps<"/app/supplier-requests/[id]">) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/app/supplier-requests/${id}`);
  requireScreen(user, "quotes");
  const query = await searchParams;
  const one = (k: string) => {
    const v = query[k];
    return typeof v === "string" ? v : "";
  };
  const t = await getT();
  // SLA estourado: avisa uma vez (Wellmix e fornecedor) ao abrir a tela.
  await notifyLateSupplierRequests().catch((error) =>
    console.error("notifyLateSupplierRequests", error),
  );
  const detail = await getSupplierRequest(user, id).catch((error: unknown) => {
    if (error instanceof Error && error.message === "schema_outdated")
      return "schema" as const;
    throw error;
  });
  if (detail === "schema")
    return (
      <Alert tone="warning">
        {t("supplierRequests.selection.schemaMissing")}
      </Alert>
    );
  if (!detail) notFound();
  const { request: r, supplier, lot, chosen, alternatives } = detail;
  const wellmix = isWellmix(user);
  // Fornecedor sem login (só a Wellmix vê o aviso): enquanto a solicitação
  // está em andamento, ele não vê nem responde; a Wellmix registra por ele.
  const noLoginNow =
    wellmix &&
    !!supplier &&
    (r.status === "open" || r.status === "answered") &&
    (await partiesWithoutLogin([supplier.id])).has(supplier.id);
  const it = r.item;
  const intl = t.intl;
  const num = (n: number | null, digits = 4) =>
    n === null
      ? "—"
      : n.toLocaleString(intl, { maximumFractionDigits: digits });
  const col = (k: string) => t(`bookingLots.item.col.${k}` as DictionaryKey);

  const error = one("error");
  const errorKey = [`supplierRequests.error.${error}`, `common.${error}`].find(
    (k) => k in dictionaries.pt,
  ) as DictionaryKey | undefined;
  const errorText = !error
    ? null
    : errorKey
      ? t(errorKey)
      : fallbackError(t, error);
  const notices: string[] = [];
  if (one("created"))
    notices.push(
      t(
        noLoginNow
          ? "supplierRequests.detail.createdNoLogin"
          : "supplierRequests.detail.created",
      ),
    );
  if (one("answered")) notices.push(t("supplierRequests.detail.answered"));
  const decided = one("decided");
  if (["approved", "declined", "cancelled"].includes(decided))
    notices.push(
      t(`supplierRequests.detail.decided.${decided}` as DictionaryKey),
    );
  const negotiationNotice = one("negotiation");
  if (
    ["proposal", "accept", "counter", "reject", "message"].includes(
      negotiationNotice,
    )
  )
    notices.push(
      t(
        `supplierRequests.negotiation.notice.${negotiationNotice}` as DictionaryKey,
      ),
    );
  const productNotice = one("product");
  if (["created", "linked", "items", "released"].includes(productNotice))
    notices.push(t(`srProduct.notice.${productNotice}` as DictionaryKey));
  const erpNotice = one("erp");
  if (["checked", "unchecked", "cleared"].includes(erpNotice))
    notices.push(t(`srProduct.notice.erp.${erpNotice}` as DictionaryKey));

  const noLogin =
    noLoginNow && supplier ? [{ id: supplier.id, name: supplier.name }] : [];

  // Quem abre o link vê primeiro a tabela dos produtos da solicitação
  // (mesmo fornecedor e booking); "Abrir produto" leva à tela completa
  // (view=item).
  const itemView = one("view") === "item";
  const noticeBlock = (
    <div className="mb-3 space-y-2" data-supplier-request-notices>
      <SupplierNoLoginAlert
        suppliers={noLogin}
        canParties={canOpen(user, "parties")}
        t={t}
        title="supplierRequests.noLogin.request"
        hint="supplierRequests.noLogin.requestHint"
      />
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      {notices.map((n) => (
        <Alert key={n} tone="success">
          {n}
        </Alert>
      ))}
    </div>
  );
  if (!itemView) {
    const [rows, slaMinutes] = await Promise.all([
      supplierRequestGroup(user, r),
      supplierRequestSlaMinutes(),
    ]);
    return (
      <>
        <PageHeader
          t={t}
          title={t("supplierRequests.detail.title", { n: r.number })}
          subtitle={[
            wellmix ? supplier?.name : null,
            t(
              wellmix
                ? "supplierRequests.table.subtitleWellmix"
                : "supplierRequests.table.subtitle",
              { n: rows.length },
            ),
          ]
            .filter(Boolean)
            .join(" · ")}
          actions={
            <LinkButton href="/app/supplier-requests">
              {t("supplierRequests.detail.back")}
            </LinkButton>
          }
        />
        {noticeBlock}
        <div data-supplier-table>
          <SupplierRequestTable
            rows={rows}
            currentId={r.id}
            slaMinutes={slaMinutes}
            wellmix={wellmix}
            t={t}
          />
        </div>
      </>
    );
  }

  // Bloco "Produto": a Wellmix que abre Produtos, na solicitação aprovada.
  let productData: RequestProductData | null = null;
  if (wellmix && r.status === "approved" && canOpen(user, "products")) {
    const svc = await import("@/lib/services/supplier-request-product");
    const store = getStore();
    const q = {
      items: one("iq").slice(0, 80),
      products: one("pq").slice(0, 80),
      erp: one("eq").slice(0, 80),
    };
    const [product, lines, choices, catalog, erp] = await Promise.all([
      r.productId ? store.get("products", r.productId) : null,
      store.list("product_lines", {
        filter: { active: true },
        orderBy: "name",
      }),
      svc.requestItemChoices(r, q.items),
      r.productId ? Promise.resolve([]) : svc.searchCatalogProducts(q.products),
      r.productId && q.erp ? svc.searchSankhyaProducts(q.erp) : null,
    ]);
    const linkedCount = product
      ? (
          await store.list("booking_items", {
            filter: { productId: product.id },
          })
        ).length
      : 0;
    productData = {
      request: r,
      product,
      linkedCount,
      lines,
      choices,
      catalog,
      erp,
      query: q,
      suggestedName: (it.productName ?? it.description ?? "").slice(0, 160),
    };
  }

  const proposalPending = !!pendingProposal(r.negotiation);
  const canAnswer = supplierCanAnswer(r.status) && !proposalPending;
  // Decidir (aprovar, recusar, cancelar): só com a permissão (Equipe → Funções e acessos).
  const decisions =
    wellmix && can(user, "supplierRequest.decide")
      ? supplierRequestDecisions(r.status, r.supplierCanDo, proposalPending)
      : [];
  const sla = slaOf(r, await supplierRequestSlaMinutes());
  const decimal = intl.startsWith("pt") ? "," : ".";
  const raw = (n: number | null) =>
    n === null ? "" : String(n).replace(".", decimal);

  // Conversa no chat flutuante: as mensagens livres, de quem é cada uma.
  const mySide = wellmix ? "wellmix" : "supplier";
  const chatMessages: ChatMessage[] = (r.negotiation ?? [])
    .filter((e) => e.kind === "message")
    .map((e) => ({
      id: e.id,
      mine: e.side === mySide,
      sideLabel: t(`supplierRequests.negotiation.side.${e.side}`),
      at: dateTime(e.at, t),
      text: e.text ?? null,
      documentId: e.documentId ?? null,
      fileName: e.fileName ?? null,
    }));

  return (
    <>
      <PageHeader
        t={t}
        title={t("supplierRequests.detail.title", { n: r.number })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[r.status]}>
              {t(`supplierRequests.status.${r.status}` as DictionaryKey)}
            </Badge>
            <SlaBadge sla={sla} t={t} />
            {wellmix && supplier ? <span>{supplier.name}</span> : null}
          </span>
        }
        actions={
          <LinkButton
            href={`/app/supplier-requests/${r.id}`}
            data-supplier-table-back
          >
            {t("supplierRequests.table.back")}
          </LinkButton>
        }
      />
      {noticeBlock}

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          <Card title={t("supplierRequests.detail.request")}>
            <div className="flex flex-wrap gap-4">
              {it.photoDocumentId ? (
                <a
                  href={`/api/files/${it.photoDocumentId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                  <img
                    src={`/api/files/${it.photoDocumentId}`}
                    alt=""
                    className="h-32 w-32 rounded-lg border border-zinc-200 object-cover"
                  />
                </a>
              ) : null}
              <div className="min-w-60 flex-1">
                <DescriptionList
                  items={[
                    [
                      t("supplierRequests.detail.item"),
                      <span key="i" className="flex flex-col">
                        <span className="font-medium">
                          {it.description ?? it.productName ?? "—"}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {[it.factoryItemCode, it.itemNumber]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>,
                    ],
                    [
                      t("supplierRequests.detail.quantity"),
                      <strong key="q">
                        {t("supplierRequests.detail.pieces", {
                          n: r.quantity.toLocaleString(intl),
                        })}
                      </strong>,
                    ],
                    [
                      t("supplierRequests.detail.bookingPrice"),
                      it.price === null
                        ? "—"
                        : `${num(it.price)} ${it.currency ?? ""} ${it.incoterm ?? ""}`.trim(),
                    ],
                    [col("moq"), num(it.moq, 0)],
                  ]}
                />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("supplierRequests.detail.needs")}
              </h3>
              <p
                className="mt-1 whitespace-pre-wrap text-sm text-zinc-900"
                data-supplier-request-needs
              >
                {r.needs ?? t("supplierRequests.detail.needsNone")}
              </p>
            </div>
            <div className="mt-4">
              <DescriptionList
                items={[
                  [col("masterCartonQty"), num(it.masterCartonQty, 0)],
                  [col("innerQty"), num(it.innerQty, 0)],
                  [col("netWeightPcKg"), num(it.netWeightPcKg)],
                  [col("grossWeightPcKg"), num(it.grossWeightPcKg)],
                  [col("cbmPerCarton"), num(it.cbmPerCarton)],
                  [
                    t("supplierRequests.selection.col.size"),
                    [it.lengthCm, it.widthCm, it.heightCm]
                      .map((n) => num(n, 2))
                      .join(" × "),
                  ],
                  [col("capacityMl"), num(it.capacityMl, 0)],
                  [col("packageType"), it.packageType ?? "—"],
                  [col("material"), it.material ?? "—"],
                  [col("colorAssortment"), it.colorAssortment ?? "—"],
                  [col("powerDetail"), it.powerDetail ?? "—"],
                ]}
              />
            </div>
          </Card>

          <RequestTimeline request={r} t={t} />

          {wellmix ? (
            <Card
              title={t("supplierRequests.detail.alternatives", {
                n: alternatives.length,
              })}
            >
              <p className="mb-2 text-xs text-zinc-500">
                {t("supplierRequests.detail.alternativesHint")}
              </p>
              {alternatives.length ? (
                <ul className="divide-y divide-zinc-100 text-sm">
                  {alternatives.map(({ item, lot: l, supplier: s }) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                      data-supplier-request-alternative={item.id}
                    >
                      <span>
                        <span className="font-medium">
                          {item.description ?? item.productName ?? "—"}
                        </span>{" "}
                        <span className="text-xs text-zinc-500">
                          {[item.factoryItemCode, s?.name, l?.origin]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-zinc-600">
                        <span className="tabular-nums">
                          {num(item.price)} {item.currency ?? ""}
                        </span>
                        {item.analysis?.minimumBrl != null ? (
                          <span>
                            {t("bookingLots.item.minimum", {
                              price: formatMoney(
                                item.analysis.minimumBrl,
                                "BRL",
                                t,
                              ),
                            })}
                          </span>
                        ) : null}
                        {l ? (
                          <Link
                            href={`/app/booking/lots/${l.id}`}
                            className={linkClass}
                          >
                            nº {l.number}
                          </Link>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">
                  {t("supplierRequests.detail.alternativesNone")}
                </p>
              )}
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card title={t("supplierRequests.detail.answer.title")} dense>
            {r.supplierCanDo ? (
              <div className="mb-3 space-y-1 text-sm" data-supplier-answer>
                <p className="font-semibold">{answerText(t, r)}</p>
                {r.supplierMoq !== null ? (
                  <p>
                    {t("supplierRequests.detail.answer.moq")}:{" "}
                    {num(r.supplierMoq, 0)}
                  </p>
                ) : null}
                {r.supplierLeadTimeDays !== null ? (
                  <p>
                    {t("supplierRequests.detail.answer.leadTime")}:{" "}
                    {num(r.supplierLeadTimeDays, 0)}
                  </p>
                ) : null}
                {r.supplierIncoterm ? (
                  <p data-supplier-answer-incoterm-value>
                    {t("supplierRequests.detail.answer.incoterm")}:{" "}
                    {r.supplierIncoterm}
                  </p>
                ) : null}
                {r.supplierNote ? (
                  <p className="whitespace-pre-wrap text-zinc-700">
                    {r.supplierNote}
                  </p>
                ) : null}
                {r.respondedAt ? (
                  <p className="text-xs text-zinc-500">
                    {t("supplierRequests.detail.answer.at", {
                      date: dateTime(r.respondedAt, t),
                    })}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mb-3 text-sm text-zinc-500">
                {t("supplierRequests.detail.answer.none")}
              </p>
            )}
            {canAnswer ? (
              <form
                action={answerSupplierRequestAction}
                className="space-y-2"
                data-supplier-answer-form
              >
                <input type="hidden" name="id" value={r.id} />
                {wellmix ? (
                  <p className="text-xs text-zinc-500">
                    {t("supplierRequests.detail.answer.wellmixHint")}
                  </p>
                ) : r.supplierCanDo ? (
                  <p className="text-xs text-zinc-500">
                    {t("supplierRequests.detail.answer.change")}
                  </p>
                ) : null}
                <Field label={t("supplierRequests.detail.answer.canDo")}>
                  <Select
                    name="canDo"
                    required
                    defaultValue={r.supplierCanDo ?? ""}
                    data-supplier-answer-cando
                  >
                    <option value="" disabled>
                      {t("common.select")}
                    </option>
                    <option value="yes">
                      {t("supplierRequests.detail.answer.yes")}
                    </option>
                    <option value="no">
                      {t("supplierRequests.detail.answer.no")}
                    </option>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("supplierRequests.detail.answer.price")}>
                    <Input
                      name="price"
                      inputMode="decimal"
                      defaultValue={raw(r.supplierPrice)}
                      data-supplier-answer-price
                    />
                  </Field>
                  <Field label={t("supplierRequests.detail.answer.currency")}>
                    <Select
                      name="currency"
                      defaultValue={r.supplierCurrency ?? it.currency ?? "USD"}
                    >
                      {SHEET_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("supplierRequests.detail.answer.moq")}>
                    <Input
                      name="moq"
                      inputMode="numeric"
                      defaultValue={raw(r.supplierMoq)}
                    />
                  </Field>
                  <Field label={t("supplierRequests.detail.answer.leadTime")}>
                    <Input
                      name="leadTimeDays"
                      inputMode="numeric"
                      defaultValue={raw(r.supplierLeadTimeDays)}
                    />
                  </Field>
                  <Field label={t("supplierRequests.detail.answer.incoterm")}>
                    <Select
                      name="incoterm"
                      defaultValue={r.supplierIncoterm ?? it.incoterm ?? "FOB"}
                      data-supplier-answer-incoterm
                    >
                      {SHEET_INCOTERMS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label={t("supplierRequests.detail.answer.note")}>
                  <Textarea
                    name="note"
                    rows={3}
                    maxLength={4000}
                    defaultValue={r.supplierNote ?? ""}
                  />
                </Field>
                <SubmitButton
                  variant={wellmix ? "secondary" : "primary"}
                  pendingText={t("supplierRequests.detail.answer.pending")}
                  data-supplier-answer-submit
                >
                  {t(
                    wellmix
                      ? "supplierRequests.detail.answer.submitWellmix"
                      : "supplierRequests.detail.answer.submit",
                  )}
                </SubmitButton>
              </form>
            ) : null}
          </Card>

          {wellmix ? (
            <Card title={t("supplierRequests.detail.decide.title")} dense>
              {r.decidedAt ? (
                <p className="mb-2 text-sm text-zinc-600">
                  {t("supplierRequests.detail.decide.at", {
                    date: dateTime(r.decidedAt, t),
                  })}
                  {r.decisionNote ? ` · ${r.decisionNote}` : ""}
                </p>
              ) : null}
              {proposalPending ? (
                <p
                  className="mb-2 text-xs text-amber-800"
                  data-supplier-decide-blocked
                >
                  {t("supplierRequests.negotiation.approveBlocked")}
                </p>
              ) : null}
              {decisions.length ? (
                <form
                  action={decideSupplierRequestAction}
                  className="space-y-2"
                  data-supplier-decide-form
                >
                  <input type="hidden" name="id" value={r.id} />
                  <Field label={t("supplierRequests.detail.decide.note")}>
                    <Input name="note" maxLength={500} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {decisions.map((d) => (
                      <SubmitButton
                        key={d}
                        name="decision"
                        value={d}
                        variant={
                          d === "approved"
                            ? "primary"
                            : d === "declined"
                              ? "danger"
                              : "secondary"
                        }
                        data-supplier-decide={d}
                      >
                        {t(
                          `supplierRequests.detail.decide.${d}` as DictionaryKey,
                        )}
                      </SubmitButton>
                    ))}
                  </div>
                </form>
              ) : null}
            </Card>
          ) : null}

          {wellmix ? (
            <Card title={t("supplierRequests.detail.booking")} dense>
              <div className="space-y-1 text-sm">
                {lot ? (
                  <Link
                    href={`/app/booking/lots/${lot.id}`}
                    className={linkClass}
                  >
                    {t("supplierRequests.detail.bookingOf", {
                      n: lot.number,
                      file: lot.fileName,
                    })}
                  </Link>
                ) : null}
                {chosen?.analysis ? (
                  <div className="pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t("supplierRequests.detail.chosenSuperplan")}
                    </p>
                    <span className={cx("mt-1 flex flex-wrap gap-2")}>
                      <Badge
                        tone={
                          chosen.analysis.verdict
                            ? SIGNAL_TONE[chosen.analysis.verdict]
                            : "neutral"
                        }
                      >
                        {t(
                          `booking.signal.${chosen.analysis.verdict ?? "missing"}` as DictionaryKey,
                        )}
                      </Badge>
                      {chosen.analysis.minimumBrl !== null ? (
                        <span className="text-xs text-zinc-600">
                          {t("bookingLots.item.minimum", {
                            price: formatMoney(
                              chosen.analysis.minimumBrl,
                              "BRL",
                              t,
                            ),
                          })}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          {/* Contraproposta: na coluna da direita, embaixo do Booking (a
              conversa fica no chat flutuante). */}
          <NegotiationCard request={r} wellmix={wellmix} t={t} />
        </div>
      </div>
      {wellmix && r.orderId ? (
        <div className="mt-4" data-supplier-request-order>
          <Alert tone="info">
            <Link href={`/app/orders/${r.orderId}`} className={linkClass}>
              {t("purchaseOrder.detail.inOrder")}
            </Link>
          </Alert>
        </div>
      ) : wellmix && r.status === "approved" && r.productId ? (
        <div className="mt-4" data-supplier-request-order-pending>
          <Alert tone="info">
            <Link
              href="/app/supplier-requests#pedido-de-compra"
              className={linkClass}
            >
              {t("purchaseOrder.detail.generate")}
            </Link>
          </Alert>
        </div>
      ) : null}
      {productData ? (
        <div className="mt-4" data-request-product>
          <RequestProductCard data={productData} t={t} />
        </div>
      ) : null}
      <RequestChat
        requestId={r.id}
        messages={chatMessages}
        canPost={canPostMessage(r.status)}
        defaultOpen={negotiationNotice === "message"}
        labels={{
          open: t("supplierRequests.chat.open"),
          title: t("supplierRequests.chat.title", { n: r.number }),
          close: t("supplierRequests.chat.close"),
          empty: t("supplierRequests.chat.empty"),
          placeholder: t("supplierRequests.chat.placeholder"),
          attach: t("supplierRequests.negotiation.attach"),
          send: t("supplierRequests.chat.send"),
          sending: t("supplierRequests.negotiation.sending"),
          file: t("supplierRequests.negotiation.file"),
          closed: t("supplierRequests.chat.closed"),
        }}
      />
    </>
  );
}
