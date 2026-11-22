import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import type { Translate } from "@/i18n";
import type {
  RequestSheetView,
  SheetField,
  SheetGroupKey,
  SheetRow,
  SheetSource,
} from "@/lib/services/request-sheet";
import { cx, formatDate, OpenLink, TextLink } from "./ui";
import { ClampText } from "./clamp-text";
import { HoverZoomPhoto } from "./hover-zoom-photo";

/*
 * "Solicitações" no detalhe da solicitação (dono, 15/11/2026;
 * docs/REQUEST_SHEET.md e docs/LINHA_DE_VISAO.md): uma linha por produto.
 *
 * - Linha resumida: os dados principais. Pela largura do cartão
 *   (@container), em tela larga as linhas viram colunas com cabeçalho; no
 *   iPad e no celular cada linha vira um cartão com o título de cada dado.
 * - Ver ficha completa (botão no alto da tabela, vale para todas as linhas;
 *   é um link, sem JavaScript): a linha de cada produto continua para a
 *   direita, em linha horizontal, com todos os campos de Produto,
 *   Embalagem e cubagem, Valores e Pagamento, faixas de grupo em cima e o
 *   produto fixo à esquerda. Nunca um bloco embaixo da linha (dono). A
 *   página não rola de lado: só a tabela.
 *
 * Sem dado: "—" ("Não informado" para o leitor de tela e na dica). Grupo
 * que o perfil não vê não aparece; o aviso de quem vê fica embaixo. Tudo o
 * que chega aqui já passou pelas permissões no servidor
 * (src/lib/services/request-sheet.ts).
 *
 * Linha fina (dono, 22/11/2026): na ficha completa, cada produto ocupa uma
 * linha da altura da foto. O texto que não cabe termina em "…" com o "ver
 * mais" ao lado, que abre só aquela célula (as quebras de linha voltam e a
 * conta do valor aparece embaixo); a origem fica ao lado do valor. A foto do
 * produto (a da vitrine do catálogo) abre a primeira coluna nos dois modos.
 */

const TAG_STYLE: Partial<Record<SheetSource["kind"], string>> = {
  current: "bg-amber-50 text-amber-800 ring-amber-200",
  calculated: "bg-sky-50 text-sky-800 ring-sky-200",
};

function SourceTag({
  source,
  t,
  linked = false,
  inline = true,
}: {
  source: SheetSource;
  t: Translate;
  linked?: boolean;
  /** Depois do valor, no mesmo texto (com a margem); falso: já num flex. */
  inline?: boolean;
}) {
  const className = cx(
    "whitespace-nowrap rounded px-1 text-[10px] font-medium ring-1",
    inline ? "ml-1.5 inline-block align-baseline" : "inline-block",
    TAG_STYLE[source.kind] ?? "bg-zinc-100 text-zinc-600 ring-zinc-200",
  );
  const title =
    source.kind === "current"
      ? t("requestSheet.srcHint.current")
      : source.kind === "calculated"
        ? t("requestSheet.srcHint.calculated")
        : undefined;
  if (linked && source.href)
    return (
      <TextLink
        href={source.href}
        className={cx(className, "no-underline hover:underline")}
        title={title}
        data-sheet-source={source.kind}
      >
        {source.label}
      </TextLink>
    );
  return (
    <span className={className} title={title} data-sheet-source={source.kind}>
      {source.label}
    </span>
  );
}

/** "—" para dado ausente; o leitor de tela e a dica dizem "Não informado". */
function Missing({ t }: { t: Translate }) {
  return (
    <span
      className="text-zinc-400"
      title={t("requestSheet.notInformed")}
      aria-label={t("requestSheet.notInformed")}
      data-sheet-missing
    >
      —
    </span>
  );
}

function FieldValue({
  field,
  t,
  linked = false,
  compact = false,
}: {
  field: SheetField;
  t: Translate;
  linked?: boolean;
  /** Na linha resumida: sem a conta (ela fica na ficha completa). */
  compact?: boolean;
}) {
  return (
    <>
      {field.value === null ? (
        <Missing t={t} />
      ) : (
        <span className="whitespace-pre-line" data-sheet-value>
          {field.value}
        </span>
      )}
      {field.source ? (
        <SourceTag source={field.source} t={t} linked={linked} />
      ) : null}
      {field.note && !compact ? (
        <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
          {field.note}
        </span>
      ) : null}
    </>
  );
}

