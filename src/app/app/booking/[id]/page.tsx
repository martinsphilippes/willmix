import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import {
  BOOKING_EMPTY,
  bookingSignal,
  hidesFromShowcase,
  type BookingSignal,
} from "@/lib/booking";
import type { BookingStatus } from "@/lib/db/schema";
import { BOOKING_STOCK_OPTION, getBookingDetail } from "@/lib/services/booking";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
  TextLink,
  Th,
  formatDate,
  formatMoney,
  type Tone,
} from "@/components/ui";
import { FormDraftGuard } from "@/components/form-draft-guard";
import { SubmitButton } from "@/components/submit-button";
import { saveBookingRowAction } from "../../actions/booking";

/*
 * Uma linha do Booking (docs/BOOKING.md): etapa, cliente, quantidade
 * reservada, responsável e observação (um formulário só); os dados que vieram
 * da ficha técnica; a análise do Superplan (só para quem o abre) e o
 * histórico da linha.
 */

const ID = /^[A-Za-z0-9_-]{1,64}$/;

const STATUS_TONE: Record<BookingStatus, Tone> = {
  new: "neutral",
  analysis: "info",
  approved: "success",
  offered: "brand",
  reserved: "warning",
  requested: "success",
  discarded: "danger",
};
const SIGNAL_TONE: Record<BookingSignal, Tone> = {
  viable: "success",
  below: "warning",
  loss: "danger",
  minimum: "neutral",
  missing: "info",
  none: "neutral",
};

