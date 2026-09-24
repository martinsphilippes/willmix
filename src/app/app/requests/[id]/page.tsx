import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canSeeSupplier, isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getRequestForUser } from "@/lib/services/requests";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  formatMoney,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  answerQuoteAction,
  confirmDownPaymentAction,
  openRfqAction,
  selectQuoteAction,
} from "../../actions";

export default async function RequestDetailPage({
  params,
  searchParams,
}: PageProps<"/app/requests/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { error } = await searchParams;
  const request = await getRequestForUser(user, id);
  if (!request) notFound();
  const t = await getT();
  const store = getStore();
  const wellmix = isWellmix(user);

  const [customer, quotes, suppliers, documents, payments] = await Promise.all([
    store.get("parties", request.customerId),
    store.list("quotes", { filter: { requestId: request.id } }),
    wellmix
      ? store.list("parties", {
          filter: { type: "supplier", active: true },
          orderBy: "name",
        })
      : Promise.resolve([]),
    store.list("documents", { filter: { requestId: request.id } }),
    store.list("payments", { filter: { requestId: request.id } }),
  ]);
  const supplierName = (supplierId: string) =>
    suppliers.find((s) => s.id === supplierId)?.name ?? supplierId;
  const invited = new Set(quotes.map((q) => q.supplierId));
  const selectedQuote = quotes.find((q) => q.id === request.selectedQuoteId);
  const downPayment = payments.find((p) => p.direction === "customer_in");

  return (
    <>
      <PageHeader
        help={{ body: "help.request.body", steps: "help.request.steps" }}
        t={t}
        title={request.productName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={request.status === "ORDERED" ? "success" : "info"}>
              {t(`reqStatusLabel.${request.status}`)}
            </Badge>
            {wellmix ? <span>{customer?.name}</span> : null}
          </span>
        }
        actions={
          request.orderId ? (
            <LinkButton
              href={`/app/orders/${request.orderId}`}
              variant="primary"
            >
              {t("requests.viewOrder")}
            </LinkButton>
          ) : null
        }
      />
      {error ? (
        <Alert tone="danger">
          {t("common.error")} ({error})
        </Alert>
      ) : null}

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={t("requests.title")}>
            <DescriptionList
              items={[
                [t("common.quantity"), `${request.quantity} ${request.unit}`],
                [t("requests.deadline"), formatDate(request.deadline)],
                [t("requests.description"), request.description],
                [t("requests.specification"), request.specification],
                [t("common.note"), request.notes],
              ]}
            />
            {documents.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                {documents.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/api/files/${d.id}`}
                      className="underline"
                      target="_blank"
                    >
                      {d.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          {/* RFQ: Wellmix escolhe fornecedores */}
          {wellmix &&
          ["REQUESTED", "RFQ_OPEN", "QUOTATION_RECEIVED"].includes(
            request.status,
          ) ? (
            <Card title={t("requests.rfq.open")}>
              <form action={openRfqAction} className="space-y-3">
                <input type="hidden" name="requestId" value={request.id} />
                <p className="text-sm text-zinc-600">
                  {t("requests.rfq.select")}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {suppliers.map((s) => (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${invited.has(s.id) ? "border-zinc-200 bg-zinc-50 text-zinc-500" : "border-zinc-300"}`}
                    >
                      <input
                        type="checkbox"
                        name="supplierIds"
                        value={s.id}
                        disabled={invited.has(s.id)}
                        defaultChecked={invited.has(s.id)}
                      />
                      <span>
                        {s.name}{" "}
                        <span className="text-zinc-400">· {s.country}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <SubmitButton>{t("requests.rfq.open")}</SubmitButton>
              </form>
            </Card>
          ) : null}

          {/* Comparação de cotações (só Wellmix vê fornecedores e preços FOB) */}
          {wellmix && quotes.length > 0 ? (
            <Card title={t("requests.quotes.compare")}>
              <Table>
                <thead>
                  <tr>
                    <Th>{t("common.supplier")}</Th>
                    <Th>{t("common.price")}</Th>
                    <Th>{t("common.leadTime")}</Th>
                    <Th>{t("common.conditions")}</Th>
                    <Th>{t("common.status")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.id}>
                      <Td className="font-medium">
                        {supplierName(q.supplierId)}
                      </Td>
                      {q.status === "invited" &&
                      ["RFQ_OPEN", "QUOTATION_RECEIVED"].includes(
                        request.status,
                      ) ? (
                        <Td colSpan={3}>
                          <form
                            action={answerQuoteAction}
                            className="flex flex-wrap items-end gap-2"
                          >
                            <input type="hidden" name="quoteId" value={q.id} />
                            <input
                              type="hidden"
                              name="back"
                              value={`/app/requests/${request.id}`}
                            />
                            <Input
                              name="price"
                              type="number"
                              step="0.0001"
                              min="0"
                              required
                              placeholder={t("common.price")}
                              className="max-w-28"
                            />
                            <Input
                              name="currency"
                              maxLength={3}
                              defaultValue="USD"
                              className="max-w-20"
                            />
                            <Input
                              name="leadTimeDays"
                              type="number"
                              min="1"
                              required
                              placeholder={t("common.leadTime")}
                              className="max-w-28"
                            />
                            <Input
                              name="conditions"
                              placeholder={t("common.conditions")}
                              className="max-w-44"
                            />
                            <SubmitButton variant="secondary">
                              {t("requests.quotes.register")}
                            </SubmitButton>
                          </form>
                          <p className="mt-1 text-xs text-zinc-500">
                            {t("requests.quotes.registerHint")}
                          </p>
                        </Td>
                      ) : (
                        <>
                          <Td>
                            {q.price !== null
                              ? `${formatMoney(q.price, q.currency)} / ${request.unit}`
                              : t("requests.quotes.waiting")}
                          </Td>
                          <Td>{q.leadTimeDays ?? "—"}</Td>
                          <Td>{q.conditions ?? "—"}</Td>
                        </>
                      )}
                      <Td>
                        <Badge
                          tone={
                            q.status === "selected"
                              ? "success"
                              : q.status === "answered"
                                ? "info"
                                : "neutral"
                          }
                        >
                          {t(`quoteStatus.${q.status}`)}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {["RFQ_OPEN", "QUOTATION_RECEIVED"].includes(request.status) &&
              quotes.some((q) => q.status === "answered") ? (
                <form
                  action={selectQuoteAction}
                  className="mt-4 grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-4"
                >
                  <input type="hidden" name="requestId" value={request.id} />
                  <Field label={t("common.supplier")}>
                    <select
                      name="quoteId"
                      required
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                    >
                      {quotes
                        .filter((q) => q.status === "answered")
                        .map((q) => (
                          <option key={q.id} value={q.id}>
                            {supplierName(q.supplierId)} ·{" "}
                            {formatMoney(q.price, q.currency)}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label={t("requests.sellPrice")}>
                    <Input
                      name="sellPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                    />
                  </Field>
                  <Field label={t("common.currency")}>
                    <Input
                      name="sellCurrency"
                      defaultValue="BRL"
                      maxLength={3}
                    />
                  </Field>
                  <Field label={t("requests.downPayment")}>
                    <Input
                      name="downPaymentAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="30%"
                    />
                  </Field>
                  <div className="sm:col-span-4">
                    <SubmitButton>{t("requests.quotes.select")}</SubmitButton>
                  </div>
                </form>
              ) : null}
            </Card>
          ) : null}

          {/* Proposta e sinal */}
          {request.status === "WAITING_DOWN_PAYMENT" ||
          request.status === "ORDERED" ? (
            <Card title={t("requests.proposal")}>
              <DescriptionList
                items={[
                  [
                    t("requests.sellPrice"),
                    formatMoney(request.sellPrice, request.sellCurrency),
                  ],
                  [
                    t("requests.downPayment"),
                    formatMoney(
                      request.downPaymentAmount,
                      request.sellCurrency,
                    ),
                  ],
                  [
                    t("common.status"),
                    downPayment ? (
                      <Badge
                        tone={
                          downPayment.status === "pending"
                            ? "warning"
                            : "success"
                        }
                      >
                        {downPayment.status}
                      </Badge>
                    ) : (
                      "—"
                    ),
                  ],
                  ...(canSeeSupplier(user) && selectedQuote
                    ? [
                        [
                          t("common.supplier"),
                          supplierName(selectedQuote.supplierId),
                        ] as [string, string],
                      ]
                    : []),
                ]}
              />
              {request.status === "WAITING_DOWN_PAYMENT" ? (
                <div className="mt-4 space-y-3">
                  <Alert tone="warning">
                    {t("requests.payment.instructions", {
                      amount: formatMoney(
                        request.downPaymentAmount,
                        request.sellCurrency,
                      ),
                    })}
                  </Alert>
                  {wellmix ? (
                    <form
                      action={confirmDownPaymentAction}
                      className="flex flex-wrap items-end gap-3"
                    >
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.id}
                      />
                      <Field label={t("requests.payment.proof")}>
                        <Input name="proof" type="file" />
                      </Field>
                      <SubmitButton>
                        {t("requests.payment.confirm")}
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card title={t("orders.timeline")}>
            <ol className="space-y-2 text-sm">
              {(
                [
                  "REQUESTED",
                  "RFQ_OPEN",
                  "QUOTATION_RECEIVED",
                  "WAITING_DOWN_PAYMENT",
                  "ORDERED",
                ] as const
              ).map((s, i, arr) => {
                const idx = arr.indexOf(request.status as (typeof arr)[number]);
                const done = idx >= i;
                const current = idx === i;
                return (
                  <li key={s} className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${done ? (current && s !== "ORDERED" ? "bg-blue-500" : "bg-emerald-500") : "bg-zinc-300"}`}
                    />
                    <span className={done ? "text-zinc-900" : "text-zinc-400"}>
                      {t(`reqStatusLabel.${s}`)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