interface Column {
  key: string;
  label: string;
  width: string;
}

function Cell({
  column,
  children,
  className,
}: {
  column: Column;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("min-w-0", className)} data-sheet-cell={column.key}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 @4xl:hidden">
        {column.label}
      </div>
      <div className="break-words text-sm text-zinc-800">{children}</div>
    </div>
  );
}

/** Nome, código, variação e de qual solicitação é a linha. */
function ProductName({ row, t }: { row: SheetRow; t: Translate }) {
  return (
    <>
      {row.current ? (
        <span className="font-medium text-zinc-900">{row.name}</span>
      ) : (
        <TextLink
          href={`/app/requests/${row.requestId}`}
          className="font-medium text-zinc-700 no-underline hover:underline"
        >
          {row.name}
        </TextLink>
      )}
      {row.code ? (
        <span
          className="ml-1.5 whitespace-nowrap text-xs tabular-nums text-zinc-500"
          data-sheet-code
        >
          {row.code}
        </span>
      ) : null}
      {row.variant ? (
        <span className="block text-xs text-zinc-500" data-request-variant>
          {row.variant}
        </span>
      ) : null}
      {row.current ? (
        <span className="mt-0.5 block text-[11px] font-medium text-brand-700">
          {t("requestSheet.thisRequest")}
        </span>
      ) : (
        <OpenLink
          href={`/app/requests/${row.requestId}`}
          label={t("requestSheet.openRequest")}
          className="ml-1.5 align-middle"
          data-sheet-open-request
        />
      )}
    </>
  );
}

/** "ver mais" / "ver menos" das células recolhidas. */
const clampLabels = (t: Translate) => ({
  more: t("requestSheet.more"),
  less: t("requestSheet.less"),
});

/** Miniatura do produto (a foto grande ao passar o mouse); sem foto, o quadro vazio. */
function Thumb({ row }: { row: SheetRow }) {
  return (
    <span className="shrink-0" data-sheet-thumb={row.photoId ? "" : "empty"}>
      <HoverZoomPhoto photoId={row.photoId ?? null} size="h-9 w-9" />
    </span>
  );
}

/**
 * Primeira coluna da ficha completa, numa linha só (dono, 22/11/2026): a
 * foto, o nome cortado com "ver mais" e, embaixo, o código, a variação e de
 * qual solicitação é a linha; os avisos numa linha, também com "ver mais".
 */
