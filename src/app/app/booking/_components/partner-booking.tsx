import type { ReactNode } from "react";
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
  cx,
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
import { TableTools } from "@/components/table-tools";
import {
  BookingBulkProvider,
  BulkFieldInput,
  BulkLoadButton,
  BulkRowCheck,
  BulkSelectAll,
  BulkStatus,
} from "@/components/booking-bulk-fill";
import {
  bulkFillLabels,
  colRem,
  FIRST_COL_REM,
  STICKY_FIRST_PLAIN,
  STICKY_PHOTO,
} from "@/lib/booking-bulk-ui";
import {
  discardPartnerBookingAction,
  launchBookingAction,
  sendPartnerBookingAction,
} from "../../actions/booking-lots";
import { BookMetaFields } from "./book-meta-fields";

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

/** Coluna da foto na tabela de conferência (a mesma largura da consulta). */
const PHOTO_COL_REM = 6.5;

/**
 * Colunas do booking em preenchimento: os campos da planilha, um por coluna,
 * com os que identificam o item na frente. Sem o Nome, o Nº do item, a
 * programação de compra, o intervalo de saída, a quantidade de compra e o TT
 * PCS: saíram da importação (dono, 23 e 24/11/2026). O que a planilha
 * trouxer nesses campos continua gravado.
 */
