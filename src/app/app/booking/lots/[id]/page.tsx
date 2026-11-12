import { isWellmix } from "@/lib/auth/permissions";
import { PartnerBookingLotView } from "../../_components/partner-booking";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import {
  bookingCapacityShown,
  bookingLotEditable,
  bookingLotMoves,
  bookingLotPending,
  bookingLotReady,
  isRequiredItemField,
  missingItemFields,
  type BookingItemField,
} from "@/lib/booking-lots";
import {
  SHEET_CURRENCIES,
  SHEET_INCOTERMS,
  type BookingItem,
  type BookingLotStatus,
} from "@/lib/db/schema";
import { getBookingLot } from "@/lib/services/booking-lots";
import { superplanBusinessTypes } from "@/lib/services/superplan-analysis";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
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
  cx,
  formatDate,
  formatMoney,
  linkClass,
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { SupplierNoLoginAlert } from "@/components/supplier-no-login";
import { canOpen } from "@/lib/auth/screens";
import { partiesWithoutLogin } from "@/lib/services/portal-access";
import {
  BookingItemInput,
  BookingItemNcmInput,
  BookingItemSelect,
  BookingLotDateInput,
  BookingLotPartnerSelect,
  BookingLotSupplierSelect,
} from "@/components/booking-lot-fields";
import {
  closeBookingLotAction,
  moveBookingLotAction,
  reanalyzeBookingLotAction,
  registerBookingLotSupplierAction,
  setBookingLotNoteAction,
} from "../../../actions/booking-lots";
import { reclassifyBookingNcmAction } from "../../../actions/booking-ncm";
import type { NcmSuggestion } from "@/lib/ncm-match";
import { TableTools } from "@/components/table-tools";

/*
 * Detalhamento de um booking (docs/BOOKING.md, "Booking por planilha"):
 * dados do booking (status, origem, fornecedor, data), a sugestão de
 * cadastro do fornecedor da planilha, os itens com todos os campos
 * (editáveis no rascunho, cada um grava sozinho), o fechamento com a análise
 * do Superplan e o status.
 */

const STATUS_TONE: Record<BookingLotStatus, Tone> = {
  // Em preenchimento pelo parceiro: a Wellmix não lista (só por completude).
  preparing: "neutral",
  draft: "warning",
  closed: "info",
  in_progress: "brand",
  done: "success",
  cancelled: "neutral",
};

/** Colunas dos itens, na ordem da planilha do booking. */
const COLUMNS: Array<{
  field: BookingItemField;
  kind: "text" | "number" | "incoterm" | "currency";
  width: string;
}> = [
  { field: "itemNumber", kind: "text", width: "w-16" },
  { field: "factoryItemCode", kind: "text", width: "w-28" },
  { field: "description", kind: "text", width: "w-48" },
  { field: "incoterm", kind: "incoterm", width: "w-20" },
  { field: "currency", kind: "currency", width: "w-20" },
  { field: "price", kind: "number", width: "w-20" },
  { field: "masterCartonQty", kind: "number", width: "w-20" },
  { field: "innerQty", kind: "number", width: "w-20" },
  { field: "netWeightPcKg", kind: "number", width: "w-20" },
  { field: "grossWeightPcKg", kind: "number", width: "w-20" },
  { field: "cbmPerCarton", kind: "number", width: "w-20" },
  { field: "lengthCm", kind: "number", width: "w-20" },
  { field: "widthCm", kind: "number", width: "w-20" },
  { field: "heightCm", kind: "number", width: "w-20" },
  { field: "capacityMl", kind: "number", width: "w-20" },
  { field: "packageType", kind: "text", width: "w-32" },
  { field: "material", kind: "text", width: "w-32" },
  { field: "moq", kind: "number", width: "w-20" },
  { field: "productName", kind: "text", width: "w-40" },
  { field: "colorAssortment", kind: "text", width: "w-36" },
  { field: "powerDetail", kind: "text", width: "w-32" },
  { field: "purchaseSchedule", kind: "text", width: "w-32" },
  { field: "departureIntervalDays", kind: "text", width: "w-24" },
  { field: "purchaseQty", kind: "number", width: "w-24" },
  { field: "plannedQty", kind: "number", width: "w-24" },
];

const SIGNAL_TONE: Record<string, Tone> = {
  viable: "success",
  below: "warning",
  loss: "danger",
};

