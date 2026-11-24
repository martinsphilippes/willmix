import { EntityTimelineCard } from "@/components/entity-timeline-card";
import { bookTimeline } from "@/lib/services/entity-timeline";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import { canSeePurchasePrice } from "@/lib/auth/function-access";
import { PartnerBookingLotView } from "../../_components/partner-booking";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import {
  bookingCapacityShown,
  bookingLotEditable,
  bookingLotLockable,
  bookManufacturer,
  manufacturerMismatch,
  bookingLotMoves,
  bookingLotPending,
  bookingLotReady,
  incompleteBookingItems,
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
import { bookingItemTypes, getBookingLot } from "@/lib/services/booking-lots";
import { durationText, lockLate, workedShare } from "@/lib/booking-locks";
import { GROUP_MAX } from "@/lib/booking-selection";
import { getSettings } from "@/lib/settings";
import { bookIncotermLabels } from "../../_components/book-meta-fields";
import { BookingItemForecast } from "@/components/booking-item-forecast";
import {
  ManufacturerAlert,
  ManufacturerCell,
} from "../../_components/manufacturer";
import { BookIncotermFields } from "@/components/book-incoterm-fields";
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
  linkClass,
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { SupplierNoLoginAlert } from "@/components/supplier-no-login";
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
  lockBookingLotAction,
  moveBookingLotAction,
  registerBookingLotPartnerAction,
  setBookingLotMetaAction,
  unlockBookingAction,
  registerBookingLotSupplierAction,
  setBookingLotNoteAction,
} from "../../../actions/booking-lots";
import { reclassifyBookingNcmAction } from "../../../actions/booking-ncm";
import {
  entityLinkAccess,
  linksForLot,
  linksOfItem,
} from "@/lib/services/entity-links";
import { EntityLinkList, entityLinkNodes } from "@/components/entity-links";
import type { NcmSuggestion } from "@/lib/ncm-match";
import { TableTools } from "@/components/table-tools";
import {
  BookingBulkProvider,
  BulkFieldInput,
  BulkLoadButton,
  BulkRowCheck,
  BulkRefuseButton,
  BulkSelectAll,
  BulkSelectionLink,
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
  BookingPendingList,
  type PendingItemView,
} from "@/components/booking-pending-list";

/*
 * Detalhamento de um booking (docs/BOOKING.md, "Booking por planilha"):
 * dados do booking (status, origem, fornecedor, data), a sugestão de
 * cadastro do fornecedor da planilha, os itens com todos os campos
 * (editáveis no rascunho, cada um grava sozinho), o fechamento com a análise
 * da previsão de preço e o status.
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

/**
 * Colunas dos itens, na ordem da planilha do booking. Sem o Nome, o Nº do
 * item, a programação de compra, o intervalo de saída, a quantidade de
 * compra e o TT PCS, que saíram da importação (dono, 23 e 24/11/2026); o que
 * a planilha trouxer continua gravado.
 */
const COLUMNS: Array<{
  field: BookingItemField;
  kind: "text" | "number" | "incoterm" | "currency";
  width: string;
}> = [
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
  { field: "colorAssortment", kind: "text", width: "w-36" },
  { field: "powerDetail", kind: "text", width: "w-32" },
];