function ProductThin({ row, t }: { row: SheetRow; t: Translate }) {
  const labels = clampLabels(t);
  return (
    <div className="flex items-center gap-2">
      <Thumb row={row} />
      <div className="min-w-0 flex-1">
        <ClampText
          text={row.name}
          lines={1}
          {...labels}
          className={cx(
            "max-w-full text-[13px] font-medium",
            row.current ? "text-zinc-900" : "text-zinc-700",
          )}
        />
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-tight text-zinc-500">
          {row.code ? (
            <span className="shrink-0 tabular-nums" data-sheet-code>
              {row.code}
            </span>
          ) : null}
          {row.variant ? (
            <span className="min-w-0 truncate" data-request-variant>
              {row.variant}
            </span>
          ) : null}
          {row.current ? (
            <span className="shrink-0 font-medium text-brand-700">
              {t("requestSheet.thisRequest")}
            </span>
          ) : (
            <OpenLink
              href={`/app/requests/${row.requestId}`}
              label={t("requestSheet.openRequest")}
              className="shrink-0"
              data-sheet-open-request
            />
          )}
        </div>
        {row.warnings.length ? (
          <div data-sheet-warning>
            <ClampText
              text={`⚠ ${row.warnings.join(" · ")}`}
              lines={1}
              {...labels}
              className="max-w-full text-[11px] text-amber-800"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Valor de uma célula da ficha completa numa linha (dono, 22/11/2026): o
 * texto cortado com "ver mais", a origem ao lado e a conta recolhida.
 */
function ThinValue({ field, t }: { field: SheetField; t: Translate }) {
  const labels = clampLabels(t);
  return (
    <div className="flex max-w-[20rem] items-baseline gap-1.5">
      {field.value === null ? (
        <>
          <Missing t={t} />
          {field.note ? (
            <ClampText
              text={field.note}
              lines={1}
              {...labels}
              className="min-w-0 flex-1 text-[11px] text-zinc-500"
            />
          ) : null}
        </>
      ) : (
        <span className="min-w-0 flex-1" data-sheet-value>
          <ClampText
            text={field.value}
            lines={1}
            preserveLines
            detail={field.note}
            {...labels}
          />
        </span>
      )}
      {field.source ? (
        <span className="shrink-0">
          <SourceTag source={field.source} t={t} linked inline={false} />
        </span>
      ) : null}
    </div>
  );
}

function Warnings({ row }: { row: SheetRow }) {
  return row.warnings.map((w, i) => (
    <p
      key={i}
      className="col-span-full mt-1 rounded bg-amber-50 px-2 py-1 text-xs whitespace-normal text-amber-900 ring-1 ring-amber-200"
      data-sheet-warning
    >
      {w}
    </p>
  ));
}

/* ------------------------------------------------------------------------ */
/* Linha resumida                                                            */
/* ------------------------------------------------------------------------ */

function SummaryRow({
  row,
  columns,
  template,
  t,
}: {
  row: SheetRow;
  columns: Column[];
  template: string;
  t: Translate;
}) {
  const col = (key: string) => columns.find((c) => c.key === key);
  const main = (key: keyof SheetRow["main"], field: SheetField | null) => {
    const c = col(key);
    return c && field ? (
      <Cell key={key} column={c}>
        <FieldValue field={field} t={t} compact />
        {field.label !== c.label &&
        (key === "sale" || key === "cost" || key === "purchase") ? (
          <span className="block text-[11px] text-zinc-500">{field.label}</span>
        ) : null}
      </Cell>
    ) : null;
  };
  const deadline = col("deadline");
  return (
    <li
      className={cx(
        "rounded-lg border border-zinc-200",
        row.current ? "bg-white" : "bg-zinc-50/40",
      )}
      data-sheet-row={row.requestId}
      data-sheet-current={row.current ? "" : undefined}
    >
      <div
        className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 @md:grid-cols-3 @2xl:grid-cols-4 @4xl:items-start @4xl:[grid-template-columns:var(--sheet-cols)]"
        style={{ "--sheet-cols": template } as CSSProperties}
      >
        <Cell
          column={col("product") as Column}
          className="col-span-full @4xl:col-span-1"
        >
          <div className="flex items-start gap-2">
            <Thumb row={row} />
            <div className="min-w-0">
              <ProductName row={row} t={t} />
            </div>
          </div>
        </Cell>
        {main("pieces", row.main.pieces)}
        {main("boxes", row.main.boxes)}
        {main("cbm", row.main.cbm)}
        {deadline ? (
          <Cell column={deadline}>
            {row.main.deadline ? (
              <span className="whitespace-nowrap tabular-nums">
                {formatDate(row.main.deadline, t)}
              </span>
            ) : (
              <Missing t={t} />
            )}
          </Cell>
        ) : null}
        {main("cost", row.main.cost)}
        {main("purchase", row.main.purchase)}
        {main("sale", row.main.sale)}
        <Warnings row={row} />
      </div>
    </li>
  );
}

function SummaryList({ view, t }: { view: RequestSheetView; t: Translate }) {
  const { access } = view;
  const columns: Column[] = [
    {
      key: "product",
      label: t("requestSheet.col.product"),
      width: "minmax(11rem,2.4fr)",
    },
    {
      key: "pieces",
      label: t("requestSheet.col.pieces"),
      width: "minmax(0,1.1fr)",
    },
    ...(access.technical
      ? [
          {
            key: "boxes",
            label: t("requestSheet.col.boxes"),
            width: "minmax(0,1fr)",
          },
          {
            key: "cbm",
            label: t("requestSheet.col.cbm"),
            width: "minmax(0,1fr)",
          },
        ]
      : []),
    {
      key: "deadline",
      label: t("requestSheet.col.deadline"),
      width: "minmax(0,1fr)",
    },
    ...(access.purchase
      ? [
          {
            key: "cost",
            label: t("requestSheet.col.cost"),
            width: "minmax(0,1fr)",
          },
          {
            key: "purchase",
            label: t("requestSheet.col.purchase"),
            width: "minmax(0,1fr)",
          },
        ]
      : []),
    ...(access.sale
      ? [
          {
            key: "sale",
            label: t("requestSheet.col.sale"),
            width: "minmax(0,1fr)",
          },
        ]
      : []),
  ];
  const template = columns.map((c) => c.width).join(" ");
  return (
    <>
      <div
        className="hidden gap-x-3 px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 @4xl:grid @4xl:[grid-template-columns:var(--sheet-cols)]"
        style={{ "--sheet-cols": template } as CSSProperties}
        aria-hidden
      >
        {columns.map((c) => (
          <div key={c.key} className="min-w-0">
            {c.label}
          </div>
        ))}
      </div>
      <ul className="space-y-2">
        {view.rows.map((row) => (
          <SummaryRow
            key={row.requestId}
            row={row}
            columns={columns}
            template={template}
            t={t}
          />
        ))}
      </ul>
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Ficha completa: a linha continua para a direita                           */
/* ------------------------------------------------------------------------ */

const GROUP_ORDER: SheetGroupKey[] = [
  "product",
  "packing",
  "values",
  "payment",
];
const GROUP_TINT: Record<SheetGroupKey, string> = {
  product: "bg-indigo-50",
  packing: "bg-sky-50",
  values: "bg-amber-50",
  payment: "bg-violet-50",
};

interface FullGroup {
  key: SheetGroupKey;
  title: string;
  /** Campos na ordem em que aparecem nas linhas (todos os produtos). */
  fields: Array<{ key: string; label: string }>;
  /** Nenhuma linha mostra o grupo: o aviso de quem vê. */
  restricted: string | null;
}

/** As colunas da ficha: a união dos campos de cada grupo em todas as linhas. */
function fullGroups(view: RequestSheetView): FullGroup[] {
  return GROUP_ORDER.map((key) => {
    const fields = new Map<string, string>();
    let title = "";
    let restricted: string | null = null;
    for (const row of view.rows) {
      const group = row.groups.find((g) => g.key === key);
      if (!group) continue;
      title = group.title;
      if (group.restricted) {
        restricted ??= group.restricted;
        continue;
      }
      for (const section of group.sections)
        for (const field of section.fields)
          if (!fields.has(field.key)) fields.set(field.key, field.label);
    }
    return {
      key,
      title,
      fields: [...fields].map(([k, label]) => ({ key: k, label })),
      restricted: fields.size ? null : restricted,
    };
  });
}

function fieldOf(row: SheetRow, group: SheetGroupKey, key: string) {
  for (const g of row.groups)
    if (g.key === group && !g.restricted)
      for (const s of g.sections)
        for (const f of s.fields) if (f.key === key) return f;
  return null;
}

const STICKY = "sticky left-0 z-10 shadow-[6px_0_8px_-6px_rgba(0,0,0,0.18)]";
const BAND =
  "border-b border-zinc-200 px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap text-zinc-700";
const HEAD =
  "border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide whitespace-nowrap text-zinc-500";
/** Linha fina da ficha completa (dono, 22/11/2026): da altura da foto. */
const THIN =
  "border-b border-zinc-100 px-3 py-1.5 align-top text-[13px] text-zinc-800";

function FullTable({ view, t }: { view: RequestSheetView; t: Translate }) {
  const groups = fullGroups(view);
  const shown = groups.filter((g) => g.fields.length);
  const hidden = groups.filter((g) => !g.fields.length && g.restricted);
  // Primeira coluna de cada grupo: a borda que separa os grupos.
  const edge = "border-l-2 border-l-zinc-300";
  return (
    <>
      <p className="mb-2 text-xs text-zinc-500">
        {t("requestSheet.full.hint")}
      </p>
      <div
        className="max-w-full overflow-x-auto rounded-lg border border-zinc-200"
        data-sheet-full
      >
        <table className="w-max min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {/* Separadas: só a do produto fica fixa (a do prazo rola). */}
              <th className={cx(BAND, STICKY, "bg-white")} aria-hidden />
              <th className={cx(BAND, "bg-white")} aria-hidden />
              {shown.map((g) => (
                <th
                  key={g.key}
                  colSpan={g.fields.length}
                  className={cx(BAND, GROUP_TINT[g.key], edge)}
                  data-sheet-group={g.key}
                >
                  {g.title}
                </th>
              ))}
            </tr>
            <tr>
              <th className={cx(HEAD, STICKY)}>
                {t("requestSheet.col.product")}
              </th>
              <th className={HEAD}>{t("requestSheet.col.deadline")}</th>
              {shown.flatMap((g) =>
                g.fields.map((f, i) => (
                  <th
                    key={`${g.key}.${f.key}`}
                    className={cx(HEAD, i === 0 && edge)}
                  >
                    {f.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => (
              <tr
                key={row.requestId}
                data-sheet-row={row.requestId}
                data-sheet-current={row.current ? "" : undefined}
              >
                <td
                  className={cx(
                    THIN,
                    STICKY,
                    row.current ? "bg-white" : "bg-zinc-50",
                  )}
                  data-sheet-cell="product"
                >
                  {/* Estreita no celular (sobra lugar para os dados que
                      rolam); mais larga a partir de ~670 px de cartão. */}
                  <div className="w-44 @2xl:w-64">
                    <ProductThin row={row} t={t} />
                  </div>
                </td>
                <td
                  className={cx(THIN, "whitespace-nowrap tabular-nums")}
                  data-sheet-field="deadline"
                >
                  {row.main.deadline ? (
                    formatDate(row.main.deadline, t)
                  ) : (
                    <Missing t={t} />
                  )}
                </td>
                {shown.flatMap((g) =>
                  g.fields.map((f, i) => {
                    const field = fieldOf(row, g.key, f.key);
                    return (
                      <td
                        key={`${g.key}.${f.key}`}
                        className={cx(THIN, "min-w-28", i === 0 && edge)}
                        data-sheet-field={f.key}
                      >
                        {field ? (
                          <ThinValue field={field} t={t} />
                        ) : (
                          <Missing t={t} />
                        )}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidden.map((g) => (
        <p
          key={g.key}
          className="mt-2 text-xs text-zinc-500"
          data-sheet-restricted={g.key}
        >
          <span className="font-medium text-zinc-700">{g.title}:</span>{" "}
          {g.restricted}
        </p>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* A tabela                                                                  */
/* ------------------------------------------------------------------------ */

export function RequestSheetTable({
  view,
  t,
  full = false,
  summaryHref,
  fullHref,
}: {
  view: RequestSheetView;
  t: Translate;
  /** Ficha completa (todas as linhas abertas para a direita). */
  full?: boolean;
  /** Endereços do botão no alto da tabela (a mesma tela, com e sem a ficha). */
  summaryHref?: string;
  fullHref?: string;
}) {
  if (!view.rows.length) return null;
  const option = (on: boolean) =>
    cx(
      "px-3 py-1.5 no-underline",
      on ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50",
    );
  return (
    <div
      className="@container min-w-0"
      data-request-sheet
      data-sheet-mode={full ? "full" : "summary"}
    >
      {summaryHref && fullHref ? (
        <nav
          className="mb-2 flex justify-end"
          aria-label={t("requestSheet.mode.label")}
        >
          <div className="inline-flex overflow-hidden rounded-lg border border-zinc-300 text-xs font-semibold">
            <Link
              href={summaryHref}
              className={option(!full)}
              aria-current={!full ? "true" : undefined}
              data-sheet-mode-link="summary"
            >
              {t("requestSheet.mode.summary")}
            </Link>
            <Link
              href={fullHref}
              className={option(full)}
              aria-current={full ? "true" : undefined}
              data-sheet-mode-link="full"
            >
              {t("requestSheet.open")}
            </Link>
          </div>
        </nav>
      ) : null}
      {full ? (
        <FullTable view={view} t={t} />
      ) : (
        <SummaryList view={view} t={t} />
      )}
      <p className="mt-2 text-[11px] leading-snug text-zinc-500">
        {t("requestSheet.legend")}
      </p>
    </div>
  );
}
