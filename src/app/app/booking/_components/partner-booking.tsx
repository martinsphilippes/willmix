import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SHEET_CURRENCIES,
  SHEET_INCOTERMS,
  type BookingLotStatus,
  type User,
} from "@/lib/db";
import type { Translate } from "@/i18n";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import {
  bookingCapacityShown,
  bookingItemFieldKind,
  bookingLotPreparing,
  isRequiredItemField,
  type BookingItemField,
} from "@/lib/booking-lots";
import {
  canLaunchBooking,
  getPartnerBookingLot,
  listPartnerBookingLots,
  type PartnerBookingItem,
  type PartnerBookingLot,
} from "@/lib/services/booking-partner";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { SheetFileInput } from "@/components/sheet-file-input";
import {
  PartnerItemInput,
  PartnerItemSelect,
} from "@/components/partner-booking-fields";
import {
  discardPartnerBookingAction,
  launchBookingAction,
  sendPartnerBookingAction,
} from "../../actions/booking-lots";

/*
 * Tela Booking para o login externo (Trading, Factory, Supplier, GP; dono,
 * 11 e 12/11/2026): ele lança os bookings da empresa dele e vê só os dela.
 * Lançar tem dois passos: sobe a planilha, confere os campos na tela (todos
 * abertos e já preenchidos) e aperta "Enviar para Wellmix Conferir". Sem
 * bookings de outras empresas e sem a análise da Wellmix (regras em
 * src/lib/services/booking-partner.ts).
 */

/** Situação do booking nas palavras de quem lançou (a Wellmix vê as dela). */
const PARTNER_STATUS: Partial<
  Record<
    BookingLotStatus,
    { key: DictionaryKey; tone: "warning" | "info" | "success" }
  >
> = {
  preparing: { key: "bookingLots.partner.status.preparing", tone: "warning" },
  draft: { key: "bookingLots.partner.status.draft", tone: "info" },
  closed: { key: "bookingLots.partner.status.closed", tone: "success" },
};

const statusOf = (t: Translate, status: BookingLotStatus) => {
  const own = PARTNER_STATUS[status];
  return {
    label: t(own?.key ?? (`bookingLots.status.${status}` as DictionaryKey)),
    tone: own?.tone ?? ("neutral" as const),
  };
};

/** Nome do booking: o número vem no envio; antes disso, "novo, não enviado". */
const lotTitle = (
  t: Translate,
  lot: Pick<PartnerBookingLot, "number" | "status">,
) =>
  bookingLotPreparing(lot.status)
    ? t("bookingLots.partner.unsent")
    : t("bookingLots.partner.lot", { n: lot.number });

/**
 * Colunas do booking em preenchimento: todos os campos da planilha, um por
 * coluna, com os que identificam o item na frente.
 */
const EDIT_COLUMNS: Array<{ field: BookingItemField; width: string }> = [
  { field: "productName", width: "w-44" },
  { field: "itemNumber", width: "w-16" },
  { field: "factoryItemCode", width: "w-28" },
  { field: "description", width: "w-52" },
  { field: "incoterm", width: "w-20" },
  { field: "currency", width: "w-20" },
  { field: "price", width: "w-20" },
  { field: "moq", width: "w-20" },
  { field: "masterCartonQty", width: "w-20" },
  { field: "innerQty", width: "w-20" },
  { field: "cbmPerCarton", width: "w-20" },
  { field: "lengthCm", width: "w-20" },
  { field: "widthCm", width: "w-20" },
  { field: "heightCm", width: "w-20" },
  { field: "capacityMl", width: "w-20" },
  { field: "netWeightPcKg", width: "w-20" },
  { field: "grossWeightPcKg", width: "w-20" },
  { field: "material", width: "w-32" },
  { field: "packageType", width: "w-32" },
  { field: "colorAssortment", width: "w-36" },
  { field: "powerDetail", width: "w-32" },
  { field: "purchaseSchedule", width: "w-32" },
  { field: "departureIntervalDays", width: "w-24" },
  { field: "purchaseQty", width: "w-24" },
  { field: "plannedQty", width: "w-24" },
];