export default async function BookingLotPage({
  params,
  searchParams,
}: PageProps<"/app/booking/lots/[id]">) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/app/booking/lots/${id}`);
  requireScreen(user, "booking");
  // Login externo (Trading): o booking dele, só para ler, sem a análise.
  if (!isWellmix(user)) {
    return (
      <PartnerBookingLotView
        user={user}
        lotId={id}
        t={await getT()}
        created={(await searchParams).created === "1"}
        sent={(await searchParams).sent === "1"}
        error={
          typeof (await searchParams).error === "string"
            ? String((await searchParams).error)
            : ""
        }
      />
    );
  }
  const query = await searchParams;
  const one = (key: string) => {
    const v = query[key];
    return typeof v === "string" ? v : "";
  };
  const t = await getT();
  const detail = await getBookingLot(user, id).catch((error: unknown) => {
    if (error instanceof Error && error.message === "schema_outdated")
      return "schema" as const;
    throw error;
  });
  if (detail === "schema")
    return <Alert tone="warning">{t("bookingLots.schemaMissing")}</Alert>;
  if (!detail) notFound();
  const { lot, items, supplier, suppliers, owner, partner, partners } = detail;
  // Fornecedor sem login: a solicitação aberta a partir deste booking fica parada.
  const noLogin =
    supplier && (await partiesWithoutLogin([supplier.id])).has(supplier.id)
      ? [{ id: supplier.id, name: supplier.name }]
      : [];
  const editable = bookingLotEditable(lot.status);
  // NCM: editável em qualquer situação menos Cancelado (docs/BOOKING.md, "NCM do item").
  const ncmEditable = lot.status !== "cancelled";
  const ncmWithBroker = items.filter(
    (i) => !i.ncm && !!i.ncmRequestedAt,
  ).length;
  const { hasBroker, bookingNcmSuggestions } =
    await import("@/lib/services/booking-ncm");
  const brokerExists = ncmWithBroker ? await hasBroker() : true;
  const ncmMissing = items.filter((i) => !i.ncm).length;
  // Sugestões de NCM (até 3 por item, um clique grava) para os itens sem NCM.
  const ncmSuggestions = ncmEditable
    ? await bookingNcmSuggestions(items).catch((error: unknown) => {
        console.error("[booking-ncm] sugestões", error);
        return new Map();
      })
    : new Map();
  const pending = bookingLotPending(lot, items);
  const ready = bookingLotReady(pending);
  const businessTypes = await superplanBusinessTypes();

  const intl = t.intl;
  const decimal = intl.startsWith("pt") ? "," : ".";
  const raw = (n: number | null) =>
    n === null ? "" : String(n).replace(".", decimal);
  const shownNumber = (n: number | null) =>
    n === null ? null : n.toLocaleString(intl, { maximumFractionDigits: 4 });
  const colLabel = (f: string) =>
    t(`bookingLots.item.col.${f}` as DictionaryKey);
  const statusLabel = (s: string) =>
    t(`bookingLots.status.${s}` as DictionaryKey);
  const cellLabels = (field: string) => ({
    field,
    saving: t("booking.row.saving"),
    saved: t("booking.row.saved"),
    failed: t("booking.row.failed"),
  });

  /* Avisos da última ação. */
  const errorCode = one("error");
  const errorKey = [
    `bookingLots.error.${errorCode}`,
    `sheetImport.error.${errorCode}`,
    `common.${errorCode}`,
  ].find((k) => k in dictionaries.pt) as DictionaryKey | undefined;
  const errorText = !errorCode
    ? null
    : errorKey
      ? t(errorKey)
      : fallbackError(t, errorCode);
  const notices: Array<[Tone, string]> = [];
  if (one("created"))
    notices.push([
      "success",
      t("bookingLots.detail.created", { n: items.length }),
    ]);
  if (one("ncmMatched"))
    notices.push([
      "info",
      t("bookingNcm.reclassified", {
        n: Number(one("ncmMatched")) || 0,
        left: Number(one("ncmLeft")) || 0,
      }),
    ]);
  if (one("closed")) notices.push(["success", t("bookingLots.detail.closed")]);
  if (one("analyzed"))
    notices.push(["success", t("bookingLots.detail.analyzed")]);
  if (one("moved")) notices.push(["success", t("bookingLots.detail.moved")]);
  if (one("saved")) notices.push(["success", t("bookingLots.detail.saved")]);
  if (one("supplier") === "created")
    notices.push(["success", t("bookingLots.detail.supplierCreated")]);

  const hint = lot.supplierHint;
  const sheetSupplier = hint?.name ?? null;
  const supplierOptions = [
    { value: "", label: t("bookingLots.supplierNone") },
    ...suppliers.map((s) => ({
      value: s.id,
      label: [s.name, s.storeNumber, s.city].filter(Boolean).join(" · "),
    })),
  ];
  // Responsável pelo booking: para quem vão as solicitações (vazio = o fornecedor).
  const partnerOptions = [
    { value: "", label: t("bookingLots.partner.supplier") },
    ...partners.map((p) => ({
      value: p.id,
      label: [p.name, t(`party.${p.type}` as DictionaryKey), p.city]
        .filter(Boolean)
        .join(" · "),
    })),
  ];
  const day = lot.bookingDate ? lot.bookingDate.slice(0, 10) : "";

  const pendingList = [
    pending.supplier ? t("bookingLots.pending.supplier") : null,
    pending.date ? t("bookingLots.pending.date") : null,
    pending.noItems ? t("bookingLots.pending.noItems") : null,
    pending.items.size
      ? t("bookingLots.pending.items", { n: pending.items.size })
      : null,
  ].filter(Boolean) as string[];

  const businessTypeSelect = (current: string | null) => (
    <Select
      name="businessType"
      defaultValue={current ?? ""}
      data-booking-lot-business-type
    >
      <option value="">
        {t("bookingLots.detail.close.default", {
          name: businessTypes.defaultName,
        })}
      </option>
      {businessTypes.names
        .filter((n) => n !== businessTypes.defaultName)
        .map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
    </Select>
  );

  const muted = <span className="text-zinc-400">—</span>;
  const itemCell = (item: BookingItem, col: (typeof COLUMNS)[number]) => {
    // Capacidade: os mililitros ou, sem volume, o tamanho que veio na planilha
    // ("8X10", "A4"); por isso a coluna aceita letras.
    const capacity = col.field === "capacityMl";
    const value = capacity ? bookingCapacityShown(item) : item[col.field];
    const required = isRequiredItemField(col.field);
    const labels = cellLabels(
      t("bookingLots.item.edit", {
        field: colLabel(col.field),
        n: item.itemNumber ?? String(item.position + 1),
      }),
    );
    if (editable) {
      if (col.kind === "incoterm" || col.kind === "currency") {
        const list =
          col.kind === "incoterm" ? SHEET_INCOTERMS : SHEET_CURRENCIES;
        return (
          <BookingItemSelect
            lotId={lot.id}
            itemId={item.id}
            field={col.field}
            current={typeof value === "string" ? value : ""}
            required={required}
            options={[
              { value: "", label: "—" },
              ...list.map((v) => ({ value: v, label: v })),
            ]}
            labels={labels}
          />
        );
      }
      return (
        <BookingItemInput
          lotId={lot.id}
          itemId={item.id}
          field={col.field}
          saved={
            typeof value === "number"
              ? raw(value)
              : typeof value === "string"
                ? value
                : ""
          }
          numeric={col.kind === "number" && !capacity}
          width={col.width}
          required={required}
          labels={labels}
        />
      );
    }
    if (value === null || value === undefined || value === "") return muted;
    if (typeof value === "number")
      return col.field === "price" ? (
        <span className="whitespace-nowrap tabular-nums">
          {shownNumber(value)} {item.currency ?? ""}
        </span>
      ) : (
        <span className="tabular-nums">{shownNumber(value)}</span>
      );
    return (
      <span className={cx("block truncate", col.width)} title={String(value)}>
        {String(value)}
      </span>
    );
  };

  const analysisCell = (item: BookingItem): ReactNode => {
    const a = item.analysis;
    if (!a)
      return <span className="text-zinc-500">{t("booking.signal.none")}</span>;
    const missing = a.missing.length
      ? a.missing
          .map((m) => {
            const key = `superplan.missing.${m}`;
            return key in dictionaries.pt ? t(key as DictionaryKey) : m;
          })
          .join(", ")
      : null;
    return (
      <span
        className="flex flex-col items-start gap-0.5"
        data-booking-item-analysis={a.verdict ?? "missing"}
      >
        <Badge tone={a.verdict ? SIGNAL_TONE[a.verdict] : "neutral"}>
          {t(`booking.signal.${a.verdict ?? "missing"}` as DictionaryKey)}
        </Badge>
        {a.minimumBrl !== null ? (
          <span className="text-xs text-zinc-600">
            {t("bookingLots.item.minimum", {
              price: formatMoney(a.minimumBrl, "BRL", t),
            })}
          </span>
        ) : null}
        {a.profitPct !== null ? (
          <span className="text-xs text-zinc-600">
            {t("bookingLots.item.profit", {
              pct: a.profitPct.toLocaleString(intl, {
                maximumFractionDigits: 1,
              }),
            })}
          </span>
        ) : null}
        {missing ? (
          <span className="max-w-40 text-xs whitespace-normal text-zinc-500">
            {t("bookingLots.item.missingData", { list: missing })}
          </span>
        ) : null}
      </span>
    );
  };

  return (
    <>
      <PageHeader
        t={t}
        title={t("bookingLots.detail.title", { n: lot.number })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[lot.status]}>
              {statusLabel(lot.status)}
            </Badge>
            <span>{lot.fileName}</span>
          </span>
        }
        actions={
          <LinkButton href="/app/booking">
            {t("bookingLots.backToList")}
          </LinkButton>
        }
      />

      <div className="mb-3 space-y-2" data-booking-lot-notices>
        <SupplierNoLoginAlert
          suppliers={noLogin}
          canParties={canOpen(user, "parties")}
          t={t}
        />
        {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
        {notices.map(([tone, text]) => (
          <Alert key={text} tone={tone}>
            {text}
          </Alert>
        ))}
        {ncmEditable && ncmMissing ? (
          <form
            action={reclassifyBookingNcmAction}
            className="flex flex-wrap items-center gap-2 text-sm text-zinc-600"
            data-booking-lot-ncm-reclassify
          >
            <input type="hidden" name="lotId" value={lot.id} />
            <span>{t("bookingNcm.reclassifyHint", { n: ncmMissing })}</span>
            <SubmitButton
              variant="secondary"
              pendingText={t("bookingNcm.reclassifyPending")}
            >
              {t("bookingNcm.reclassify")}
            </SubmitButton>
          </form>
        ) : null}
        {ncmWithBroker ? (
          <Alert tone="warning">
            <span data-booking-lot-ncm-pending={ncmWithBroker}>
              {t("bookingNcm.lotPending", { n: ncmWithBroker })}{" "}
              <a href="/app/ncm-items" className={linkClass}>
                {t("bookingNcm.lotPendingLink")}
              </a>
              {!brokerExists ? (
                <span className="mt-1 block text-xs">
                  {t("bookingNcm.noBroker")}
                </span>
              ) : null}
            </span>
          </Alert>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <Card title={t("bookingLots.detail.header")} className="lg:col-span-2">
          <DescriptionList
            items={[
              [
                t("bookingLots.detail.supplier"),
                <span key="s" className="flex flex-col gap-1">
                  {editable ? (
                    <BookingLotSupplierSelect
                      lotId={lot.id}
                      current={lot.supplierId ?? ""}
                      options={supplierOptions}
                      labels={cellLabels(t("bookingLots.detail.supplierField"))}
                      placeholder={t("bookingLots.detail.supplierSearch")}
                      noMatch={t("bookingLots.detail.supplierNoMatch")}
                    />
                  ) : (
                    (supplier?.name ?? t("bookingLots.supplierNone"))
                  )}
                  {sheetSupplier ? (
                    <span className="text-xs text-zinc-500">
                      {t("bookingLots.supplierSheet", {
                        name: [sheetSupplier, hint?.store, hint?.phone]
                          .filter(Boolean)
                          .join(" · "),
                      })}
                    </span>
                  ) : null}
                </span>,
              ],
              [
                t("bookingLots.partner.title"),
                <span key="p" className="flex flex-col gap-1">
                  {lot.status !== "cancelled" ? (
                    <BookingLotPartnerSelect
                      lotId={lot.id}
                      current={lot.partnerId ?? ""}
                      options={partnerOptions}
                      labels={cellLabels(t("bookingLots.partner.title"))}
                      placeholder={t("bookingLots.detail.supplierSearch")}
                      noMatch={t("bookingLots.detail.supplierNoMatch")}
                    />
                  ) : (
                    (partner?.name ?? t("bookingLots.partner.supplier"))
                  )}
                  <span className="text-xs text-zinc-500">
                    {t("bookingLots.partner.hint")}
                  </span>
                </span>,
              ],
              [
                t("bookingLots.detail.origin"),
                <span key="o" className="flex flex-col gap-1">
                  {lot.origin ?? "—"}
                  <span className="text-xs text-zinc-500">
                    {t("bookingLots.detail.originHint")}
                  </span>
                </span>,
              ],
              [
                t("bookingLots.detail.date"),
                <span key="d" className="flex flex-col gap-1">
                  {editable ? (
                    <BookingLotDateInput
                      lotId={lot.id}
                      saved={day}
                      labels={cellLabels(t("bookingLots.detail.dateField"))}
                    />
                  ) : (
                    formatDate(lot.bookingDate, t)
                  )}
                  {lot.sheetDate ? (
                    <span className="text-xs text-zinc-500">
                      {t("bookingLots.detail.dateSheet", {
                        date: /^\d{4}-\d{2}-\d{2}T/.test(lot.sheetDate)
                          ? formatDate(lot.sheetDate, t)
                          : lot.sheetDate,
                      })}
                    </span>
                  ) : null}
                </span>,
              ],
              [
                t("bookingLots.detail.status"),
                <Badge key="st" tone={STATUS_TONE[lot.status]}>
                  {statusLabel(lot.status)}
                </Badge>,
              ],
              [
                t("bookingLots.detail.file"),
                lot.fileDocumentId ? (
                  <a
                    key="f"
                    href={`/api/files/${lot.fileDocumentId}`}
                    className={linkClass}
                  >
                    {lot.fileName}
                  </a>
                ) : (
                  lot.fileName
                ),
              ],
              [t("bookingLots.detail.owner"), owner?.name ?? "—"],
              [t("bookingLots.detail.items"), String(items.length)],
              [t("bookingLots.col.createdAt"), formatDate(lot.createdAt, t)],
            ]}
          />
          <form
            action={setBookingLotNoteAction}
            className="mt-4 flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="lotId" value={lot.id} />
            <div className="min-w-60 flex-1">
              <Field label={t("bookingLots.detail.note")}>
                <Input
                  name="note"
                  defaultValue={lot.note ?? ""}
                  maxLength={500}
                />
              </Field>
            </div>
            <SubmitButton variant="secondary">
              {t("bookingLots.detail.noteSave")}
            </SubmitButton>
          </form>
        </Card>

        <div className="space-y-4">
          {editable && !lot.supplierId && hint?.name ? (
            <Card title={t("bookingLots.detail.suggest.title")} dense>
              <p className="mb-2 text-sm text-zinc-600">
                {t("bookingLots.detail.suggest.body")}
              </p>
              <form
                action={registerBookingLotSupplierAction}
                className="space-y-2"
                data-booking-lot-suggest
              >
                <input type="hidden" name="lotId" value={lot.id} />
                <Field label={t("bookingLots.detail.suggest.name")}>
                  <Input
                    name="name"
                    defaultValue={hint.name}
                    required
                    maxLength={160}
                  />
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label={t("bookingLots.detail.suggest.store")}>
                    <Input
                      name="storeNumber"
                      defaultValue={hint.store ?? ""}
                      maxLength={60}
                    />
                  </Field>
                  <Field label={t("bookingLots.detail.suggest.phone")}>
                    <Input
                      name="phone"
                      defaultValue={hint.phone ?? ""}
                      maxLength={40}
                    />
                  </Field>
                  <Field label={t("bookingLots.detail.suggest.city")}>
                    <Input
                      name="city"
                      defaultValue={hint.city ?? ""}
                      maxLength={80}
                    />
                  </Field>
                  <Field label={t("bookingLots.detail.suggest.country")}>
                    <Input name="country" defaultValue="China" maxLength={60} />
                  </Field>
                </div>
                <SubmitButton
                  pendingText={t("bookingLots.detail.suggest.pending")}
                >
                  {t("bookingLots.detail.suggest.submit")}
                </SubmitButton>
              </form>
            </Card>
          ) : null}

          {editable ? (
            <Card title={t("bookingLots.detail.close.title")} dense>
              <div className="mb-2">
                {ready ? (
                  <Alert tone="success">{t("bookingLots.detail.ready")}</Alert>
                ) : (
                  <Alert tone="warning">
                    {t("bookingLots.detail.pending", {
                      list: pendingList.join(", "),
                    })}
                  </Alert>
                )}
              </div>
              <p className="mb-2 text-sm text-zinc-600">
                {t("bookingLots.detail.close.body")}
              </p>
              <form
                action={closeBookingLotAction}
                className="space-y-2"
                data-booking-lot-close
              >
                <input type="hidden" name="lotId" value={lot.id} />
                <Field label={t("bookingLots.detail.close.businessType")}>
                  {businessTypeSelect(lot.businessType)}
                </Field>
                <SubmitButton
                  pendingText={t("bookingLots.detail.close.pending")}
                  data-booking-lot-close-submit
                >
                  {t("bookingLots.detail.close.submit")}
                </SubmitButton>
              </form>
            </Card>
          ) : null}

          {lot.status !== "draft" && lot.status !== "cancelled" ? (
            <Card title={t("bookingLots.item.col.analysis")} dense>
              {lot.analyzedAt ? (
                <p className="mb-2 text-sm text-zinc-600">
                  {t("bookingLots.detail.analysisAt", {
                    date: formatDate(lot.analyzedAt, t),
                    type: lot.businessType ?? businessTypes.defaultName,
                  })}
                </p>
              ) : null}
              <form action={reanalyzeBookingLotAction} className="space-y-2">
                <input type="hidden" name="lotId" value={lot.id} />
                <Field label={t("bookingLots.detail.close.businessType")}>
                  {businessTypeSelect(lot.businessType)}
                </Field>
                <SubmitButton
                  variant="secondary"
                  pendingText={t("bookingLots.detail.reanalyzePending")}
                >
                  {t("bookingLots.detail.reanalyze")}
                </SubmitButton>
              </form>
            </Card>
          ) : null}

          {bookingLotMoves(lot.status).length ? (
            <Card title={t("bookingLots.detail.move")} dense>
              <form
                action={moveBookingLotAction}
                className="flex flex-wrap items-end gap-2"
                data-booking-lot-move
              >
                <input type="hidden" name="lotId" value={lot.id} />
                <div className="min-w-40 flex-1">
                  <Field label={t("bookingLots.detail.moveTo")}>
                    <Select name="status" required defaultValue="">
                      <option value="" disabled>
                        {t("common.select")}
                      </option>
                      {bookingLotMoves(lot.status).map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <SubmitButton variant="secondary">
                  {t("bookingLots.detail.moveSubmit")}
                </SubmitButton>
              </form>
            </Card>
          ) : null}
        </div>
      </div>

      <section className="mt-4">
        <Card title={t("bookingLots.detail.itemsTitle", { n: items.length })}>
          <p className="mb-2 text-xs text-zinc-500">
            {editable
              ? t("bookingLots.detail.itemsHint")
              : t("bookingLots.detail.itemsLocked", {
                  status: statusLabel(lot.status).toLowerCase(),
                }) + (ncmEditable ? ` ${t("bookingNcm.closedHint")}` : "")}
          </p>
          {items.length ? (
            <TableTools
              className=""
              tableClassName="min-w-0"
              data-booking-items=""
            >
              <thead>
                <tr>
                  {["position", "photo"].map((k) => (
                    <th
                      key={k}
                      className="border-b border-zinc-200 bg-zinc-50/80 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                    >
                      {colLabel(k)}
                    </th>
                  ))}
                  <th className="border-b border-zinc-200 bg-zinc-50/80 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap text-zinc-500">
                    {t("bookingNcm.col")}
                    <span className="text-brand-700"> *</span>
                  </th>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.field}
                      className="border-b border-zinc-200 bg-zinc-50/80 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap text-zinc-500"
                    >
                      {colLabel(c.field)}
                      {isRequiredItemField(c.field) ? (
                        <span className="text-brand-700"> *</span>
                      ) : null}
                    </th>
                  ))}
                  {["check", "analysis"].map((k) => (
                    <th
                      key={k}
                      className="border-b border-zinc-200 bg-zinc-50/80 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                    >
                      {colLabel(k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const missing = missingItemFields(item);
                  return (
                    <tr
                      key={item.id}
                      className="transition hover:bg-brand-50/40"
                      data-booking-item={item.id}
                    >
                      <td className="border-b border-zinc-100 px-2 py-2 align-top text-xs text-zinc-500">
                        {item.position + 1}
                        {item.sourceRows ? (
                          <span className="block text-[10px]">
                            L{item.sourceRows}
                          </span>
                        ) : null}
                      </td>
                      <td className="border-b border-zinc-100 px-2 py-2 align-top">
                        <span className="flex gap-1">
                          {[item.photoDocumentId, item.cardDocumentId]
                            .filter((d): d is string => !!d)
                            .map((doc) => (
                              <a
                                key={doc}
                                href={`/api/files/${doc}`}
                                target="_blank"
                                rel="noreferrer"
                                title={
                                  doc === item.cardDocumentId
                                    ? t("bookingLots.item.card")
                                    : t("bookingLots.item.col.photo")
                                }
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                                <img
                                  src={`/api/files/${doc}`}
                                  alt=""
                                  className="h-10 w-10 rounded border border-zinc-200 object-cover"
                                  loading="lazy"
                                />
                              </a>
                            ))}
                          {!item.photoDocumentId && !item.cardDocumentId
                            ? muted
                            : null}
                        </span>
                      </td>
                      <td
                        className="border-b border-zinc-100 px-2 py-2 align-top text-[13px] text-zinc-800"
                        data-booking-item-ncm-cell={
                          item.ncmSource ??
                          (item.ncmRequestedAt ? "broker_pending" : "none")
                        }
                      >
                        {ncmEditable ? (
                          <BookingItemNcmInput
                            lotId={lot.id}
                            itemId={item.id}
                            saved={item.ncm ?? ""}
                            labels={cellLabels(
                              t("bookingNcm.edit", {
                                n: item.itemNumber ?? String(item.position + 1),
                              }),
                            )}
                            suggestions={
                              item.ncm
                                ? []
                                : (ncmSuggestions.get(item.id) ?? []).map(
                                    (sg: NcmSuggestion) => ({
                                      ncm: sg.ncm,
                                      pct: Math.round(sg.score * 100),
                                      title: t("bookingNcm.suggestion", {
                                        pct: Math.round(sg.score * 100),
                                        n: sg.products,
                                        example: sg.example,
                                      }),
                                    }),
                                  )
                            }
                            suggestLabel={t("bookingNcm.suggestions")}
                            recommendedLabel={t("bookingNcm.recommended")}
                            fillLabel={t("bookingNcm.fillRecommended")}
                            othersLabel={t("bookingNcm.otherSuggestions")}
                          />
                        ) : (
                          <span className="tabular-nums">
                            {item.ncm ?? "—"}
                          </span>
                        )}
                        <span className="mt-0.5 block">
                          {item.ncm && item.ncmSource ? (
                            <Badge
                              tone={
                                item.ncmSource === "match" ? "info" : "neutral"
                              }
                            >
                              {t(
                                `bookingNcm.source.${item.ncmSource}` as DictionaryKey,
                                {
                                  pct: Math.round((item.ncmScore ?? 0) * 100),
                                },
                              )}
                            </Badge>
                          ) : !item.ncm && item.ncmRequestedAt ? (
                            <Badge tone="warning">
                              {t("bookingNcm.pending")}
                            </Badge>
                          ) : null}
                        </span>
                      </td>
                      {COLUMNS.map((c) => (
                        <td
                          key={c.field}
                          className="border-b border-zinc-100 px-2 py-2 align-top text-[13px] text-zinc-800"
                        >
                          {itemCell(item, c)}
                        </td>
                      ))}
                      <td className="border-b border-zinc-100 px-2 py-2 align-top text-xs">
                        {missing.length ? (
                          <span
                            className="block max-w-44 whitespace-normal text-amber-800"
                            data-booking-item-missing={missing.join(",")}
                          >
                            {t("bookingLots.item.missing", {
                              list: missing.map(colLabel).join(", "),
                            })}
                          </span>
                        ) : (
                          <Badge tone="success">
                            {t("bookingLots.item.complete")}
                          </Badge>
                        )}
                      </td>
                      <td className="border-b border-zinc-100 px-2 py-2 align-top">
                        {analysisCell(item)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableTools>
          ) : (
            <Empty>{t("bookingLots.empty")}</Empty>
          )}
          {lot.extraHeaders?.length ? (
            <p className="mt-2 text-xs text-zinc-500">
              {t("bookingLots.detail.extra", {
                list: lot.extraHeaders.join(", "),
              })}
            </p>
          ) : null}
        </Card>
      </section>
    </>
  );
}
