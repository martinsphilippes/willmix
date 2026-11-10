import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import {
  BOOKING_COLUMNS,
  BOOKING_EMPTY,
  BOOKING_FLOW,
  BOOKING_BULK_MAX,
  BOOKING_PAGE_SIZE,
  BOOKING_REQUEST_MAX,
  BOOKING_SIGNALS,
  activeBookingFilters,
  bookingColumnsFor,
  bookingQuery,
  bookingSignal,
  filterBookingRows,
  pageOfBookingRows,
  parseBookingFilters,
  sortBookingRows,
  type BookingColumn,
  type BookingColumnKey,
  type BookingFilters,
  type BookingRow,
  type BookingSignal,
} from "@/lib/booking";
import { SHEET_CURRENCIES, type BookingStatus } from "@/lib/db/schema";
import {
  BOOKING_STOCK_OPTION,
  listBookingRows,
  type BookingOption,
} from "@/lib/services/booking";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import {
  Alert,
  Badge,
  Button,
  Empty,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Stat,
  TextLink,
  cx,
  formatDate,
  formatMoney,
  inputDenseClass,
  linkClass,
  rowClass,
  type Tone,
} from "@/components/ui";
import { FormDraftGuard } from "@/components/form-draft-guard";
import { SelectAllCheckbox } from "@/components/select-all-checkbox";
import { SubmitButton } from "@/components/submit-button";
import {
  bulkBookingAction,
  saveBookingProductsAction,
} from "../actions/booking";
import { BookingEnhancer, BulkButton } from "./_components/booking-client";

/*
 * Booking (Pedidos → Booking; docs/BOOKING.md): os produtos que chegaram pela
 * ficha técnica, antes de virar solicitação. Uma linha por produto, com tudo
 * o que veio da planilha; toda coluna filtra e ordena, e o filtro mora no
 * endereço. Em cima: cartões das etapas (tocar filtra) e a barra de ações
 * para as linhas marcadas (mover, cliente e quantidades, responsável,
 * analisar no Superplan, gerar solicitação).
 */

const FILTER_FORM = "booking-filter";
const BULK_FORM = "booking-bulk";
/** Barra de ações: grupo (rótulo + lista + botão) e botão pequeno. */
const BULK_GROUP =
  "flex flex-col gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50/70 px-1.5 py-1";
const BULK_LABEL =
  "px-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const BULK_BUTTON = "h-7 px-2.5 py-0! text-xs! whitespace-nowrap";
/** "Editar dados": os campos das células pertencem a este formulário. */
const DATA_FORM = "booking-data";
const BASE = "/app/booking";

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

/**
 * Ordem das colunas na tela: o produto primeiro (fica fixo ao rolar), depois
 * o que se mexe no dia a dia (etapa, cliente, reserva, Superplan) e então os
 * dados da ficha. Coluna nova em BOOKING_COLUMNS entra no fim sozinha.
 */
const FIRST: BookingColumnKey[] = [
  "name",
  "status",
  "customer",
  "reservedQty",
  "cost",
  "salePrice",
  "targetPrice",
  "signal",
];
const ORDER: BookingColumnKey[] = [
  ...FIRST,
  ...BOOKING_COLUMNS.map((c) => c.key).filter((k) => !FIRST.includes(k)),
];

const thBase =
  "border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 text-left align-bottom text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
const tdBase =
  "border-b border-zinc-100 px-2 py-1.5 align-top text-[13px] text-zinc-800";
/** A coluna do produto fica parada ao rolar para o lado (do tablet para cima). */
const stickyCell = "sm:sticky sm:left-0 sm:z-10 sm:border-r sm:border-zinc-200";