/**
 * O que o campo mostra. A capacidade são os mililitros ou, quando a planilha
 * traz um tamanho no lugar ("8X10", "A4"), o texto dele.
 */
const shown = (
  item: PartnerBookingItem,
  field: BookingItemField,
): string | number | null => {
  const value =
    field === "capacityMl" ? bookingCapacityShown(item) : item[field];
  return value === null || value === undefined || value === "" ? null : value;
};

const num = (t: Translate, n: number | null | undefined, digits = 0) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString(t.intl, { maximumFractionDigits: digits });

export async function PartnerBookingList({
  user,
  t,
  discarded = false,
}: {
  user: User;
  t: Translate;
  /** Acabou de descartar um booking que preenchia (?discarded=1). */
  discarded?: boolean;
}) {
  const [lots, canLaunch] = await Promise.all([
    listPartnerBookingLots(user),
    canLaunchBooking(user),
  ]);
  return (
    <>
      <PageHeader
        t={t}
        title={t("bookingLots.title")}
        subtitle={t("bookingLots.partner.subtitle")}
        actions={
          canLaunch && lots !== null ? (
            <LinkButton
              href="/app/booking/import"
              variant="primary"
              data-partner-booking-launch
            >
              {t("bookingLots.partner.launch")}
            </LinkButton>
          ) : null
        }
      />
      {lots === null ? (
        <div className="mb-3">
          <Alert tone="warning">{t("bookingLots.schemaMissing")}</Alert>
        </div>
      ) : null}
      {discarded ? (
        <div className="mb-3" data-partner-booking-discarded>
          <Alert tone="success">{t("bookingLots.partner.discarded")}</Alert>
        </div>
      ) : null}
      {lots?.some((lot) => bookingLotPreparing(lot.status)) ? (
        <div className="mb-3" data-partner-booking-unsent>
          <Alert tone="warning">{t("bookingLots.partner.unsentHint")}</Alert>
        </div>
      ) : null}
      <Card>
        {lots?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t("bookingLots.col.number")}</Th>
                <Th>{t("bookingLots.col.status")}</Th>
                <Th>{t("bookingLots.col.date")}</Th>
                <Th>{t("bookingLots.col.fileName")}</Th>
                <Th className="text-right">{t("bookingLots.col.itemCount")}</Th>
                <Th>{t("bookingLots.col.createdAt")}</Th>
              </tr>
            </thead>
            <tbody data-partner-booking-list>
              {lots.map((lot) => (
                <tr
                  key={lot.id}
                  className={rowClass}
                  data-partner-booking={lot.id}
                  data-partner-booking-status={lot.status}
                >
                  <Td className="whitespace-nowrap font-medium">
                    <Link
                      href={`/app/booking/lots/${lot.id}`}
                      className={linkClass}
                    >
                      {lotTitle(t, lot)}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={statusOf(t, lot.status).tone}>
                      {statusOf(t, lot.status).label}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {lot.bookingDate ? formatDate(lot.bookingDate, t) : "—"}
                  </Td>
                  <Td className="min-w-48">{lot.fileName}</Td>
                  <Td className="text-right tabular-nums">
                    {num(t, lot.itemCount)}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {formatDate(lot.createdAt, t)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>
            {t(
              canLaunch
                ? "bookingLots.partner.emptyLaunch"
                : "bookingLots.partner.empty",
            )}
          </Empty>
        )}
      </Card>
    </>
  );
}

/**
 * Lançar booking: o parceiro sobe a planilha dele. Nulo quando o login não
 * pode lançar (a tela é só de consulta): quem chama volta para a lista.
 */
export async function PartnerBookingLaunch({
  user,
  t,
  error,
}: {
  user: User;
  t: Translate;
  /** Código do erro da última tentativa (?error=...). */
  error: string;
}) {
  if (!(await canLaunchBooking(user))) return null;
  const known = [
    `bookingLots.error.${error}`,
    `sheetImport.error.${error}`,
  ].find((k) => k in dictionaries.pt) as DictionaryKey | undefined;
  const errorText = !error ? null : known ? t(known) : fallbackError(t, error);
  return (
    <>
      <PageHeader
        t={t}
        title={t("bookingLots.partner.launch")}
        subtitle={t("bookingLots.partner.launch.subtitle")}
        actions={
          <LinkButton href="/app/booking" variant="secondary">
            {t("bookingLots.partner.back")}
          </LinkButton>
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <Card title={t("bookingLots.import.form")} className="lg:col-span-2">
          <form
            action={launchBookingAction}
            className="space-y-3"
            data-partner-booking-launch-form
          >
            <Field
              label={t("bookingLots.import.file")}
              hint={t("bookingLots.import.fileHint")}
            >
              <SheetFileInput
                label={t("bookingLots.import.file")}
                uploadingLabel={t("sheetImport.uploading")}
                failedLabel={t("sheetImport.uploadFailed")}
                chosenLabel={t("sheetImport.uploaded")}
              />
            </Field>
            <Field
              label={t("bookingLots.import.currency")}
              hint={t("bookingLots.import.currencyHint")}
            >
              <Select name="currency" defaultValue="USD">
                {SHEET_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton
              pendingText={t("bookingLots.import.submitting")}
              data-partner-booking-launch-submit
            >
              {t("bookingLots.partner.launch.submit")}
            </SubmitButton>
          </form>
        </Card>
        <Card title={t("bookingLots.import.columns.title")}>
          <div className="space-y-2 text-sm text-zinc-700">
            <p>{t("bookingLots.import.columns.body")}</p>
            <p className="text-zinc-600">
              {t("bookingLots.import.columns.extra")}
            </p>
            <p className="text-zinc-600">
              {t("bookingLots.partner.launch.after")}
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

export async function PartnerBookingLotView({
  user,
  lotId,
  t,
  created = false,
  sent = false,
  error = "",
}: {
  user: User;
  lotId: string;
  t: Translate;
  /** Acabou de subir a planilha (?created=1). */
  created?: boolean;
  /** Acabou de enviar para a Wellmix (?sent=1). */
  sent?: boolean;
  /** Código do erro da última ação (?error=...). */
  error?: string;
}) {
  const detail = await getPartnerBookingLot(user, lotId);
  // Booking de outra empresa (ou que não existe): não se diz qual dos dois.
  if (!detail) notFound();
  const { lot, items, partnerName, factoryName } = detail;
  const preparing = bookingLotPreparing(lot.status);
  const known = [`bookingLots.error.${error}`, `common.${error}`].find(
    (k) => k in dictionaries.pt,
  ) as DictionaryKey | undefined;
  const errorText = !error ? null : known ? t(known) : fallbackError(t, error);
  return (
    <>
      <PageHeader
        t={t}
        title={lotTitle(t, lot)}
        // Como na tela da Wellmix (dono, 14/11/2026): o status e, em duas
        // linhas, o Fornecedor e a Fábrica do registro; o nome do arquivo
        // não identifica nenhum dos dois.
        subtitle={
          <span
            className="flex flex-col items-start gap-1"
            data-booking-lot-heading
          >
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={statusOf(t, lot.status).tone}>
                {statusOf(t, lot.status).label}
              </Badge>
              {lot.bookingDate ? (
                <span>{formatDate(lot.bookingDate, t)}</span>
              ) : null}
            </span>
            <span>
              {partnerName
                ? t("bookingLots.detail.headingSupplier", {
                    name: partnerName,
                  })
                : t("bookingLots.detail.headingSupplierNone")}
            </span>
            <span>
              {factoryName
                ? t("bookingLots.detail.headingFactory", { name: factoryName })
                : t("bookingLots.detail.headingFactoryNone")}
            </span>
          </span>
        }
        actions={
          <LinkButton href="/app/booking" variant="secondary">
            {t("bookingLots.partner.back")}
          </LinkButton>
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      {sent ? (
        <div className="mb-3" data-partner-booking-sent>
          <Alert tone="success">
            {t("bookingLots.partner.sent", { n: lot.number })}
          </Alert>
        </div>
      ) : null}
      {preparing ? (
        <PreparingItems t={t} lot={lot} items={items} created={created} />
      ) : (
        <SentItems t={t} items={items} />
      )}
    </>
  );
}

/** Enviar para a Wellmix e descartar: no alto e no fim da tabela. */
function PreparingActions({
  t,
  lotId,
  blanks,
  marker,
}: {
  t: Translate;
  lotId: string;
  /** Campos obrigatórios em branco (só avisa, não impede). */
  blanks: number;
  marker: "top" | "bottom";
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <form action={sendPartnerBookingAction}>
        <input type="hidden" name="lotId" value={lotId} />
        <SubmitButton
          variant="primary"
          pendingText={t("bookingLots.partner.sending")}
          confirmText={
            blanks
              ? t("bookingLots.partner.sendConfirmBlanks", { n: blanks })
              : undefined
          }
          data-partner-booking-send={marker}
        >
          {t("bookingLots.partner.send")}
        </SubmitButton>
      </form>
      <form action={discardPartnerBookingAction}>
        <input type="hidden" name="lotId" value={lotId} />
        <SubmitButton
          variant="secondary"
          confirmText={t("bookingLots.partner.discardConfirm")}
          data-partner-booking-discard={marker}
        >
          {t("bookingLots.partner.discard")}
        </SubmitButton>
      </form>
    </div>
  );
}

/**
 * Em preenchimento: todos os campos da planilha abertos e já preenchidos.
 * Cada um grava ao sair dele; o que a Wellmix exige e está em branco fica
 * destacado (não impede o envio).
 */
function PreparingItems({
  t,
  lot,
  items,
  created,
}: {
  t: Translate;
  lot: PartnerBookingLot;
  items: PartnerBookingItem[];
  created: boolean;
}) {
  const decimal = t.intl.startsWith("pt") ? "," : ".";
  const colLabel = (f: string) =>
    t(`bookingLots.item.col.${f}` as DictionaryKey);
  const blanks = items.reduce(
    (total, item) =>
      total +
      EDIT_COLUMNS.filter(
        ({ field }) =>
          isRequiredItemField(field) && shown(item, field) === null,
      ).length,
    0,
  );
  const th =
    "border-b border-zinc-200 bg-zinc-50/80 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap text-zinc-500";
  const td =
    "border-b border-zinc-100 px-2 py-2 align-top text-[13px] text-zinc-800";
  const cell = (
    item: PartnerBookingItem,
    field: BookingItemField,
    width: string,
  ) => {
    const value = shown(item, field);
    const required = isRequiredItemField(field);
    // Capacidade: aceita letras (o tamanho, quando o produto não tem volume).
    const kind = field === "capacityMl" ? "text" : bookingItemFieldKind(field);
    const labels = {
      field: t("bookingLots.item.edit", {
        field: colLabel(field),
        n: item.itemNumber ?? String(item.position + 1),
      }),
      saving: t("booking.row.saving"),
      saved: t("booking.row.saved"),
      failed: t("booking.row.failed"),
    };
    if (kind === "incoterm" || kind === "currency") {
      const list = kind === "incoterm" ? SHEET_INCOTERMS : SHEET_CURRENCIES;
      return (
        <PartnerItemSelect
          lotId={lot.id}
          itemId={item.id}
          field={field}
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
      <PartnerItemInput
        lotId={lot.id}
        itemId={item.id}
        field={field}
        saved={
          typeof value === "number"
            ? String(value).replace(".", decimal)
            : typeof value === "string"
              ? value
              : ""
        }
        numeric={kind === "number"}
        width={width}
        required={required}
        labels={labels}
      />
    );
  };
  return (
    <>
      <div className="mb-3" data-partner-booking-preparing>
        <Alert tone={created ? "success" : "warning"}>
          {t(
            created
              ? "bookingLots.partner.loaded"
              : "bookingLots.partner.preparingHint",
          )}
        </Alert>
      </div>
      <Card
        title={t("bookingLots.partner.items", { n: String(items.length) })}
        actions={
          <PreparingActions t={t} lotId={lot.id} blanks={blanks} marker="top" />
        }
      >
        <p className="mb-2 text-xs text-zinc-500">
          {t("bookingLots.partner.editHint")}
          {blanks ? (
            <span
              className="text-amber-800"
              data-partner-booking-blanks={blanks}
            >
              {" "}
              {t("bookingLots.partner.blanks", { n: blanks })}
            </span>
          ) : null}
        </p>
        {items.length ? (
          <div className="relative -mx-4 overflow-x-auto border-y border-zinc-200/80 bg-white sm:mx-0 sm:rounded-xl sm:border">
            <table
              className="w-full text-left text-sm"
              data-partner-booking-edit
            >
              <thead>
                <tr>
                  <th className={th}>#</th>
                  {EDIT_COLUMNS.map(({ field }) => (
                    <th key={field} className={th}>
                      {colLabel(field)}
                      {isRequiredItemField(field) ? (
                        <span className="text-brand-700"> *</span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} data-partner-booking-item={item.id}>
                    <td
                      className={`${td} text-right tabular-nums text-zinc-500`}
                    >
                      {index + 1}
                    </td>
                    {EDIT_COLUMNS.map(({ field, width }) => (
                      <td key={field} className={td}>
                        {cell(item, field, width)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t("bookingLots.partner.noItems")}</Empty>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
          <p className="max-w-xl text-sm text-zinc-600">
            {t("bookingLots.partner.sendHint")}
          </p>
          <PreparingActions
            t={t}
            lotId={lot.id}
            blanks={blanks}
            marker="bottom"
          />
        </div>
      </Card>
    </>
  );
}

/** Já enviado: só para consultar, sem a análise da Wellmix. */
function SentItems({
  t,
  items,
}: {
  t: Translate;
  items: PartnerBookingItem[];
}) {
  const col = (k: string) =>
    t(`supplierRequests.selection.col.${k}` as DictionaryKey);
  return (
    <Card title={t("bookingLots.partner.items", { n: String(items.length) })}>
      {items.length ? (
        <Table>
          <thead>
            <tr>
              <Th className="w-10 text-right">#</Th>
              <Th>{col("item")}</Th>
              <Th className="text-right">{col("price")}</Th>
              <Th className="text-right">{col("moq")}</Th>
              <Th className="text-right">{col("box")}</Th>
              <Th className="text-right">{col("cbm")}</Th>
              <Th>{col("size")}</Th>
              <Th className="text-right">{col("capacity")}</Th>
              <Th>{col("material")}</Th>
            </tr>
          </thead>
          <tbody data-partner-booking-items>
            {items.map((i, index) => (
              <tr key={i.id} className={rowClass}>
                <Td className="text-right tabular-nums text-zinc-500">
                  {index + 1}
                </Td>
                <Td className="min-w-56">
                  <span className="font-medium text-zinc-900">
                    {i.productName ?? i.description ?? "—"}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {[i.itemNumber, i.factoryItemCode]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-right tabular-nums">
                  {i.price === null
                    ? "—"
                    : [num(t, i.price, 4), i.currency, i.incoterm]
                        .filter(Boolean)
                        .join(" ")}
                </Td>
                <Td className="text-right tabular-nums">{num(t, i.moq)}</Td>
                <Td className="whitespace-nowrap text-right tabular-nums">
                  {num(t, i.masterCartonQty)}
                  {i.innerQty ? ` / ${num(t, i.innerQty)}` : ""}
                </Td>
                <Td className="text-right tabular-nums">
                  {num(t, i.cbmPerCarton, 4)}
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {[i.lengthCm, i.widthCm, i.heightCm].some((n) => n !== null)
                    ? [i.lengthCm, i.widthCm, i.heightCm]
                        .map((n) => num(t, n, 2))
                        .join(" × ")
                    : "—"}
                </Td>
                <Td className="text-right tabular-nums">
                  {typeof bookingCapacityShown(i) === "string"
                    ? bookingCapacityShown(i)
                    : num(t, i.capacityMl)}
                </Td>
                <Td className="min-w-40">
                  {[i.material, i.packageType, i.colorAssortment]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>{t("bookingLots.partner.noItems")}</Empty>
      )}
    </Card>
  );
}