const EDIT_COLUMNS: Array<{ field: BookingItemField; width: string }> = [
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

/**
 * Foto do item e cartão do fabricante que vieram na planilha, em miniatura
 * (abrem o arquivo). Nas duas tabelas do parceiro: a de conferência (antes de
 * enviar; dono, 23/11/2026: as fotos não apareciam ali) e a de consulta.
 * Nulo: o item não tem foto nem cartão.
 */
function itemPhotos(
  t: Translate,
  i: Pick<PartnerBookingItem, "photoDocumentId" | "cardDocumentId">,
): ReactNode {
  const docs = [i.photoDocumentId, i.cardDocumentId].filter(
    (d): d is string => !!d,
  );
  if (!docs.length) return null;
  return (
    <span className="flex gap-1" data-partner-booking-photos={docs.length}>
      {docs.map((doc) => (
        <a
          key={doc}
          href={`/api/files/${doc}`}
          target="_blank"
          rel="noreferrer"
          title={
            doc === i.cardDocumentId
              ? t("bookingLots.item.card")
              : t("bookingLots.item.col.photo")
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
          <img
            src={`/api/files/${doc}?thumb=1`}
            alt=""
            className="h-10 w-10 rounded border border-zinc-200 bg-white object-cover"
            loading="lazy"
          />
        </a>
      ))}
    </span>
  );
}

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
        title={t("partnerBooks.title")}
        subtitle={t("bookingLots.partner.subtitle")}
        actions={
          // "Importar book" (dono, 23/11/2026), como na tela da Wellmix, sem
          // a Seleção de itens (só interna).
          canLaunch && lots !== null ? (
            <LinkButton
              href="/app/booking/import"
              variant="primary"
              data-partner-booking-launch
            >
              {t("bookingLots.import")}
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
                <Th>{t("bookWork.itemType")}</Th>
                <Th className="text-right">{t("bookingLots.col.itemCount")}</Th>
                <Th className="text-right">{t("bookWork.col.workedPct")}</Th>
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
                  <Td>
                    {[
                      lot.storeNumber,
                      lot.supplierName,
                      lot.itemType,
                      lot.incoterm,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {num(t, lot.itemCount)}
                  </Td>
                  {/* Quanto do book a Wellmix já trabalhou na Seleção de
                      itens (dono, 23/11/2026); antes de enviar, "—". */}
                  <Td
                    className="text-right tabular-nums"
                    data-partner-booking-worked={lot.worked?.pct ?? 0}
                  >
                    {bookingLotPreparing(lot.status) || !lot.worked ? (
                      "—"
                    ) : (
                      <span className="inline-flex flex-col items-end">
                        <span className="font-semibold">{lot.worked.pct}%</span>
                        <span className="text-[11px] text-zinc-500">
                          {t("bookWork.worked.count", {
                            worked: lot.worked.worked,
                            total: lot.worked.total,
                          })}
                        </span>
                      </span>
                    )}
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
  // Sugestões do tipo de item: só os dos books da empresa dele.
  const types = [
    ...new Set(
      ((await listPartnerBookingLots(user)) ?? [])
        .map((lot) => lot.itemType)
        .filter((v): v is string => !!v),
    ),
  ].sort((a, b) => a.localeCompare(b));
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
              hint={`${t("bookingLots.import.fileHint")} ${t("bookWork.import.multiHint")}`}
            >
              <SheetFileInput
                label={t("bookingLots.import.file")}
                uploadingLabel={t("sheetImport.uploading")}
                failedLabel={t("sheetImport.uploadFailed")}
                chosenLabel={t("sheetImport.uploaded")}
                multiple
                countLabel={t("bookWork.import.files")}
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
            <BookMetaFields t={t} types={types} />
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
        <SentItems t={t} items={items} worked={lot.worked} />
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
    "border-b border-zinc-200 bg-zinc-50 px-2 py-2 align-bottom text-[11px] font-semibold uppercase tracking-wide break-words text-zinc-500";
  const bulkTh =
    "border-b border-zinc-200 bg-white px-2 py-1.5 align-top text-left font-normal normal-case tracking-normal";
  /** Como o campo em massa é digitado: o da coluna (a capacidade aceita letras). */
  const bulkKind = (field: BookingItemField) => {
    const kind = field === "capacityMl" ? "text" : bookingItemFieldKind(field);
    return kind === "incoterm" || kind === "currency"
      ? ("select" as const)
      : kind === "number"
        ? ("number" as const)
        : ("text" as const);
  };
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
          {t("bookingLots.partner.editHint")}{" "}
          {items.length ? t("bookingLots.bulk.hint") : null}
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
          // Cabeçalho congelado e preenchimento em massa (dono, 16/11/2026):
          // a mesma tabela, sem busca, ordem nem páginas, como antes.
          <BookingBulkProvider
            lotId={lot.id}
            mode="partner"
            itemIds={items.map((item) => item.id)}
            rowLabels={Object.fromEntries(
              items.map((item, index) => [item.id, String(index + 1)]),
            )}
            fieldLabels={Object.fromEntries(
              EDIT_COLUMNS.map(({ field }) => [field, colLabel(field)]),
            )}
            labels={bulkFillLabels(t)}
          >
            <TableTools
              stickyHead
              stickyBar={<BulkStatus />}
              sortable={false}
              searchable={false}
              paginated={false}
              tableClassName="min-w-0"
              data-partner-booking-edit=""
            >
              <colgroup>
                <col style={{ width: `${FIRST_COL_REM}rem` }} />
                <col style={{ width: `${PHOTO_COL_REM}rem` }} />
                {EDIT_COLUMNS.map(({ field, width }) => (
                  <col key={field} style={{ width: `${colRem(width)}rem` }} />
                ))}
              </colgroup>
              <thead>
                <tr data-table-sort-row="">
                  <th className={cx(th, STICKY_FIRST_PLAIN, "bg-zinc-50")}>
                    <span className="flex items-center gap-2">
                      <BulkSelectAll />#
                    </span>
                  </th>
                  <th className={cx(th, STICKY_PHOTO, "bg-zinc-50")}>
                    {t("bookingLots.item.col.photo")}
                  </th>
                  {EDIT_COLUMNS.map(({ field }) => (
                    <th key={field} className={th}>
                      {colLabel(field)}
                      {isRequiredItemField(field) ? (
                        <span className="text-brand-700"> *</span>
                      ) : null}
                    </th>
                  ))}
                </tr>
                <tr data-bulk-fill-row="">
                  <th className={cx(bulkTh, STICKY_FIRST_PLAIN, "bg-white")}>
                    <BulkLoadButton />
                  </th>
                  <th className={cx(bulkTh, STICKY_PHOTO, "bg-white")} />
                  {EDIT_COLUMNS.map(({ field }) => (
                    <th key={field} className={bulkTh}>
                      <BulkFieldInput
                        field={field}
                        kind={bulkKind(field)}
                        label={colLabel(field)}
                        options={
                          field === "incoterm"
                            ? SHEET_INCOTERMS
                            : field === "currency"
                              ? SHEET_CURRENCIES
                              : undefined
                        }
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={item.id}
                    className="group"
                    data-partner-booking-item={item.id}
                    data-bulk-row={item.id}
                  >
                    <td
                      className={cx(
                        td,
                        "tabular-nums text-zinc-500",
                        STICKY_FIRST_PLAIN,
                        "bg-white",
                      )}
                    >
                      <label className="flex cursor-pointer items-start gap-2">
                        <BulkRowCheck itemId={item.id} n={String(index + 1)} />
                        <span>{index + 1}</span>
                      </label>
                    </td>
                    <td
                      className={cx(td, STICKY_PHOTO, "bg-white")}
                      data-partner-booking-photo={item.id}
                    >
                      {itemPhotos(t, item) ?? (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    {EDIT_COLUMNS.map(({ field, width }) => (
                      <td key={field} className={td}>
                        {cell(item, field, width)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </TableTools>
          </BookingBulkProvider>
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

/** Uma coluna da tabela de consulta (já enviado). */
interface SentColumn {
  key: string;
  label: string;
  /** Largura fixa em rem (título e célula alinhados nas duas tabelas). */
  width: number;
  align: "left" | "right" | "center";
  /** Parada na rolagem lateral (nº da linha e foto). */
  frozen?: boolean;
  value: (item: PartnerBookingItem, index: number) => ReactNode;
}

/**
 * Já enviado: só para consultar, sem a análise da Wellmix (dono,
 * 16/11/2026). Uma tabela, uma linha por item, um dado por coluna, na ordem
 * pedida; cada célula vem do seu campo do registro (preço, moeda e Incoterm;
 * caixa master e inner; capacidade em ml e tamanho em texto; as três
 * medidas), sem separar texto: "4 USD EXW" são três campos, "24 / 12" são a
 * caixa master e a inner, "A4" é o tamanho. Os outros campos que o parceiro
 * preencheu (descrição, pesos, energia, programação e quantidades) vêm
 * depois, para nada da ficha se perder. Dado ausente: "—".
 *
 * Cabeçalho fixo abaixo da barra do Portal e rolagem lateral dentro da
 * tabela (Table stickyHead, o mesmo das tabelas do Book da Wellmix); nº da
 * linha e foto congelados. Capacidade: a conferida pelo cadastro do produto
 * quando o book traz tamanho em texto e ml juntos (`capacityMlShown`).
 */
function SentItems({
  t,
  items,
  worked,
}: {
  t: Translate;
  items: PartnerBookingItem[];
  /** Itens trabalhados pela Wellmix na Seleção de itens. */
  worked?: PartnerBookingLot["worked"];
}) {
  const label = (k: string) =>
    t(`bookingLots.partner.col.${k}` as DictionaryKey);
  const field = (k: string) => t(`bookingLots.item.col.${k}` as DictionaryKey);
  const missing = <span className="text-zinc-400">—</span>;
  const text = (v: string | null | undefined) =>
    v && v.trim() ? v.trim() : missing;
  const number = (v: number | null | undefined, digits = 0) =>
    v === null || v === undefined ? missing : num(t, v, digits);
  const photos = (i: PartnerBookingItem) => itemPhotos(t, i) ?? missing;
  const columns: SentColumn[] = [
    {
      key: "line",
      label: label("line"),
      width: FIRST_COL_REM,
      align: "right",
      frozen: true,
      value: (_, index) => index + 1,
    },
    {
      key: "photo",
      label: field("photo"),
      width: 6.5,
      align: "left",
      frozen: true,
      value: photos,
    },
    // Trabalhado pela Wellmix na Seleção de itens (dono, 23/11/2026).
    {
      key: "worked",
      label: t("bookWork.col.worked"),
      width: 8,
      align: "left",
      value: (i) => (
        <Badge tone={i.worked ? "success" : "neutral"}>
          {t(i.worked ? "bookWork.worked.yes" : "bookWork.worked.no")}
        </Badge>
      ),
    },
    {
      key: "name",
      label: label("name"),
      width: 15,
      align: "left",
      value: (i) => (
        <span className="font-medium text-zinc-900">
          {text(i.productName?.trim() ? i.productName : i.description)}
        </span>
      ),
    },
    {
      key: "sku",
      label: label("sku"),
      width: 9,
      align: "left",
      value: (i) => text(i.factoryItemCode),
    },
    // Nº do item: campo próprio da planilha (nem o nº da linha, nem o SKU).
    {
      key: "itemNumber",
      label: field("itemNumber"),
      width: 6,
      align: "left",
      value: (i) => text(i.itemNumber),
    },
    {
      key: "price",
      label: label("price"),
      width: 6.5,
      align: "right",
      value: (i) => number(i.price, 4),
    },
    {
      key: "currency",
      label: label("currency"),
      width: 5.5,
      align: "center",
      value: (i) => text(i.currency),
    },
    {
      key: "incoterm",
      label: label("incoterm"),
      width: 5.75,
      align: "center",
      value: (i) => text(i.incoterm),
    },
    {
      key: "moq",
      label: label("moq"),
      width: 6.5,
      align: "right",
      value: (i) => number(i.moq),
    },
    {
      key: "master",
      label: label("master"),
      width: 7.5,
      align: "right",
      value: (i) => number(i.masterCartonQty),
    },
    {
      key: "inner",
      label: label("inner"),
      width: 7.5,
      align: "right",
      value: (i) => number(i.innerQty),
    },
    {
      key: "cbm",
      label: label("cbm"),
      width: 6.5,
      align: "right",
      value: (i) => number(i.cbmPerCarton, 4),
    },
    {
      key: "length",
      label: label("length"),
      width: 7.5,
      align: "right",
      value: (i) => number(i.lengthCm, 2),
    },
    {
      key: "width",
      label: label("width"),
      width: 7,
      align: "right",
      value: (i) => number(i.widthCm, 2),
    },
    {
      key: "height",
      label: label("height"),
      width: 7,
      align: "right",
      value: (i) => number(i.heightCm, 2),
    },
    // Só os mililitros; o tamanho em texto ("A4", "8X10") tem a coluna dele.
    {
      key: "capacity",
      label: label("capacity"),
      width: 7.5,
      align: "right",
      value: (i) =>
        number(
          i.capacityMlShown === undefined ? i.capacityMl : i.capacityMlShown,
          2,
        ),
    },
    {
      key: "size",
      label: label("size"),
      width: 8.5,
      align: "left",
      value: (i) => text(i.sizeText),
    },
    {
      key: "colors",
      label: label("colors"),
      width: 11,
      align: "left",
      value: (i) => text(i.colorAssortment),
    },
    {
      key: "material",
      label: label("material"),
      width: 11,
      align: "left",
      value: (i) => text(i.material),
    },
    {
      key: "package",
      label: label("package"),
      width: 11,
      align: "left",
      value: (i) => text(i.packageType),
    },
    // Os demais campos da ficha que o parceiro preencheu.
    {
      key: "description",
      label: field("description"),
      width: 16,
      align: "left",
      // Sem nome, a descrição já aparece como nome do item.
      value: (i) => (i.productName?.trim() ? text(i.description) : missing),
    },
    {
      key: "netWeight",
      label: field("netWeightPcKg"),
      width: 7.5,
      align: "right",
      value: (i) => number(i.netWeightPcKg, 4),
    },
    {
      key: "grossWeight",
      label: field("grossWeightPcKg"),
      width: 7.5,
      align: "right",
      value: (i) => number(i.grossWeightPcKg, 4),
    },
    {
      key: "power",
      label: field("powerDetail"),
      width: 10,
      align: "left",
      value: (i) => text(i.powerDetail),
    },
    {
      key: "schedule",
      label: field("purchaseSchedule"),
      width: 10,
      align: "left",
      value: (i) => text(i.purchaseSchedule),
    },
    {
      key: "interval",
      label: field("departureIntervalDays"),
      width: 8,
      align: "left",
      value: (i) => text(i.departureIntervalDays),
    },
    {
      key: "purchaseQty",
      label: field("purchaseQty"),
      width: 8,
      align: "right",
      value: (i) => number(i.purchaseQty),
    },
    {
      key: "plannedQty",
      label: field("plannedQty"),
      width: 8.5,
      align: "right",
      value: (i) => number(i.plannedQty),
    },
  ];
  const alignClass = {
    left: "text-left",
    right: "text-right tabular-nums",
    center: "text-center",
  } as const;
  // Colunas presas na rolagem para o lado: as mesmas classes da tela da
  // Wellmix (src/lib/booking-bulk-ui.ts): Nº da linha e, logo depois, Foto.
  const frozenClass = (key: string) =>
    key === "line" ? STICKY_FIRST_PLAIN : key === "photo" ? STICKY_PHOTO : "";
  const divider = (index: number) =>
    index < columns.length - 1 ? "border-r border-zinc-200/70" : "";
  const headClass =
    "border-b border-zinc-200 bg-zinc-50 px-2.5 py-2 align-bottom text-[11px] font-semibold uppercase leading-tight tracking-wide break-words text-zinc-500";
  const cellClass =
    "border-b border-zinc-100 px-2.5 py-2 align-top text-[13px] text-zinc-800 break-words";
  return (
    <Card
      title={
        worked
          ? `${t("bookingLots.partner.items", { n: String(items.length) })} · ${t(
              "bookWork.worked.share",
              worked,
            )}`
          : t("bookingLots.partner.items", { n: String(items.length) })
      }
    >
      {items.length ? (
        /* Tabela padrão (busca, ordem pelo título e páginas) com o cabeçalho
           congelado logo abaixo da barra vermelha e a rolagem para o lado
           dentro da tabela (TableTools stickyHead): título e célula com a
           mesma largura de coluna. */
        /* Bordas separadas: com as bordas "coladas" (border-collapse), quem
           desenha a borda é a tabela e o fundo da célula presa (Nº e Foto)
           a cobre; separadas, cada célula desenha a sua e as divisórias
           continuam nas colunas congeladas. */
        <Table stickyHead tableClassName="border-separate border-spacing-0">
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={{ width: `${c.width}rem` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((c, index) => (
                <th
                  key={c.key}
                  className={cx(
                    headClass,
                    alignClass[c.align],
                    divider(index),
                    frozenClass(c.key),
                  )}
                  data-book-head={c.key}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody data-partner-booking-items>
            {items.map((item, rowIndex) => (
              <tr
                key={item.id}
                data-partner-booking-row={item.id}
                data-partner-booking-row-worked={item.worked ? "yes" : "no"}
              >
                {columns.map((c, index) => (
                  <td
                    key={c.key}
                    className={cx(
                      cellClass,
                      // Linha do item trabalhado: fundo verde claro.
                      item.worked ? "bg-emerald-50" : "bg-white",
                      alignClass[c.align],
                      divider(index),
                      frozenClass(c.key),
                    )}
                    data-book-cell={c.key}
                  >
                    {c.value(item, rowIndex)}
                  </td>
                ))}
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
