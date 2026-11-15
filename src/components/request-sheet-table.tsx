import type { CSSProperties, ReactNode } from "react";
import type { Translate } from "@/i18n";
import type {
  RequestSheetView,
  SheetField,
  SheetGroup,
  SheetRow,
  SheetSource,
} from "@/lib/services/request-sheet";
import { cx, formatDate, TextLink } from "./ui";

/*
 * "Solicitações" no detalhe da solicitação (dono, 15/11/2026;
 * docs/REQUEST_SHEET.md): uma linha por produto com os dados principais e
 * "Ver ficha completa" na própria linha. A ficha abre na largura do cartão,
 * em quatro grupos (Produto, Embalagem e cubagem, Valores, Pagamento).
 *
 * A tabela não corta colunas: pela largura do cartão (@container), em tela
 * larga as linhas viram colunas com cabeçalho; no iPad e no celular cada
 * linha vira um cartão com o título de cada dado. Sem JavaScript: a ficha
 * abre e fecha com <details>. Tudo o que chega aqui já passou pelas
 * permissões no servidor (src/lib/services/request-sheet.ts).
 */

const TAG_STYLE: Partial<Record<SheetSource["kind"], string>> = {
  current: "bg-amber-50 text-amber-800 ring-amber-200",
  calculated: "bg-sky-50 text-sky-800 ring-sky-200",
};

function SourceTag({
  source,
  t,
  linked = false,
}: {
  source: SheetSource;
  t: Translate;
  linked?: boolean;
}) {
  const className = cx(
    "ml-1.5 inline-block whitespace-nowrap rounded px-1 align-baseline text-[10px] font-medium ring-1",
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

function FieldValue({
  field,
  t,
  linked = false,
  compact = false,
}: {
  field: SheetField;
  t: Translate;
  linked?: boolean;
  /** Na linha principal: sem a conta (ela fica na ficha completa). */
  compact?: boolean;
}) {
  return (
    <>
      {field.value === null ? (
        <span className="italic text-zinc-400" data-sheet-missing>
          {t("requestSheet.notInformed")}
        </span>
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

function Group({ group, t }: { group: SheetGroup; t: Translate }) {
  return (
    <section
      className="@container min-w-0 rounded-lg border border-zinc-200 bg-white p-3"
      data-sheet-group={group.key}
    >
      <h4 className="text-sm font-semibold text-zinc-900">{group.title}</h4>
      {group.restricted ? (
        <p className="mt-1 text-xs text-zinc-500" data-sheet-restricted>
          {group.restricted}
        </p>
      ) : (
        group.sections.map((section) => (
          <div
            key={section.key}
            className="mt-2.5"
            data-sheet-section={section.key}
          >
            {section.title ? (
              <h5 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                {section.title}
              </h5>
            ) : null}
            <dl className="mt-1 divide-y divide-zinc-100">
              {section.fields.map((field) => (
                <div
                  key={field.key}
                  className="grid grid-cols-1 gap-x-3 py-1.5 @sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
                  data-sheet-field={field.key}
                >
                  <dt className="text-xs text-zinc-500">{field.label}</dt>
                  <dd className="min-w-0 break-words text-sm text-zinc-800">
                    <FieldValue field={field} t={t} linked />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))
      )}
    </section>
  );
}

function Row({
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
      <details className="group">
        <summary
          className="grid cursor-pointer list-none grid-cols-2 gap-x-3 gap-y-2 p-3 @md:grid-cols-3 @2xl:grid-cols-4 @4xl:items-start @4xl:[grid-template-columns:var(--sheet-cols)] [&::-webkit-details-marker]:hidden"
          style={{ "--sheet-cols": template } as CSSProperties}
          aria-label={t("requestSheet.openAria", { name: row.name })}
        >
          <Cell
            column={col("product") as Column}
            className="col-span-full @4xl:col-span-1"
          >
            <span
              className={cx(
                "font-medium",
                row.current ? "text-zinc-900" : "text-zinc-700",
              )}
            >
              {row.name}
            </span>
            {row.code ? (
              <span
                className="ml-1.5 text-xs tabular-nums text-zinc-500"
                data-sheet-code
              >
                {row.code}
              </span>
            ) : null}
            {row.variant ? (
              <span
                className="block text-xs text-zinc-500"
                data-request-variant
              >
                {row.variant}
              </span>
            ) : null}
            {row.current ? (
              <span className="mt-0.5 block text-[11px] font-medium text-brand-700">
                {t("requestSheet.thisRequest")}
              </span>
            ) : null}
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
                <span className="italic text-zinc-400">
                  {t("requestSheet.notInformed")}
                </span>
              )}
            </Cell>
          ) : null}
          {main("cost", row.main.cost)}
          {main("purchase", row.main.purchase)}
          {main("sale", row.main.sale)}
          <div className="col-span-full flex items-start @4xl:col-span-1 @4xl:justify-end">
            <span
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 shadow-xs group-open:border-brand-300 group-open:text-brand-700"
              data-sheet-toggle
            >
              <span className="group-open:hidden">
                {t("requestSheet.open")}
              </span>
              <span className="hidden group-open:inline">
                {t("requestSheet.close")}
              </span>
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="size-3.5 transition group-open:rotate-180"
                fill="currentColor"
              >
                <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" />
              </svg>
            </span>
          </div>
          {row.warnings.map((w, i) => (
            <p
              key={i}
              className="col-span-full rounded bg-amber-50 px-2 py-1 text-xs text-amber-900 ring-1 ring-amber-200"
              data-sheet-warning
            >
              {w}
            </p>
          ))}
        </summary>
        <div
          className="@container border-t border-zinc-100 bg-zinc-50/60 p-3"
          data-sheet-detail
        >
          {!row.current ? (
            <p className="mb-2 text-sm">
              <TextLink href={`/app/requests/${row.requestId}`}>
                {t("requestSheet.openRequest")} →
              </TextLink>
            </p>
          ) : null}
          <div className="grid gap-3 @3xl:grid-cols-2">
            {row.groups.map((group) => (
              <Group key={group.key} group={group} t={t} />
            ))}
          </div>
        </div>
      </details>
    </li>
  );
}

export function RequestSheetTable({
  view,
  t,
}: {
  view: RequestSheetView;
  t: Translate;
}) {
  if (!view.rows.length) return null;
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
    { key: "toggle", label: "", width: "auto" },
  ];
  const template = columns.map((c) => c.width).join(" ");
  return (
    <div className="@container" data-request-sheet>
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
          <Row
            key={row.requestId}
            row={row}
            columns={columns}
            template={template}
            t={t}
          />
        ))}
      </ul>
      <p className="mt-2 text-[11px] leading-snug text-zinc-500">
        {t("requestSheet.legend")}
      </p>
    </div>
  );
}