export default async function BookingRowPage({
  params,
  searchParams,
}: PageProps<"/app/booking/[id]">) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/app/booking`);
  requireScreen(user, "booking");
  if (!ID.test(id)) notFound();
  const t = await getT();
  const query = await searchParams;
  const detail = await getBookingDetail(user, id, { intl: t.intl });
  if (!detail) notFound();
  const { row, options } = detail;
  const a = row.analysis;

  const intl = t.intl;
  const number = (n: number | null | undefined, digits = 0) =>
    n === null || n === undefined
      ? "—"
      : n.toLocaleString(intl, { maximumFractionDigits: digits });
  const statusLabel = (s: string) => t(`booking.status.${s}` as DictionaryKey);
  const col = (key: string) => t(`booking.col.${key}` as DictionaryKey);
  const name = row.name || t("booking.productMissing");
  // "Virou solicitação": o que a linha permite depende da solicitação dela
  // (sendo criada, em andamento, virou pedido/cancelada, ou não nasceu).
  const unlinked = detail.link === "missing";
  const pending = detail.link === "pending";
  const closed = detail.link === "closed";
  const locked = row.status === "requested" && !unlinked;
  const hidden = hidesFromShowcase(row.status);

  const errorCode = typeof query.error === "string" ? query.error : "";
  const errorText = !errorCode
    ? null
    : ([`booking.error.${errorCode}`, `common.${errorCode}`]
        .map((k) => [k, t(k as DictionaryKey)] as const)
        .find(([k, v]) => v !== k)?.[1] ?? fallbackError(t, errorCode));

  const ownerNames = new Map(options.owners.map((o) => [o.id, o.label]));
  // Cliente da linha fora da lista (ex.: a empresa de estoque): continua escolhido.
  const customers =
    row.customerId && !options.customers.some((c) => c.id === row.customerId)
      ? [
          ...options.customers,
          { id: row.customerId, label: row.customerName ?? row.customerId },
        ]
      : options.customers;
  const owners =
    row.ownerUserId && !options.owners.some((o) => o.id === row.ownerUserId)
      ? [
          ...options.owners,
          { id: row.ownerUserId, label: row.ownerName ?? row.ownerUserId },
        ]
      : options.owners;

  const requestHref = row.requestId
    ? row.requestGroupId
      ? `/app/requests/batch/${encodeURIComponent(row.requestGroupId)}`
      : `/app/requests/${row.requestId}`
    : null;

  const sheet: Array<[ReactNode, ReactNode]> = [
    [col("code"), row.code ?? "—"],
    [t("booking.detail.sku"), row.sku ?? "—"],
    [col("supplier"), row.supplierName ?? "—"],
    [
      col("location"),
      [row.location, row.supplierStore].filter(Boolean).join(" · ") || "—",
    ],
    [col("sheetDate"), row.sheetDate ? formatDate(row.sheetDate, t) : "—"],
    [t("booking.detail.incoterm"), row.incoterm ?? "—"],
    [
      col("price"),
      row.price === null
        ? "—"
        : `${number(row.price, 4)} ${row.currency ?? ""}`.trim(),
    ],
    [col("moq"), number(row.moq)],
    [col("masterQty"), number(row.masterQty)],
    [col("innerQty"), number(row.innerQty)],
    [col("netWeight"), number(row.netWeightKg, 4)],
    [col("grossWeight"), number(row.grossWeightKg, 4)],
    [
      col("estimatedWeight"),
      row.estimatedWeightKg === null ? (
        "—"
      ) : (
        <span data-booking-estimated="">
          {number(row.estimatedWeightKg, 4)}
          {row.weightEstimated ? (
            <span className="ml-1 text-xs text-amber-800">
              ({t("booking.detail.estimatedNote", { pct: detail.allowancePct })}
              )
            </span>
          ) : null}
        </span>
      ),
    ],
    [col("averageWeight"), number(row.averageWeightKg, 4)],
    [col("average"), number(row.averageUsd, 4)],
    [col("cbm"), number(row.cbm, 4)],
    [col("size"), row.size ?? "—"],
    [col("colors"), row.colors ?? "—"],
    [col("material"), row.material ?? "—"],
    [col("packageType"), row.packageType ?? "—"],
    [col("plannedQty"), number(row.plannedQty)],
    [col("forecastOrder"), number(row.forecastOrder)],
    [col("forecastDistribution"), number(row.forecastDistribution)],
    [col("forecastEcommerce"), number(row.forecastEcommerce)],
    [col("forecastTotal"), number(row.forecastTotal)],
    [t("booking.detail.ncm"), row.ncm ?? "—"],
    [
      t("booking.detail.source"),
      row.sourceFileName
        ? row.sourceRows
          ? t("booking.detail.sourceRows", {
              file: row.sourceFileName,
              rows: row.sourceRows,
            })
          : row.sourceFileName
        : "—",
    ],
    [col("enteredAt"), formatDate(row.enteredAt, t)],
  ];

  const signal = bookingSignal(a);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {name}
            <Badge tone={STATUS_TONE[row.status]}>
              {statusLabel(row.status)}
            </Badge>
          </span>
        }
        subtitle={
          hidden ? t("booking.detail.hidden") : t("booking.detail.visible")
        }
        actions={
          <>
            <LinkButton href="/app/booking">
              {t("booking.detail.back")}
            </LinkButton>
            {canOpen(user, "products") && !row.productMissing ? (
              <LinkButton href={`/app/products/${row.productId}`}>
                {t("booking.detail.product")}
              </LinkButton>
            ) : null}
            {detail.canApprove && !row.productMissing ? (
              <LinkButton
                href={`/app/superplan?booking=${row.id}`}
                variant="primary"
              >
                {t("booking.detail.superplan")}
              </LinkButton>
            ) : null}
          </>
        }
      />

      <div className="mb-3 space-y-2" data-booking-notices>
        {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
        {query.saved ? (
          <Alert tone="success">{t("booking.detail.saved")}</Alert>
        ) : null}
        {query.analysis ? (
          <Alert tone="success">{t("booking.detail.analysisSaved")}</Alert>
        ) : null}
        {row.productMissing ? (
          <Alert tone="warning">
            {t("booking.error.booking_product_missing")}
          </Alert>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-base font-semibold text-zinc-900">
              {t("booking.detail.edit.title")}
            </h2>
            {unlinked ? (
              <div className="mb-3">
                <Alert tone="warning">{t("booking.detail.unlinked")}</Alert>
              </div>
            ) : null}
            {locked ? (
              <div className="mb-3">
                <Alert tone={pending ? "warning" : "info"}>
                  {pending
                    ? t("booking.detail.pending")
                    : closed
                      ? t("booking.detail.closed")
                      : t("booking.detail.locked")}
                  {requestHref && canOpen(user, "requests") ? (
                    <>
                      {" "}
                      <TextLink href={requestHref}>
                        {row.requestNumber
                          ? t("booking.row.request", { n: row.requestNumber })
                          : t("booking.row.requestOpen")}
                      </TextLink>
                    </>
                  ) : null}
                </Alert>
              </div>
            ) : null}
            {/* Recusa: o que estava digitado volta (o Next remonta a página). */}
            <FormDraftGuard
              formId="booking-edit"
              storageKey={`booking-edit:${row.id}`}
              userId={user.id}
              failed={!!errorCode}
              saved={!errorCode}
              token={errorCode}
              message={t("booking.draftRestored")}
              discardLabel={t("booking.draftDiscard")}
            />
            <form
              id="booking-edit"
              action={saveBookingRowAction}
              className="space-y-3"
              data-booking-edit
            >
              <input type="hidden" name="id" value={row.id} />
              {/* Como cada campo estava ao abrir: só o que mudou é gravado. */}
              <input type="hidden" name="was.status" value={row.status} />
              <input
                type="hidden"
                name="was.customerId"
                value={row.customerId ?? BOOKING_EMPTY}
              />
              <input
                type="hidden"
                name="was.reservedQty"
                value={row.reservedQty ?? ""}
              />
              <input
                type="hidden"
                name="was.ownerUserId"
                value={row.ownerUserId ?? ""}
              />
              <input type="hidden" name="was.note" value={row.note ?? ""} />
              <Field
                label={t("booking.detail.status")}
                hint={
                  detail.canApprove
                    ? undefined
                    : t("booking.detail.status.hint")
                }
              >
                <Select name="status" defaultValue={row.status}>
                  {detail.moveOptions.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("booking.detail.customer")}>
                <Select
                  name="customerId"
                  defaultValue={row.customerId ?? BOOKING_EMPTY}
                >
                  <option value={BOOKING_EMPTY}>
                    {t("booking.detail.customer.none")}
                  </option>
                  {options.stockOption ? (
                    <option value={BOOKING_STOCK_OPTION}>
                      {t("booking.bulk.stock")}
                    </option>
                  ) : null}
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t("booking.detail.qty")}
                hint={
                  row.moq
                    ? t("booking.detail.qty.hint", { moq: number(row.moq) })
                    : undefined
                }
              >
                <Input
                  name="reservedQty"
                  defaultValue={row.reservedQty ?? ""}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </Field>
              <Field label={t("booking.detail.owner")}>
                <Select name="ownerUserId" defaultValue={row.ownerUserId ?? ""}>
                  <option value="">{t("booking.detail.owner.none")}</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("booking.detail.note")}>
                <Textarea
                  name="note"
                  defaultValue={row.note ?? ""}
                  maxLength={500}
                  rows={3}
                />
              </Field>
              <SubmitButton pendingText={t("booking.detail.saving")}>
                {t("booking.detail.save")}
              </SubmitButton>
            </form>
          </Card>

          {row.photoDocumentId ? (
            <Card>
              <a
                href={`/api/files/${row.photoDocumentId}`}
                target="_blank"
                rel="noreferrer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                <img
                  src={`/api/files/${row.photoDocumentId}`}
                  alt={name}
                  className="max-h-72 w-full rounded-lg object-contain"
                />
              </a>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-base font-semibold text-zinc-900">
              {t("booking.detail.sheet.title")}
            </h2>
            <DescriptionList items={sheet} />
          </Card>

          {detail.canApprove ? (
            <Card>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-900">
                  {t("booking.detail.analysis.title")}
                </h2>
                {signal !== "none" ? (
                  <Badge tone={SIGNAL_TONE[signal]}>
                    {t(`booking.signal.${signal}` as DictionaryKey)}
                  </Badge>
                ) : null}
              </div>
              {!a ? (
                <Empty>{t("booking.detail.analysis.none")}</Empty>
              ) : (
                <div className="space-y-3" data-booking-analysis>
                  <DescriptionList
                    items={[
                      [
                        t("booking.detail.analysis.businessType"),
                        a.businessType,
                      ],
                      [
                        t("booking.detail.analysis.sale"),
                        a.salePriceBrl === null
                          ? "—"
                          : a.usesMinimum
                            ? t("booking.detail.analysis.saleMinimum", {
                                price: formatMoney(a.salePriceBrl, "BRL", t),
                              })
                            : formatMoney(a.salePriceBrl, "BRL", t),
                      ],
                      [
                        t("booking.detail.analysis.cost"),
                        formatMoney(a.costBrl, "BRL", t),
                      ],
                      [
                        t("booking.detail.analysis.minimum"),
                        formatMoney(a.minimumBrl, "BRL", t),
                      ],
                      [
                        t("booking.detail.analysis.profit"),
                        a.profitPct === null
                          ? "—"
                          : t("booking.detail.analysis.profitValue", {
                              pct: number(a.profitPct, 1),
                              target: number(a.targetPct, 1),
                            }),
                      ],
                      [
                        t("booking.detail.analysis.target"),
                        formatMoney(a.targetPriceBrl, "BRL", t),
                      ],
                    ]}
                  />
                  {a.missing.length ? (
                    <Alert tone="warning">
                      {t("superplan.missing", {
                        list: a.missing
                          .map((m) => {
                            const key = `superplan.missing.${m}`;
                            const text = t(key as DictionaryKey);
                            return text === key ? m : text;
                          })
                          .join(", "),
                      })}
                    </Alert>
                  ) : null}
                  {a.inputs ? (
                    <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
                      <p className="mb-1 font-semibold uppercase tracking-wide text-zinc-500">
                        {t("booking.detail.analysis.assumptions")}
                      </p>
                      {a.inputs.unitPrice != null ? (
                        <p>
                          {t("booking.detail.analysis.used", {
                            price: number(a.inputs.unitPrice, 4),
                            currency: a.inputs.currency ?? "",
                            pcs: number(a.inputs.pcsPerCarton),
                            cbm: number(a.inputs.cbmPerCarton, 4),
                          })}
                        </p>
                      ) : null}
                      <p>
                        {t("booking.detail.analysis.rates", {
                          official: number(a.inputs.officialRate, 4),
                          future: number(a.inputs.futureRate, 4),
                          rmb: number(a.inputs.rmbPerUsd, 4),
                        })}
                      </p>
                      <p>
                        {t("booking.detail.analysis.taxes", {
                          ii: number(a.inputs.iiPct, 2),
                          ipi: number(a.inputs.ipiPct, 2),
                        })}
                      </p>
                      <p>
                        {t("booking.detail.analysis.container", {
                          container: a.inputs.container ?? "—",
                          freight: number(a.inputs.freightUsd, 2),
                        })}
                      </p>
                      {a.inputs.grossEstimated ? (
                        <p>{t("booking.detail.analysis.grossEstimated")}</p>
                      ) : null}
                      {!a.inputs.ncmFound ? (
                        <p className="mt-1 font-semibold text-amber-800">
                          {t("booking.detail.analysis.noNcm")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {signal === "minimum" ? (
                    <Alert tone="info">
                      {t("booking.detail.analysis.atMinimum")}
                    </Alert>
                  ) : null}
                  {a.manual ? (
                    <p className="text-xs font-medium text-zinc-600">
                      {t("booking.detail.analysis.manual")}
                    </p>
                  ) : null}
                  <p className="text-xs text-zinc-500">
                    {t("booking.detail.analysis.when", {
                      date: formatDate(a.at, t),
                      name: ownerNames.get(a.byUserId) ?? "—",
                    })}{" "}
                    {t("booking.detail.analysis.stale")}
                  </p>
                </div>
              )}
            </Card>
          ) : null}

          <Card>
            <h2 className="mb-3 text-base font-semibold text-zinc-900">
              {t("booking.detail.history.title")}
            </h2>
            {detail.history.length === 0 ? (
              <Empty>{t("booking.detail.history.empty")}</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t("audit.when")}</Th>
                    <Th>{t("audit.who")}</Th>
                    <Th>{t("audit.what")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {detail.history.map((h) => (
                    <tr key={h.id}>
                      <Td className="whitespace-nowrap">
                        {formatDate(h.at, t)}
                      </Td>
                      <Td className="whitespace-nowrap">{h.userName ?? "—"}</Td>
                      <Td>{h.summary}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