/** A previsão de preço do book roda depois de fechar, item a item (Sankhya). */
export const maxDuration = 300;

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
  const { lot, items, supplier, suppliers, owner, partner, partners, held } =
    detail;
  // Itens trabalhados na Seleção de itens e com quem está o book (dono,
  // 23/11/2026; docs/BOOKING.md, "Itens trabalhados" e "Travar books").
  const worked = workedShare(items);
  // Fabricante: a Fábrica do book × o que a planilha traz em cada linha
  // (dono, 24/11/2026). Diferente, o book não fecha.
  const manufacturer = bookManufacturer(lot);
  const mixed = items.filter((i) => manufacturerMismatch(i, manufacturer));
  const [itemTypes, settings] = await Promise.all([
    bookingItemTypes(),
    getSettings(),
  ]);
  const heldLate = held
    ? lockLate(held.minutes, settings.bookingLockSlaHours)
    : false;
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
  // Ligações de cada item (fase 4b): solicitações, produto e pedidos.
  const linkAccess = entityLinkAccess(user);
  const lotLinks = await linksForLot(lot.id);

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
    `bookWork.error.${errorCode}`,
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
  if (one("moved")) notices.push(["success", t("bookingLots.detail.moved")]);
  if (one("saved")) notices.push(["success", t("bookingLots.detail.saved")]);
  if (one("locked")) notices.push(["success", t("bookWork.lock.done")]);
  if (one("unlocked")) notices.push(["success", t("bookWork.unlock.done")]);
  if (one("manufacturer"))
    notices.push(["success", t("bookWork.manufacturer.confirmed")]);
  if (one("removed"))
    notices.push(["success", t("bookWork.manufacturer.removed")]);
  if (one("supplier") === "created")
    notices.push(["success", t("bookingLots.detail.supplierCreated")]);

  const hint = lot.supplierHint;
  const sheetSupplier = hint?.name ?? null;
  // Na caixa "Dados do booking" este campo se chama Fábrica (dono,
  // 13/11/2026); a lista de bookings continua com "Sem fornecedor".
  const supplierOptions = [
    { value: "", label: t("bookingLots.detail.supplierNone") },
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

  /* "Fechar e analisar" parou por campos obrigatórios vazios (dono,
     14/11/2026): a lista dos itens incompletos, cada um com os campos que
     faltam, sai da mesma validação do fechamento (e do "Falta para fechar").
     A tela se atualiza a cada campo gravado, e a lista junto. */
  const itemsBlocked = errorCode === "booking_items_incomplete";
  const incomplete: PendingItemView[] = itemsBlocked
    ? incompleteBookingItems(items, pending).map((it) => {
        const label =
          [it.name, it.code].filter(Boolean).join(" · ") ||
          t("bookingLots.incomplete.line", { n: it.line });
        return {
          itemId: it.itemId,
          label,
          fields: it.fields.map((field) => ({
            field,
            label: colLabel(field),
            title: t("bookingLots.incomplete.go", {
              field: colLabel(field),
              item: label,
            }),
          })),
        };
      })
    : [];

  const pendingList = [
    pending.supplier ? t("bookingLots.pending.supplier") : null,
    pending.date ? t("bookingLots.pending.date") : null,
    pending.noItems ? t("bookingLots.pending.noItems") : null,
    pending.items.size
      ? t("bookingLots.pending.items", { n: pending.items.size })
      : null,
  ].filter(Boolean) as string[];

  // Preço e moeda do Book: só com "Ver preço de compra" (dono, 15/11/2026;
  // docs/LINHA_DE_VISAO.md); sem ela as colunas não vão à tela. A previsão de
  // preço do Sankhya (sinal, venda prevista, lucro e o cartão "Previsão de preço")
  // segue a mesma permissão: o custo sai do preço.
  const seesPrice = canSeePurchasePrice(user);
  const columns = seesPrice
    ? COLUMNS
    : COLUMNS.filter((c) => c.field !== "price" && c.field !== "currency");
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

  const analysisCell = (item: BookingItem): ReactNode => (
    <BookingItemForecast analysis={item.analysis} t={t} />
  );

  /* Itens: cabeçalho congelado (TableTools stickyHead) e, com algo para
     editar, o preenchimento em massa (dono, 16/11/2026): a caixa de cada
     linha, a do cabeçalho (todas) e, abaixo dos títulos, um campo vazio por
     coluna editável e "Carregar". Rascunho: as colunas do item (preço e
     moeda só com "Ver preço de compra") e o NCM; fechado ou em andamento,
     só o NCM; cancelado, nada. Larguras fixas: as duas partes alinham. */
  const bulkColumns = editable ? columns : [];
  const bulkOn = bulkColumns.length > 0 || ncmEditable;
  const th =
    "border-b border-zinc-200 bg-zinc-50 px-2 py-2 align-bottom text-[11px] font-semibold uppercase tracking-wide break-words text-zinc-500";
  const bulkTh =
    "border-b border-zinc-200 bg-white px-2 py-1.5 align-top text-left font-normal normal-case tracking-normal";
  const itemsTable = (
    <TableTools
      stickyHead
      stickyBar={bulkOn ? <BulkStatus /> : undefined}
      className=""
      tableClassName="min-w-0"
      data-booking-items=""
    >
      <colgroup>
        <col style={{ width: `${FIRST_COL_REM}rem` }} />
        <col style={{ width: "6.5rem" }} />
        <col style={{ width: "8rem" }} />
        <col style={{ width: "13rem" }} />
        <col style={{ width: "11.5rem" }} />
        {columns.map((c) => (
          <col key={c.field} style={{ width: `${colRem(c.width)}rem` }} />
        ))}
        <col style={{ width: "12rem" }} />
        {seesPrice ? <col style={{ width: "11rem" }} /> : null}
        <col style={{ width: "13rem" }} />
      </colgroup>
      <thead>
        <tr data-table-sort-row="">
          <th className={cx(th, STICKY_FIRST_PLAIN, "bg-zinc-50")}>
            {bulkOn ? (
              <span className="flex items-center gap-2">
                <BulkSelectAll />
                {colLabel("position")}
              </span>
            ) : (
              colLabel("position")
            )}
          </th>
          <th className={cx(th, STICKY_PHOTO, "bg-zinc-50")}>
            {colLabel("photo")}
          </th>
          <th className={th}>{t("bookWork.col.worked")}</th>
          <th className={th}>{t("bookWork.manufacturer")}</th>
          <th className={th}>
            {t("bookingNcm.col")}
            <span className="text-brand-700"> *</span>
          </th>
          {columns.map((c) => (
            <th key={c.field} className={th}>
              {colLabel(c.field)}
              {isRequiredItemField(c.field) ? (
                <span className="text-brand-700"> *</span>
              ) : null}
            </th>
          ))}
          {(seesPrice ? ["check", "analysis"] : ["check"]).map((k) => (
            <th key={k} className={th}>
              {colLabel(k)}
            </th>
          ))}
          <th className={th}>{t("entityLinks.col")}</th>
        </tr>
        {bulkOn ? (
          <tr data-bulk-fill-row="">
            <th className={cx(bulkTh, STICKY_FIRST_PLAIN, "bg-white")}>
              <BulkLoadButton />
            </th>
            <th className={cx(bulkTh, STICKY_PHOTO, "bg-white")} />
            <th className={bulkTh} />
            <th className={bulkTh} />
            <th className={bulkTh}>
              {ncmEditable ? (
                <BulkFieldInput
                  field="ncm"
                  kind="number"
                  label={t("bookingNcm.col")}
                />
              ) : null}
            </th>
            {columns.map((c) => (
              <th key={c.field} className={bulkTh}>
                {bulkColumns.includes(c) ? (
                  <BulkFieldInput
                    field={c.field}
                    kind={
                      c.kind === "incoterm" || c.kind === "currency"
                        ? "select"
                        : c.kind === "number" && c.field !== "capacityMl"
                          ? "number"
                          : "text"
                    }
                    label={colLabel(c.field)}
                    options={
                      c.kind === "incoterm"
                        ? SHEET_INCOTERMS
                        : c.kind === "currency"
                          ? SHEET_CURRENCIES
                          : undefined
                    }
                  />
                ) : null}
              </th>
            ))}
            <th className={bulkTh} />
            {seesPrice ? <th className={bulkTh} /> : null}
            <th className={bulkTh} />
          </tr>
        ) : null}
      </thead>
      <tbody>
        {items.map((item) => {
          const missing = missingItemFields(item);
          // Linha do item trabalhado: fundo verde claro (também nas colunas
          // presas), para ver de longe o que já passou pela Seleção.
          const done = !!item.workedAt;
          const stuckBg = done
            ? "bg-emerald-50"
            : "bg-white group-hover:bg-[color-mix(in_oklab,var(--color-brand-50)_40%,white)]";
          return (
            <tr
              key={item.id}
              className={cx(
                "group transition",
                done ? "bg-emerald-50" : "hover:bg-brand-50/40",
              )}
              data-booking-item={item.id}
              data-booking-item-worked={
                item.refusedAt ? "refused" : done ? "yes" : "no"
              }
              data-bulk-row={bulkOn ? item.id : undefined}
            >
              <td
                className={cx(
                  "border-b border-zinc-100 px-2 py-2 align-top text-xs text-zinc-500",
                  STICKY_FIRST_PLAIN,
                  stuckBg,
                )}
              >
                <label className="flex cursor-pointer items-start gap-2">
                  {bulkOn ? (
                    <BulkRowCheck
                      itemId={item.id}
                      n={String(item.position + 1)}
                    />
                  ) : null}
                  <span>
                    {item.position + 1}
                    {item.sourceRows ? (
                      <span className="block text-[10px]">
                        L{item.sourceRows}
                      </span>
                    ) : null}
                  </span>
                </label>
              </td>
              <td
                className={cx(
                  "border-b border-zinc-100 px-2 py-2 align-top",
                  STICKY_PHOTO,
                  stuckBg,
                )}
                data-booking-item-photo=""
              >
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
                  {!item.photoDocumentId && !item.cardDocumentId ? muted : null}
                </span>
              </td>
              <td className="border-b border-zinc-100 px-2 py-2 align-top text-xs">
                <Badge
                  tone={
                    item.refusedAt ? "danger" : done ? "success" : "neutral"
                  }
                >
                  {t(
                    item.refusedAt
                      ? "bookWork.worked.refused"
                      : done
                        ? "bookWork.worked.yes"
                        : "bookWork.worked.no",
                  )}
                </Badge>
                {item.workedAt ? (
                  <span className="mt-0.5 block text-zinc-500">
                    {formatDate(item.workedAt, t)}
                  </span>
                ) : null}
              </td>
              <td
                className={cx(
                  "border-b border-zinc-100 px-2 py-2 align-top",
                  manufacturerMismatch(item, manufacturer) && "bg-red-50",
                )}
              >
                <ManufacturerCell
                  t={t}
                  lotId={lot.id}
                  itemId={item.id}
                  manufacturer={manufacturer}
                  sheetStore={item.sheetStore ?? null}
                  mismatch={manufacturerMismatch(item, manufacturer)}
                  canEdit={editable}
                />
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
                  <span className="tabular-nums">{item.ncm ?? "—"}</span>
                )}
                <span className="mt-0.5 block">
                  {item.ncm && item.ncmSource ? (
                    <Badge
                      tone={item.ncmSource === "match" ? "info" : "neutral"}
                    >
                      {t(
                        `bookingNcm.source.${item.ncmSource}` as DictionaryKey,
                        {
                          pct: Math.round((item.ncmScore ?? 0) * 100),
                        },
                      )}
                    </Badge>
                  ) : !item.ncm && item.ncmRequestedAt ? (
                    <Badge tone="warning">{t("bookingNcm.pending")}</Badge>
                  ) : null}
                </span>
              </td>
              {columns.map((c) => (
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
                  <Badge tone="success">{t("bookingLots.item.complete")}</Badge>
                )}
              </td>
              {seesPrice ? (
                <td className="border-b border-zinc-100 px-2 py-2 align-top">
                  {analysisCell(item)}
                </td>
              ) : null}
              <td
                className="border-b border-zinc-100 px-2 py-2 align-top text-xs"
                data-booking-item-links=""
              >
                <EntityLinkList
                  className="max-w-48 gap-y-0.5"
                  nodes={entityLinkNodes({
                    t,
                    links: linksOfItem(lotLinks, item.id),
                    access: linkAccess,
                    kinds: [
                      "selection",
                      "supplierRequests",
                      "products",
                      "orders",
                    ],
                  })}
                  empty={muted}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableTools>
  );

  return (
    <>
      <PageHeader
        t={t}
        title={t("bookingLots.detail.title", { n: lot.number })}
        subtitle={
          // Dono e fábrica vêm do registro (partnerId e supplierId), nunca do
          // nome do arquivo, que continua no campo "Planilha".
          <span
            className="flex flex-col items-start gap-1"
            data-booking-lot-heading
          >
            <Badge tone={STATUS_TONE[lot.status]}>
              {statusLabel(lot.status)}
            </Badge>
            <span>
              {partner || lot.supplierName
                ? t("bookingLots.detail.headingSupplier", {
                    name: partner?.name ?? lot.supplierName ?? "",
                  })
                : t("bookingLots.detail.headingSupplierNone")}
            </span>
            <span>
              {supplier
                ? t("bookingLots.detail.headingFactory", {
                    name: supplier.name,
                  })
                : t("bookingLots.detail.headingFactoryNone")}
            </span>
          </span>
        }
        actions={
          <LinkButton href="/app/booking">
            {t("bookingLots.backToList")}
          </LinkButton>
        }
      />
      {/* Linha do tempo do book entre os blocos (docs/FLOW_MENU.md). */}
      <EntityTimelineCard timeline={await bookTimeline(lot)} t={t} />

      <div className="mb-3 space-y-2" data-booking-lot-notices>
        <SupplierNoLoginAlert
          suppliers={noLogin}
          canCreate={isAdmin(user)}
          t={t}
        />
        {itemsBlocked && editable ? (
          incomplete.length ? (
            <Alert tone="danger">
              <span className="block">{errorText}</span>
              <span
                className="mt-1 block font-medium"
                data-booking-lot-incomplete={incomplete.length}
              >
                {t("bookingLots.incomplete.count", { n: incomplete.length })}
              </span>
              <BookingPendingList items={incomplete} />
            </Alert>
          ) : (
            // Tudo completo depois do aviso: é só fechar de novo.
            <Alert tone="success">
              <span data-booking-lot-incomplete-done>
                {t("bookingLots.incomplete.done", {
                  action: t("bookingLots.detail.close.submit"),
                })}
              </span>
            </Alert>
          )
        ) : errorText ? (
          <Alert tone="danger">{errorText}</Alert>
        ) : null}
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

      <ManufacturerAlert
        t={t}
        count={mixed.length}
        manufacturer={manufacturer}
        cancel={
          // A outra saída: cancelar esta importação e refazer.
          editable ? (
            <form action={moveBookingLotAction}>
              <input type="hidden" name="lotId" value={lot.id} />
              <input type="hidden" name="status" value="cancelled" />
              <SubmitButton
                variant="secondary"
                confirmText={t("bookWork.manufacturer.cancelAsk")}
                data-book-manufacturer-cancel
              >
                {t("bookWork.manufacturer.cancel")}
              </SubmitButton>
            </form>
          ) : null
        }
      />
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <Card title={t("bookingLots.detail.header")} className="lg:col-span-2">
          <DescriptionList
            items={[
              // Primeira linha (dono, 13/11/2026): à esquerda o Fornecedor (dono do
              // book, para quem vão as solicitações) e à direita a Fábrica.
              [
                t("bookingLots.partner.title"),
                <span key="p" className="flex flex-col gap-1">
                  {lot.status !== "cancelled" ? (
                    <BookingLotPartnerSelect
                      lotId={lot.id}
                      current={lot.partnerId ?? ""}
                      options={partnerOptions}
                      labels={cellLabels(t("bookingLots.partner.title"))}
                      placeholder={t("bookingLots.partner.search")}
                      noMatch={t("bookingLots.partner.noMatch")}
                    />
                  ) : (
                    (partner?.name ?? t("bookingLots.partner.supplier"))
                  )}
                  <span className="text-xs text-zinc-500">
                    {t("bookingLots.partner.hint")}
                  </span>
                  {/* Supplier digitado na importação e ainda sem cadastro:
                      cadastrar aqui o põe como Fornecedor do book. */}
                  {!lot.partnerId &&
                  lot.supplierName &&
                  lot.status !== "cancelled" ? (
                    <form
                      action={registerBookingLotPartnerAction}
                      className="flex flex-wrap items-center gap-2 text-sm"
                      data-booking-lot-supplier-pending
                    >
                      <input type="hidden" name="lotId" value={lot.id} />
                      <span className="text-amber-800">
                        {t("bookWork.supplier.pending", {
                          name: lot.supplierName,
                        })}
                      </span>
                      <SubmitButton variant="secondary">
                        {t("bookWork.supplier.register")}
                      </SubmitButton>
                    </form>
                  ) : null}
                </span>,
              ],
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
                    (supplier?.name ?? t("bookingLots.detail.supplierNone"))
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
                lot.sheetFiles?.length ? (
                  <span
                    key="fs"
                    className="flex flex-col gap-0.5"
                    data-booking-lot-sheets={lot.sheetFiles.length}
                  >
                    {lot.sheetFiles.map((f, i) => (
                      <span key={`${i}:${f.name}`}>
                        {f.documentId ? (
                          <a
                            href={`/api/files/${f.documentId}`}
                            className={linkClass}
                          >
                            {f.name}
                          </a>
                        ) : (
                          f.name
                        )}{" "}
                        <span className="text-xs text-zinc-500">
                          {t("bookWork.sheetItems", { n: f.items })}
                        </span>
                      </span>
                    ))}
                  </span>
                ) : lot.fileDocumentId ? (
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
              [
                t("bookWork.incoterm"),
                <span key="inc" data-booking-lot-incoterm={lot.incoterm ?? ""}>
                  {lot.incoterm
                    ? lot.incoterm === "EXW" && typeof lot.exwValue === "number"
                      ? t("bookWork.exwShown", {
                          value: lot.exwValue.toLocaleString(intl, {
                            maximumFractionDigits: 4,
                          }),
                        })
                      : lot.incoterm
                    : "—"}
                </span>,
              ],
              [
                t("bookWork.worked.title"),
                <span key="w" data-booking-lot-worked={worked.pct}>
                  {t("bookWork.worked.share", {
                    worked: worked.worked,
                    total: worked.total,
                    pct: worked.pct,
                  })}
                </span>,
              ],
              [t("bookingLots.col.createdAt"), formatDate(lot.createdAt, t)],
            ]}
          />
          {/* Loja/Fábrica e Tipo de item: vêm da importação; a Wellmix
              ajusta (e completa nos books antigos). */}
          {lot.status !== "cancelled" ? (
            <form
              action={setBookingLotMetaAction}
              className="mt-4 flex flex-wrap items-end gap-2"
              data-booking-lot-meta
            >
              <input type="hidden" name="lotId" value={lot.id} />
              <div className="min-w-60 flex-1">
                {/* FOB ou EXW e, ao lado, o Tipo de item (dono, 24/11/2026:
                    sem a linha do nº da loja e do Supplier, que são os da
                    importação). */}
                <div className="flex flex-wrap items-start gap-3">
                  {editable ? (
                    <div className="min-w-60 flex-[2]">
                      <BookIncotermFields
                        incoterm={lot.incoterm ?? ""}
                        exwValue={
                          typeof lot.exwValue === "number"
                            ? String(lot.exwValue).replace(".", decimal)
                            : ""
                        }
                        required={false}
                        labels={bookIncotermLabels(t)}
                      />
                    </div>
                  ) : null}
                  <div className="min-w-48 flex-1">
                    <Field label={t("bookWork.itemType")}>
                      <Input
                        name="itemType"
                        maxLength={80}
                        defaultValue={lot.itemType ?? ""}
                        list="book-item-types"
                        autoComplete="off"
                        data-book-item-type
                      />
                      <datalist id="book-item-types">
                        {itemTypes.map((type) => (
                          <option key={type} value={type} />
                        ))}
                      </datalist>
                    </Field>
                  </div>
                </div>
              </div>
              <SubmitButton variant="secondary">
                {t("bookWork.meta.save")}
              </SubmitButton>
            </form>
          ) : (
            <p className="mt-4 text-sm text-zinc-600">
              {[lot.storeNumber, lot.supplierName, lot.itemType]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          )}
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
          {/* Com quem está o book (trava): o analista pega para si e libera;
              quem supervisiona vê há quanto tempo e libera de qualquer um. */}
          <Card title={t("bookWork.lock.title")} dense>
            {held ? (
              <div className="space-y-2" data-booking-lot-held={held.lock.id}>
                <p className="text-sm text-zinc-700">
                  {t("bookWork.lock.heldBy", {
                    name: held.user?.name ?? "—",
                    time: durationText(held.minutes),
                  })}{" "}
                  <Badge tone={heldLate ? "danger" : "success"}>
                    {t(heldLate ? "bookWork.sla.late" : "bookWork.sla.ok", {
                      h: settings.bookingLockSlaHours,
                    })}
                  </Badge>
                </p>
                {held.lock.scope === "type" ? (
                  <p className="text-xs text-zinc-500">
                    {t("bookWork.lock.byType", {
                      type: held.lock.itemType ?? "",
                    })}
                  </p>
                ) : null}
                {held.canRelease ? (
                  <form action={unlockBookingAction}>
                    <input type="hidden" name="lockId" value={held.lock.id} />
                    <input type="hidden" name="from" value={lot.id} />
                    <SubmitButton variant="secondary" data-booking-unlock>
                      {t(
                        held.lock.scope === "type"
                          ? "bookWork.unlock.type"
                          : "bookWork.unlock",
                      )}
                    </SubmitButton>
                  </form>
                ) : (
                  // Quem travou não libera: só o gestor, ou sozinha quando
                  // o book inteiro fica trabalhado.
                  <p className="text-xs text-zinc-500" data-booking-no-unlock>
                    {t("bookWork.unlock.rule")}
                  </p>
                )}
              </div>
            ) : bookingLotLockable(lot.status) ? (
              <form
                action={lockBookingLotAction}
                className="space-y-2"
                data-booking-lot-free
              >
                <p className="text-sm text-zinc-600">
                  {t("bookWork.lock.body", { h: settings.bookingLockSlaHours })}
                </p>
                <input type="hidden" name="lotId" value={lot.id} />
                <input type="hidden" name="from" value={lot.id} />
                <SubmitButton variant="secondary" data-booking-lock>
                  {t("bookWork.lock")}
                </SubmitButton>
              </form>
            ) : (
              // Rascunho (ou cancelado): ainda não é trabalhado na seleção.
              <p className="text-sm text-zinc-600" data-booking-lot-no-lock>
                {t("bookWork.lock.afterDraft")}
              </p>
            )}
          </Card>
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
                      // O nº da loja digitado na importação é o da Fábrica.
                      defaultValue={lot.storeNumber ?? hint.store ?? ""}
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
                <SubmitButton
                  pendingText={t("bookingLots.detail.close.pending")}
                  data-booking-lot-close-submit
                >
                  {t("bookingLots.detail.close.submit")}
                </SubmitButton>
              </form>
            </Card>
          ) : null}

          {seesPrice && lot.status !== "draft" && lot.status !== "cancelled" ? (
            <Card title={t("bookingForecast.title")} dense>
              {lot.analyzedAt ? (
                <p className="mb-2 text-sm text-zinc-600">
                  {t("bookingForecast.lot.at", {
                    date: formatDate(lot.analyzedAt, t),
                  })}
                </p>
              ) : null}
              {/* Sem botão de refazer (dono, 24/11/2026): o job diário
                  completa os itens que ficaram sem a previsão. */}
              <p
                className="text-xs text-zinc-500"
                data-booking-lot-forecast-auto
              >
                {t("bookingForecast.lot.auto")}
              </p>
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
        <Card
          title={`${t("bookingLots.detail.itemsTitle", { n: items.length })} · ${t(
            "bookWork.worked.share",
            { worked: worked.worked, total: worked.total, pct: worked.pct },
          )}`}
        >
          <p className="mb-2 text-xs text-zinc-500">
            {editable
              ? t("bookingLots.detail.itemsHint")
              : t("bookingLots.detail.itemsLocked", {
                  status: statusLabel(lot.status).toLowerCase(),
                }) + (ncmEditable ? ` ${t("bookingNcm.closedHint")}` : "")}
            {bulkOn && items.length ? (
              <span className="block" data-bulk-hint>
                {t("bookingLots.bulk.hint")}
              </span>
            ) : null}
          </p>
          {items.length ? (
            bulkOn ? (
              <BookingBulkProvider
                lotId={lot.id}
                mode="wellmix"
                itemIds={items.map((i) => i.id)}
                rowLabels={Object.fromEntries(
                  items.map((i) => [i.id, String(i.position + 1)]),
                )}
                fieldLabels={{
                  ncm: t("bookingNcm.col"),
                  ...Object.fromEntries(
                    columns.map((c) => [c.field, colLabel(c.field)]),
                  ),
                }}
                labels={bulkFillLabels(t)}
              >
                {/* Seleção direto do book (dono, 23/11/2026): os itens
                    marcados vão para a Seleção de itens como um grupo, ou
                    são recusados (ficam trabalhados; 24/11/2026). Só com o
                    book fora do rascunho: antes disso ele ainda não é
                    trabalhado. */}
                {bookingLotLockable(lot.status) ? (
                  <div
                    className="mb-2 flex flex-wrap items-center gap-2"
                    data-booking-to-selection
                  >
                    <BulkSelectionLink max={GROUP_MAX} />
                    <BulkRefuseButton />
                    <span className="text-xs text-zinc-500">
                      {t("bookWork.toSelection.hint")}
                    </span>
                  </div>
                ) : null}
                {itemsTable}
              </BookingBulkProvider>
            ) : (
              itemsTable
            )
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