export default async function BookingPage({
  searchParams,
}: PageProps<"/app/booking">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/booking");
  requireScreen(user, "booking");
  const t = await getT();
  const query = await searchParams;
  const data = await listBookingRows(user, { intl: t.intl });
  const superplan = data.canApprove;
  const canRequest = canOpen(user, "requests");
  const filters = parseBookingFilters(query, { superplan });
  const columns = bookingColumnsFor(superplan);
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const shown = ORDER.map((k) => byKey.get(k)).filter(
    (c): c is BookingColumn => !!c,
  );

  const label = (key: string) => t(`booking.col.${key}` as DictionaryKey);
  const statusLabel = (s: string) => t(`booking.status.${s}` as DictionaryKey);
  const signalLabel = (s: string) => t(`booking.signal.${s}` as DictionaryKey);
  const names = (list: BookingOption[]) =>
    new Map(list.map((o) => [o.id, o.label]));
  const optionNames: Partial<Record<BookingColumnKey, Map<string, string>>> = {
    supplier: names(data.options.suppliers),
    customer: names(data.options.customers),
    owner: names(data.options.owners),
    source: names(data.options.sources),
  };
  const optionLabel = (key: BookingColumnKey, id: string) =>
    key === "status"
      ? statusLabel(id)
      : key === "signal"
        ? signalLabel(id)
        : (optionNames[key]?.get(id) ?? id);
  /** Texto da linha para a busca geral: colunas de texto e nomes das opções. */
  const searchText = (row: BookingRow) =>
    columns
      .map((c) => {
        const value = c.value(row);
        if (value === null || value === "") return "";
        return c.kind === "option"
          ? optionLabel(c.key as BookingColumnKey, String(value))
          : c.kind === "text"
            ? String(value)
            : "";
      })
      .join(" ");

  const filtered = sortBookingRows(
    filterBookingRows(data.rows, filters, { superplan, searchText }),
    filters.sort,
    { superplan, optionLabel },
  );
  const page = pageOfBookingRows(filtered, filters.page);
  // Contagem dos cartões: os outros filtros valem; o da etapa, não.
  const withoutStatus: BookingFilters = {
    ...filters,
    options: { ...filters.options, status: undefined },
  };
  const forCards = filterBookingRows(data.rows, withoutStatus, {
    superplan,
    searchText,
  });
  const countOf = (s: BookingStatus) =>
    forCards.filter((r) => r.status === s).length;
  const activeStatus = filters.options.status ?? [];
  const active = activeBookingFilters(filters);
  // "Editar dados" (quem também abre Produtos): as células viram campos. O
  // modo mora no endereço e acompanha filtros, ordem e páginas.
  const canEdit = canOpen(user, "products");
  const editing = canEdit && query.edit === "1";
  const q = (opts?: Parameters<typeof bookingQuery>[1]) => {
    const base = bookingQuery(filters, opts);
    return editing ? (base ? `${base}&edit=1` : "?edit=1") : base;
  };
  const back = `${BASE}${q()}`;

  const intl = t.intl;
  const number = (n: number | null, digits = 0) =>
    n === null
      ? "—"
      : n.toLocaleString(intl, {
          minimumFractionDigits: 0,
          maximumFractionDigits: digits,
        });
  const decimal = intl.startsWith("pt") ? "," : ".";
  const typed = (n: number | undefined) =>
    n === undefined ? "" : String(n).replace(".", decimal);

  /* Avisos da última ação. */
  const one = (key: string) => {
    const v = query[key];
    return typeof v === "string" ? v : "";
  };
  const errorCode = one("error");
  const errorText = !errorCode
    ? null
    : ([`booking.error.${errorCode}`, `common.${errorCode}`]
        .map(
          (k) =>
            [
              k,
              // Os textos de "linhas demais" dizem o limite de cada ação.
              t(k as DictionaryKey, {
                max:
                  errorCode === "booking_request_too_many"
                    ? BOOKING_REQUEST_MAX
                    : BOOKING_BULK_MAX,
              }),
            ] as const,
        )
        .find(([k, v]) => v !== k)?.[1] ?? fallbackError(t, errorCode));
  const errorRowId = one("row");
  // O envio que esta recusa responde (só o rascunho dele volta).
  const answeredDraft = /^[a-z0-9]{1,32}$/.test(one("draft"))
    ? one("draft")
    : "";
  const errorRow = errorRowId
    ? data.rows.find((r) => r.id === errorRowId)
    : undefined;
  const done = (
    [
      ["moved", "booking.done.moved"],
      ["saved", "booking.done.saved"],
      ["owners", "booking.done.owners"],
      ["analyzed", "booking.done.analyzed"],
      ["edited", "booking.done.edited"],
    ] as const
  )
    .map(([param, key]) => {
      const raw = one(param);
      if (!/^\d{1,4}$/.test(raw)) return null;
      const n = Number(raw);
      return n > 0 ? t(key, { n }) : t("booking.done.none");
    })
    .filter((v): v is string => !!v);
  const count = (param: string) =>
    /^\d{1,4}$/.test(one(param)) ? Number(one(param)) : 0;
  const skipped = count("skipped");
  const kept = count("kept");
  const noRates = count("norates");

  /*
   * Filtros ligados, um por etiqueta, com o "tirar" de cada um: o filtro de
   * uma coluna que está fora da tela (rolagem) nunca fica escondido.
   */
  const day = (iso: string) => formatDate(`${iso}T12:00:00Z`, t);
  const range = (from: string | undefined, to: string | undefined) =>
    [
      from !== undefined ? `${t("booking.filter.min")} ${from}` : null,
      to !== undefined ? `${t("booking.filter.max")} ${to}` : null,
    ]
      .filter(Boolean)
      .join(" ");
  const chips: Array<{ key: BookingColumnKey | "q"; text: string }> = [
    ...(filters.q
      ? [
          {
            key: "q" as const,
            text: `${t("booking.filter.search")}: ${filters.q}`,
          },
        ]
      : []),
    ...shown.flatMap((c) => {
      const key = c.key as BookingColumnKey;
      const value =
        c.kind === "text"
          ? filters.text[key]
          : c.kind === "option"
            ? filters.options[key]
                ?.map((id) =>
                  id === BOOKING_EMPTY
                    ? t("booking.filter.empty")
                    : optionLabel(key, id),
                )
                .join(", ")
            : c.kind === "number"
              ? filters.numbers[key]
                ? range(
                    filters.numbers[key]?.min !== undefined
                      ? typed(filters.numbers[key]?.min)
                      : undefined,
                    filters.numbers[key]?.max !== undefined
                      ? typed(filters.numbers[key]?.max)
                      : undefined,
                  )
                : undefined
              : filters.dates[key]
                ? range(
                    filters.dates[key]?.from
                      ? day(filters.dates[key]!.from!)
                      : undefined,
                    filters.dates[key]?.to
                      ? day(filters.dates[key]!.to!)
                      : undefined,
                  )
                : undefined;
      return value ? [{ key, text: `${label(key)}: ${value}` }] : [];
    }),
  ];

  const sortHref = (key: BookingColumnKey) => {
    const current = filters.sort?.key === key ? filters.sort.dir : null;
    const next =
      current === null
        ? ({ key, dir: "asc" } as const)
        : current === "asc"
          ? ({ key, dir: "desc" } as const)
          : null;
    return `${BASE}${q({ sort: next })}`;
  };

  const optionsOf = (key: BookingColumnKey): BookingOption[] =>
    key === "status"
      ? [...BOOKING_FLOW, "discarded" as const].map((s) => ({
          id: s,
          label: statusLabel(s),
        }))
      : key === "signal"
        ? BOOKING_SIGNALS.map((s) => ({ id: s, label: signalLabel(s) }))
        : key === "currency"
          ? data.options.currencies.map((c) => ({ id: c, label: c }))
          : key === "supplier"
            ? data.options.suppliers
            : key === "customer"
              ? data.options.customers
              : key === "owner"
                ? data.options.owners
                : data.options.sources;

  /** O filtro da coluna (segunda linha do cabeçalho); pertence ao formulário de filtros. */
  const filterControl = (c: BookingColumn): ReactNode => {
    const key = c.key as BookingColumnKey;
    const aria = t("booking.filter.of", { col: label(key) });
    if (c.kind === "text")
      return (
        <input
          // A chave refaz o campo quando o filtro muda pelo endereço (cartão,
          // "limpar", ordenar): o campo nunca mostra um filtro que já saiu.
          key={filters.text[key] ?? ""}
          form={FILTER_FORM}
          name={key}
          defaultValue={filters.text[key] ?? ""}
          placeholder={t("booking.filter.contains")}
          aria-label={aria}
          className={cx(inputDenseClass, "min-w-24")}
        />
      );
    if (c.kind === "number")
      return (
        <span className="flex gap-1">
          <input
            key={`min:${typed(filters.numbers[key]?.min)}`}
            form={FILTER_FORM}
            name={`${key}_min`}
            defaultValue={typed(filters.numbers[key]?.min)}
            placeholder={t("booking.filter.min")}
            aria-label={`${aria}: ${t("booking.filter.min")}`}
            inputMode="decimal"
            className={cx(inputDenseClass, "w-14 min-w-14 px-1.5")}
          />
          <input
            key={`max:${typed(filters.numbers[key]?.max)}`}
            form={FILTER_FORM}
            name={`${key}_max`}
            defaultValue={typed(filters.numbers[key]?.max)}
            placeholder={t("booking.filter.max")}
            aria-label={`${aria}: ${t("booking.filter.max")}`}
            inputMode="decimal"
            className={cx(inputDenseClass, "w-14 min-w-14 px-1.5")}
          />
        </span>
      );
    if (c.kind === "date")
      return (
        <span className="flex gap-1">
          <input
            key={`from:${filters.dates[key]?.from ?? ""}`}
            form={FILTER_FORM}
            type="date"
            name={`${key}_from`}
            defaultValue={filters.dates[key]?.from ?? ""}
            aria-label={`${aria}: ${t("booking.filter.min")}`}
            className={cx(inputDenseClass, "w-32 min-w-32 px-1.5")}
          />
          <input
            key={`to:${filters.dates[key]?.to ?? ""}`}
            form={FILTER_FORM}
            type="date"
            name={`${key}_to`}
            defaultValue={filters.dates[key]?.to ?? ""}
            aria-label={`${aria}: ${t("booking.filter.max")}`}
            className={cx(inputDenseClass, "w-32 min-w-32 px-1.5")}
          />
        </span>
      );
    const chosen = filters.options[key] ?? [];
    // Mais de uma opção (o "Ver no Booking" de uma importação, ou o endereço
    // com várias): o seletor leva todas, para refinar a lista sem perdê-las.
    const current = chosen.join(",");
    const list = optionsOf(key);
    return (
      <select
        key={current}
        form={FILTER_FORM}
        name={key}
        defaultValue={current}
        aria-label={aria}
        className={cx(inputDenseClass, "min-w-28 max-w-44")}
      >
        <option value="">{t("booking.filter.all")}</option>
        {chosen.length > 1 ? (
          <option value={current}>
            {chosen
              .map((id) =>
                id === BOOKING_EMPTY
                  ? t("booking.filter.empty")
                  : optionLabel(key, id),
              )
              .join(", ")}
          </option>
        ) : null}
        {list.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
        {key !== "status" && key !== "signal" ? (
          <option value={BOOKING_EMPTY}>{t("booking.filter.empty")}</option>
        ) : null}
      </select>
    );
  };

  const muted = <span className="text-zinc-400">—</span>;
  const textCell = (value: string | null, width = "max-w-44") =>
    value ? (
      <span className={cx("block truncate", width)} title={value}>
        {value}
      </span>
    ) : (
      muted
    );

  /** O número de uma coluna numérica da linha. */
  const numberOf = (row: BookingRow, key: BookingColumnKey) => {
    const v = byKey.get(key)?.value(row);
    return typeof v === "number" ? v : null;
  };
  /** Número como a pessoa digita (vírgula no português). */
  const raw = (n: number | null) =>
    n === null ? "" : String(n).replace(".", decimal);
  /** Campo de "Editar dados" (formulário DATA_FORM; nome d.<produto>.<campo>). */
  const editBox = (
    row: BookingRow,
    field: string,
    value: string,
    opts: { width?: string; numeric?: boolean; type?: string; what: string },
  ) => (
    <input
      form={DATA_FORM}
      name={`d.${row.productId}.${field}`}
      defaultValue={value}
      type={opts.type ?? "text"}
      inputMode={opts.numeric ? "decimal" : undefined}
      autoComplete="off"
      aria-label={t("booking.edit.field", {
        field: opts.what,
        name: row.name || row.productId,
      })}
      data-booking-edit=""
      className={cx(
        inputDenseClass,
        opts.width ?? "w-24",
        opts.numeric && "text-right",
      )}
    />
  );
  /** Editor da célula no modo "Editar dados" (nulo: a célula é só leitura). */
  const editor = (row: BookingRow, key: BookingColumnKey): ReactNode => {
    const num = (field: string) =>
      editBox(row, field, raw(numberOf(row, key)), {
        numeric: true,
        what: label(key),
      });
    switch (key) {
      case "code":
        return editBox(row, "factoryItemCode", row.code ?? "", {
          width: "w-32",
          what: label(key),
        });
      case "supplier": {
        const list = data.options.allSuppliers;
        const current = row.supplierId ?? "";
        return (
          <select
            form={DATA_FORM}
            name={`d.${row.productId}.supplierId`}
            defaultValue={current}
            aria-label={t("booking.edit.field", {
              field: label(key),
              name: row.name || row.productId,
            })}
            data-booking-edit=""
            className={cx(inputDenseClass, "w-44")}
          >
            {current ? null : <option value="">—</option>}
            {current && !list.some((o) => o.id === current) ? (
              <option value={current}>{row.supplierName ?? current}</option>
            ) : null}
            {list.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        );
      }
      case "location":
        return (
          <span className="flex gap-1">
            {editBox(row, "location", row.location ?? "", {
              width: "w-28",
              what: t("booking.edit.location"),
            })}
            {editBox(row, "supplierStore", row.supplierStore ?? "", {
              width: "w-24",
              what: t("booking.edit.store"),
            })}
          </span>
        );
      case "sheetDate":
        return editBox(row, "sheetDate", row.sheetDate?.slice(0, 10) ?? "", {
          type: "date",
          width: "w-36",
          what: label(key),
        });
      case "price":
        return num("price");
      case "currency": {
        const current = row.currency ?? "";
        const known = (SHEET_CURRENCIES as readonly string[]).includes(current);
        return (
          <select
            form={DATA_FORM}
            name={`d.${row.productId}.currency`}
            defaultValue={current}
            aria-label={t("booking.edit.field", {
              field: label(key),
              name: row.name || row.productId,
            })}
            data-booking-edit=""
            className={cx(inputDenseClass, "w-24")}
          >
            <option value="">—</option>
            {current && !known ? (
              <option value={current}>{current}</option>
            ) : null}
            {SHEET_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        );
      }
      case "moq":
        return num("moq");
      case "masterQty":
        return num("masterCartonQty");
      case "innerQty":
        return num("innerQty");
      case "netWeight":
        return num("netWeightPcKg");
      case "grossWeight":
        return num("grossWeightPcKg");
      case "averageWeight":
        return num("averageWeightPcKg");
      case "plannedQty":
      case "forecastOrder":
      case "forecastDistribution":
      case "forecastEcommerce":
        return num(key);
      case "average":
        return num("averagePrice");
      case "cbm":
        return num("cbmPerCarton");
      case "size":
        return (
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            {editBox(row, "pieceLengthCm", raw(row.pieceLengthCm), {
              numeric: true,
              width: "w-16",
              what: t("booking.edit.length"),
            })}
            ×
            {editBox(row, "pieceWidthCm", raw(row.pieceWidthCm), {
              numeric: true,
              width: "w-16",
              what: t("booking.edit.width"),
            })}
            ×
            {editBox(row, "pieceHeightCm", raw(row.pieceHeightCm), {
              numeric: true,
              width: "w-16",
              what: t("booking.edit.height"),
            })}
            cm
          </span>
        );
      case "colors":
        return editBox(row, "colorAssortment", row.colors ?? "", {
          width: "w-48",
          what: label(key),
        });
      case "material":
        return editBox(row, "material", row.material ?? "", {
          width: "w-40",
          what: label(key),
        });
      case "packageType":
        return editBox(row, "packageType", row.packageType ?? "", {
          width: "w-40",
          what: label(key),
        });
      default:
        return null;
    }
  };

  /** O conteúdo de uma célula. */
  const cell = (row: BookingRow, key: BookingColumnKey): ReactNode => {
    if (editing && row.name && key !== "name") {
      const box = editor(row, key);
      if (box) return box;
    }
    switch (key) {
      case "name": {
        const name = row.name || t("booking.productMissing");
        return (
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              name="ids"
              value={row.id}
              form={BULK_FORM}
              aria-label={t("booking.bulk.selectRow", { name })}
              className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
            />
            {row.photoDocumentId ? (
              <a
                href={`/api/files/${row.photoDocumentId}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                <img
                  src={`/api/files/${row.photoDocumentId}`}
                  alt=""
                  loading="lazy"
                  className="h-9 w-9 rounded-md border border-zinc-200 object-cover"
                />
              </a>
            ) : (
              <span
                aria-hidden
                className="h-9 w-9 shrink-0 rounded-md border border-dashed border-zinc-200 bg-zinc-50"
              />
            )}
            <div className="min-w-0">
              {editing && row.name ? (
                editBox(row, "name", row.name, {
                  width: "w-52",
                  what: label("name"),
                })
              ) : (
                <Link
                  href={`${BASE}/${row.id}`}
                  className={cx(linkClass, "block max-w-52 truncate")}
                  title={name}
                >
                  {name}
                </Link>
              )}
              <span className="block max-w-52 truncate text-xs text-zinc-500">
                {[
                  row.sku,
                  row.sourceRows
                    ? t("booking.row.rows", { rows: row.sourceRows })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {row.productMissing && row.name ? (
                  <span className="ml-1 font-semibold text-red-700">
                    {t("booking.productMissing")}
                  </span>
                ) : null}
              </span>
            </div>
          </div>
        );
      }
      case "status":
        return (
          <Badge tone={STATUS_TONE[row.status]}>
            {statusLabel(row.status)}
          </Badge>
        );
      case "code":
        return row.code ? (
          <span className="font-mono text-xs">{row.code}</span>
        ) : (
          muted
        );
      case "supplier":
        return textCell(row.supplierName);
      case "location":
        return textCell(
          [row.location, row.supplierStore].filter(Boolean).join(" · ") || null,
        );
      case "sheetDate":
        return row.sheetDate ? formatDate(row.sheetDate, t) : muted;
      case "price":
        return number(row.price, 4);
      case "currency":
        return row.currency ?? muted;
      case "moq":
        return number(row.moq);
      case "masterQty":
        return number(row.masterQty);
      case "innerQty":
        return number(row.innerQty);
      case "netWeight":
        return number(row.netWeightKg, 4);
      case "grossWeight":
        return number(row.grossWeightKg, 4);
      case "estimatedWeight":
        return row.estimatedWeightKg === null ? (
          muted
        ) : row.weightEstimated ? (
          <span
            className="text-amber-800"
            title={t("booking.row.estimated", { pct: data.allowancePct })}
            data-booking-estimated=""
          >
            ≈ {number(row.estimatedWeightKg, 4)}
          </span>
        ) : (
          number(row.estimatedWeightKg, 4)
        );
      case "averageWeight":
        return number(row.averageWeightKg, 4);
      case "average":
        return number(row.averageUsd, 4);
      case "cbm":
        return number(row.cbm, 4);
      case "size":
        return textCell(row.size, "max-w-40");
      case "colors":
        return textCell(row.colors, "max-w-48");
      case "material":
        return textCell(row.material, "max-w-40");
      case "packageType":
        return textCell(row.packageType, "max-w-40");
      case "plannedQty":
        return number(row.plannedQty);
      case "forecastOrder":
        return number(row.forecastOrder);
      case "forecastDistribution":
        return number(row.forecastDistribution);
      case "forecastEcommerce":
        return number(row.forecastEcommerce);
      case "forecastTotal":
        return number(row.forecastTotal);
      case "customer":
        return textCell(row.customerName, "max-w-40");
      case "reservedQty": {
        if (row.status === "requested" || row.status === "discarded")
          return number(row.reservedQty);
        return (
          <input
            form={BULK_FORM}
            name={`qty_${row.id}`}
            defaultValue={row.reservedQty ?? ""}
            inputMode="numeric"
            autoComplete="off"
            placeholder={
              row.moq ? t("booking.row.qtyMin", { moq: number(row.moq) }) : ""
            }
            aria-label={t("booking.row.qty", {
              name: row.name || row.productId,
            })}
            data-booking-qty={row.id}
            className={cx(inputDenseClass, "w-24 min-w-24 text-right")}
          />
        );
      }
      case "cost":
        return row.analysis?.costBrl == null ? (
          muted
        ) : (
          <span className="whitespace-nowrap">
            {formatMoney(row.analysis.costBrl, "BRL", t)}
            {row.analysis.inputs && !row.analysis.inputs.ncmFound ? (
              <span
                className="ml-1 rounded bg-amber-50 px-1 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200"
                title={t("booking.row.noRatesHint")}
                data-booking-norates=""
              >
                {t("booking.row.noRates")}
              </span>
            ) : null}
          </span>
        );
      case "targetPrice":
        return row.analysis?.targetPriceBrl == null ? (
          muted
        ) : (
          <span className="whitespace-nowrap">
            {formatMoney(row.analysis.targetPriceBrl, "BRL", t)}
          </span>
        );
      case "salePrice": {
        const a = row.analysis;
        if (!a || a.salePriceBrl === null) return muted;
        return (
          <span className="whitespace-nowrap">
            {formatMoney(a.salePriceBrl, "BRL", t)}
            {a.usesMinimum ? (
              <span className="ml-1 text-[11px] text-zinc-500">
                {t("booking.row.minimum")}
              </span>
            ) : null}
          </span>
        );
      }
      case "signal": {
        const signal = bookingSignal(row.analysis);
        if (signal === "none") return muted;
        const a = row.analysis;
        return (
          <span
            className="flex flex-col items-start gap-0.5"
            title={
              a
                ? t("booking.row.analysisAt", { date: formatDate(a.at, t) })
                : ""
            }
          >
            <Badge tone={SIGNAL_TONE[signal]}>{signalLabel(signal)}</Badge>
            {a && a.profitPct !== null ? (
              <span className="whitespace-nowrap text-[11px] text-zinc-500">
                {number(a.profitPct, 1)}% / {number(a.targetPct, 1)}%
              </span>
            ) : null}
          </span>
        );
      }
      case "owner":
        return textCell(row.ownerName, "max-w-36");
      case "enteredAt":
        return formatDate(row.enteredAt, t);
      case "source":
        return textCell(row.sourceFileName, "max-w-44");
      case "note":
        return textCell(row.note, "max-w-56");
      case "request": {
        if (!row.requestId)
          return row.requestState ? (
            <span className="whitespace-nowrap text-xs text-amber-800">
              {t(
                row.requestState === "pending"
                  ? "booking.row.requestPending"
                  : "booking.row.requestMissing",
              )}
            </span>
          ) : (
            muted
          );
        const href = row.requestGroupId
          ? `/app/requests/batch/${encodeURIComponent(row.requestGroupId)}`
          : `/app/requests/${row.requestId}`;
        return canRequest ? (
          <TextLink href={href} className="whitespace-nowrap">
            {row.requestNumber
              ? t("booking.row.request", { n: row.requestNumber })
              : t("booking.row.requestOpen")}
          </TextLink>
        ) : (
          <span className="whitespace-nowrap">
            {row.requestNumber ? `#${row.requestNumber}` : "✓"}
          </span>
        );
      }
      default:
        return muted;
    }
  };

  const numeric = (c: BookingColumn) =>
    c.kind === "number" && c.key !== "reservedQty" && c.key !== "request";

  return (
    <>
      <PageHeader
        t={t}
        title={t("booking.title")}
        subtitle={t("booking.subtitle")}
        help={{ body: "booking.help.body", steps: "booking.help.steps" }}
        actions={
          canOpen(user, "products") ? (
            <LinkButton href="/app/products/import" variant="secondary">
              {t("booking.import")}
            </LinkButton>
          ) : null
        }
      />

      <div className="mb-3 space-y-2" data-booking-notices>
        {data.schemaMissing ? (
          <Alert tone="warning">{t("booking.schemaMissing")}</Alert>
        ) : null}
        {errorText ? (
          <Alert tone="danger">
            {errorText}
            {errorRow ? (
              <span className="mt-1 block font-semibold">
                {t("booking.row.error", {
                  name: errorRow.name || t("booking.productMissing"),
                })}
              </span>
            ) : null}
          </Alert>
        ) : null}
        {done.map((text) => (
          <Alert key={text} tone="success">
            {text}
          </Alert>
        ))}
        {skipped ? (
          <Alert tone="warning">
            {t("booking.done.skipped", { n: skipped })}
          </Alert>
        ) : null}
        {kept ? (
          <Alert tone="info">{t("booking.done.kept", { n: kept })}</Alert>
        ) : null}
        {noRates ? (
          <Alert tone="warning">
            {t("booking.done.norates", { n: noRates })}
          </Alert>
        ) : null}
      </div>

      {/* Cartões das etapas: tocar filtra; tocar de novo tira o filtro. */}
      <div
        className="mb-1 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8"
        data-booking-cards
      >
        <Stat
          compact
          label={t("booking.cards.all")}
          value={forCards.length}
          href={`${BASE}${q({ option: { key: "status", values: [] } })}`}
          active={activeStatus.length === 0}
        />
        {[...BOOKING_FLOW, "discarded" as const].map((s) => {
          const on = activeStatus.length === 1 && activeStatus[0] === s;
          return (
            <Stat
              key={s}
              compact
              label={statusLabel(s)}
              value={countOf(s)}
              href={`${BASE}${q({
                option: { key: "status", values: on ? [] : [s] },
              })}`}
              active={on}
            />
          );
        })}
      </div>
      <p className="mb-3 text-xs text-zinc-500">
        {t("booking.cards.hiddenHint")}
      </p>

      {/* Filtros (GET): a busca geral aqui; o filtro de cada coluna fica no
          cabeçalho da tabela e pertence a este formulário. */}
      <form
        id={FILTER_FORM}
        method="get"
        action={BASE}
        className="mb-2 flex flex-wrap items-center gap-2"
        data-booking-filter
      >
        {editing ? <input type="hidden" name="edit" value="1" /> : null}
        {filters.sort ? (
          <>
            <input type="hidden" name="sort" value={filters.sort.key} />
            {filters.sort.dir === "desc" ? (
              <input type="hidden" name="dir" value="desc" />
            ) : null}
          </>
        ) : null}
        <Input
          key={filters.q}
          name="q"
          defaultValue={filters.q}
          placeholder={t("booking.search.placeholder")}
          aria-label={t("booking.search.placeholder")}
          className="w-full max-w-md"
        />
        <Button type="submit" variant="primary">
          {t("booking.filter.apply")}
        </Button>
        {active ? (
          <TextLink href={BASE} data-booking-clear="">
            {t("booking.filter.clear", { n: active })}
          </TextLink>
        ) : null}
        <span className="ml-auto text-xs text-zinc-500" data-booking-count>
          {page.total
            ? t("booking.count", {
                from: (page.page - 1) * BOOKING_PAGE_SIZE + 1,
                to: (page.page - 1) * BOOKING_PAGE_SIZE + page.rows.length,
                total: page.total,
              })
            : null}
          {page.total !== data.rows.length
            ? ` ${t("booking.count.filtered", { all: data.rows.length })}`
            : null}
        </span>
      </form>

      {chips.length ? (
        <div
          className="mb-2 flex flex-wrap items-center gap-1.5"
          data-booking-chips
        >
          {chips.map((chip) => (
            <Link
              key={chip.key}
              href={`${BASE}${q({ drop: chip.key })}`}
              scroll={false}
              title={t("booking.filter.remove")}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800 transition hover:border-brand-400 hover:bg-brand-100"
            >
              <span className="truncate">{chip.text}</span>
              <span aria-hidden className="text-brand-600">
                ✕
              </span>
              <span className="sr-only">{t("booking.filter.remove")}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {/* Recusa (tudo ou nada) ou falha: o que estava digitado e marcado
          volta, em vez de a pessoa refazer 25 linhas. Ação concluída ou
          simples troca de filtro: o rascunho é apagado. */}
      <FormDraftGuard
        formId={BULK_FORM}
        storageKey="booking-bulk"
        userId={user.id}
        failed={!!errorCode}
        saved={!errorCode}
        token={`${errorCode}:${errorRowId}:${answeredDraft}`}
        answers={answeredDraft || null}
        message={t("booking.draftRestored")}
        discardLabel={t("booking.draftDiscard")}
      />

      {/* Ações nas linhas marcadas: as caixas e as quantidades da tabela
          pertencem a este formulário. */}
      <form
        id={BULK_FORM}
        action={bulkBookingAction}
        className="mb-2 rounded-xl border border-zinc-200/80 bg-white p-2.5 shadow-sm"
        data-booking-bulk
      >
        <input type="hidden" name="back" value={back} />
        {/* Id do envio: a tela o preenche a cada envio e a recusa o devolve
            no endereço (só o rascunho daquele envio volta). */}
        <input type="hidden" name="draftId" defaultValue="" />
        {/* Três grupos (cliente, etapa, responsável), cada um com a sua
            lista e o seu botão; à direita, as duas ações que fecham o
            trabalho. Botões pequenos, todos do mesmo tamanho. */}
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          {t("booking.bulk.title")}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className={BULK_GROUP} data-bulk-group="customer">
            <span className={BULK_LABEL}>{label("customer")}</span>
            <div className="flex items-center gap-1">
              <Select
                dense
                name="customer"
                defaultValue=""
                aria-label={label("customer")}
                className="h-7! w-auto max-w-44 py-0! text-xs!"
              >
                <option value="">{t("booking.bulk.customer.keep")}</option>
                {data.options.stockOption ? (
                  <option value={BOOKING_STOCK_OPTION}>
                    {t("booking.bulk.stock")}
                  </option>
                ) : null}
                {data.options.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
                <option value={BOOKING_EMPTY}>
                  {t("booking.bulk.customer.none")}
                </option>
              </Select>
              {/* O primeiro botão: é ele que o Enter aciona sem o JavaScript. */}
              <BulkButton
                op="assign"
                variant="secondary"
                className={BULK_BUTTON}
                title={t("booking.bulk.assign")}
                aria-label={t("booking.bulk.assign")}
                pendingText={t("booking.bulk.working")}
              >
                {t("booking.bulk.assign.short")}
              </BulkButton>
            </div>
          </div>
          <div className={BULK_GROUP} data-bulk-group="status">
            <span className={BULK_LABEL}>{label("status")}</span>
            <div className="flex items-center gap-1">
              <Select
                dense
                name="status"
                defaultValue=""
                aria-label={t("booking.bulk.status")}
                className="h-7! w-auto max-w-40 py-0! text-xs!"
              >
                <option value="">{t("booking.bulk.status")}</option>
                {[...BOOKING_FLOW, "discarded" as const]
                  // "Virou solicitação" só nasce do botão "Gerar solicitação".
                  .filter((s) => s !== "requested")
                  .map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
              </Select>
              <BulkButton
                op="move"
                variant="secondary"
                className={BULK_BUTTON}
                pendingText={t("booking.bulk.working")}
                confirmText={t("booking.bulk.move.confirm")}
              >
                {t("booking.bulk.move")}
              </BulkButton>
            </div>
          </div>
          <div className={BULK_GROUP} data-bulk-group="owner">
            <span className={BULK_LABEL}>{label("owner")}</span>
            <div className="flex items-center gap-1">
              <Select
                dense
                name="ownerUserId"
                defaultValue=""
                aria-label={label("owner")}
                className="h-7! w-auto max-w-40 py-0! text-xs!"
              >
                <option value="">{t("booking.bulk.owner.keep")}</option>
                {data.options.owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
                <option value={BOOKING_EMPTY}>
                  {t("booking.bulk.owner.none")}
                </option>
              </Select>
              <BulkButton
                op="owner"
                variant="secondary"
                className={BULK_BUTTON}
                title={t("booking.bulk.setOwner")}
                aria-label={t("booking.bulk.setOwner")}
                pendingText={t("booking.bulk.working")}
              >
                {t("booking.bulk.setOwner.short")}
              </BulkButton>
            </div>
          </div>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            {superplan ? (
              <BulkButton
                op="analyze"
                variant="secondary"
                className={BULK_BUTTON}
                pendingText={t("booking.bulk.working")}
                data-booking-analyze=""
              >
                {t("booking.bulk.analyze")}
              </BulkButton>
            ) : null}
            {canRequest ? (
              <BulkButton
                op="request"
                variant="primary"
                className={BULK_BUTTON}
                pendingText={t("booking.bulk.working")}
                confirmText={t("booking.bulk.request.confirm", {
                  max: BOOKING_REQUEST_MAX,
                })}
                data-booking-request=""
              >
                {t("booking.bulk.request")}
              </BulkButton>
            ) : null}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          {t("booking.bulk.hint", { max: BOOKING_REQUEST_MAX })}
        </p>
      </form>

      {/* "Editar dados dos produtos": as células da tabela viram campos e
          um só "Salvar dados" grava o que mudou (cadastro e ficha mestre). */}
      {canEdit ? (
        <>
          <FormDraftGuard
            formId={DATA_FORM}
            storageKey="booking-data"
            userId={user.id}
            failed={!!errorCode}
            saved={!errorCode}
            token={`${errorCode}:${errorRowId}:${answeredDraft}`}
            answers={answeredDraft || null}
            message={t("booking.draftRestored")}
            discardLabel={t("booking.draftDiscard")}
          />
          <form
            id={DATA_FORM}
            action={saveBookingProductsAction}
            className={cx(
              "mb-2 flex flex-wrap items-center gap-2 rounded-xl border p-2.5 shadow-sm",
              editing
                ? "border-amber-300 bg-amber-50"
                : "border-zinc-200/80 bg-white",
            )}
            data-booking-data
          >
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="draftId" defaultValue="" />
            {editing ? (
              <>
                <SubmitButton
                  pendingText={t("booking.edit.saving")}
                  data-booking-data-save=""
                >
                  {t("booking.edit.save")}
                </SubmitButton>
                <LinkButton
                  href={`${BASE}${bookingQuery(filters)}`}
                  variant="secondary"
                  data-booking-edit-stop=""
                >
                  {t("booking.edit.stop")}
                </LinkButton>
                <p className="min-w-0 flex-1 text-xs text-amber-900">
                  {t("booking.edit.hint")}
                </p>
              </>
            ) : (
              <>
                <LinkButton
                  href={`${BASE}${bookingQuery(filters)}${bookingQuery(filters) ? "&" : "?"}edit=1`}
                  variant="secondary"
                  data-booking-edit-start=""
                >
                  {t("booking.edit.start")}
                </LinkButton>
                <p className="min-w-0 flex-1 text-xs text-zinc-500">
                  {t("booking.edit.startHint")}
                </p>
              </>
            )}
          </form>
        </>
      ) : null}

      <div
        className="relative -mx-4 overflow-x-auto border-y border-zinc-200/80 bg-white sm:mx-0 sm:rounded-xl sm:border"
        data-booking-table
      >
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              {shown.map((c) => {
                const key = c.key as BookingColumnKey;
                const sorted = filters.sort?.key === key ? filters.sort : null;
                return (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={
                      sorted
                        ? sorted.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={cx(
                      thBase,
                      key === "name" && stickyCell,
                      key === "name" && "sm:z-20",
                      numeric(c) && "text-right",
                    )}
                  >
                    <span
                      className={cx(
                        "flex items-center gap-1.5",
                        numeric(c) && "justify-end",
                      )}
                    >
                      {key === "name" ? (
                        <SelectAllCheckbox
                          formId={BULK_FORM}
                          name="ids"
                          label={t("booking.bulk.selectAll")}
                        />
                      ) : null}
                      <Link
                        href={sortHref(key)}
                        scroll={false}
                        title={t("booking.sort.by", { col: label(key) })}
                        className={cx(
                          "whitespace-nowrap hover:text-brand-700",
                          sorted && "text-brand-700",
                        )}
                        data-booking-sort={key}
                      >
                        {label(key)}
                        <span aria-hidden className="ml-0.5">
                          {sorted ? (sorted.dir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </Link>
                    </span>
                  </th>
                );
              })}
              <th scope="col" className={thBase}>
                {label("actions")}
              </th>
            </tr>
            <tr data-booking-filters>
              {shown.map((c) => (
                <th
                  key={c.key}
                  className={cx(
                    "border-b border-zinc-200 bg-zinc-50 px-2 pb-1.5 text-left font-normal normal-case",
                    c.key === "name" && stickyCell,
                    c.key === "name" && "sm:z-20",
                  )}
                >
                  {filterControl(c)}
                </th>
              ))}
              <th className="border-b border-zinc-200 bg-zinc-50" />
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => {
              const flagged = row.id === errorRowId;
              return (
                <tr
                  key={row.id}
                  id={`row-${row.id}`}
                  className={cx(rowClass, "group")}
                  data-booking-row={row.id}
                  data-status={row.status}
                >
                  {shown.map((c) => {
                    const key = c.key as BookingColumnKey;
                    return (
                      <td
                        key={key}
                        className={cx(
                          tdBase,
                          key === "name" && stickyCell,
                          key === "name" &&
                            (flagged ? "bg-red-50" : "bg-white"),
                          key !== "name" && flagged && "bg-red-50",
                          numeric(c) &&
                            "whitespace-nowrap text-right tabular-nums",
                        )}
                        data-col={key}
                      >
                        {cell(row, key)}
                      </td>
                    );
                  })}
                  <td className={cx(tdBase, flagged && "bg-red-50")}>
                    <span className="flex gap-3 whitespace-nowrap">
                      <TextLink href={`${BASE}/${row.id}`}>
                        {t("booking.row.open")}
                      </TextLink>
                      {superplan && !row.productMissing ? (
                        <TextLink href={`/app/superplan?booking=${row.id}`}>
                          {t("booking.row.superplan")}
                        </TextLink>
                      ) : null}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {page.rows.length === 0 ? (
          <div className="p-3">
            <Empty>
              {data.rows.length
                ? t("booking.emptyFiltered")
                : t("booking.empty")}
            </Empty>
          </div>
        ) : null}
      </div>

      {page.pages > 1 ? (
        <div
          className="mt-3 flex items-center gap-3 text-sm"
          data-booking-pages
        >
          {page.page > 1 ? (
            <TextLink href={`${BASE}${q({ page: page.page - 1 })}`}>
              ← {t("booking.page.prev")}
            </TextLink>
          ) : null}
          <span>
            {page.page} / {page.pages}
          </span>
          {page.page < page.pages ? (
            <TextLink href={`${BASE}${q({ page: page.page + 1 })}`}>
              {t("booking.page.next")} →
            </TextLink>
          ) : null}
        </div>
      ) : null}

      <BookingEnhancer
        filterFormId={FILTER_FORM}
        bulkFormId={BULK_FORM}
        dataFormId={DATA_FORM}
      />
    </>
  );
}
