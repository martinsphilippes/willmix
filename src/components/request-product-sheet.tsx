import type { Translate } from "@/i18n";
import type {
  SheetField,
  SheetRow,
  RequestSheetView,
} from "@/lib/services/request-sheet";
import { Card, cx } from "./ui";
import { HoverZoomPhoto } from "./hover-zoom-photo";
import { Missing, SourceTag } from "./request-sheet-table";

/*
 * O produto neste pedido (dono, 23/11/2026; docs/REQUEST_SHEET.md, seção 7):
 * a tela de um produto mostra só ele, sem a tabela da ficha completa. No
 * alto, a foto, o código e os números principais; embaixo, um quadro para
 * cada grupo da ficha (Produto, Embalagem e cubagem, Valores e Pagamento),
 * com cada dado, a origem dele e a conta. Os mesmos dados e as mesmas
 * permissões da ficha (src/lib/services/request-sheet.ts): o que o perfil
 * não vê não sai do servidor, e o grupo mostra o aviso.
 */

function Value({ field, t }: { field: SheetField; t: Translate }) {
  return (
    <>
      <dd
        className="mt-0.5 whitespace-pre-line text-sm font-medium text-zinc-900"
        data-sheet-value
      >
        {field.value === null ? <Missing t={t} /> : field.value}
        {field.source ? <SourceTag source={field.source} t={t} linked /> : null}
      </dd>
      {field.note ? (
        <dd className="mt-0.5 whitespace-pre-line text-xs text-zinc-500">
          {field.note}
        </dd>
      ) : null}
    </>
  );
}

function Stat({
  name,
  label,
  field,
  t,
}: {
  /** Qual número é (testes e âncoras). */
  name: string;
  label: string;
  field: SheetField;
  t: Translate;
}) {
  return (
    <div
      className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 px-3 py-2"
      data-sheet-cell={name}
    >
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <Value field={field} t={t} />
    </div>
  );
}

export function RequestProductSheet({
  view,
  t,
}: {
  view: RequestSheetView;
  t: Translate;
}) {
  const row: SheetRow | undefined =
    view.rows.find((r) => r.current) ?? view.rows[0];
  if (!row) return null;
  const main = row.main;
  const stats: Array<[string, string, SheetField | null]> = [
    ["pieces", t("requestSheet.col.pieces"), main.pieces],
    ["boxes", t("requestSheet.col.boxes"), main.boxes],
    ["cbm", t("requestSheet.col.cbm"), main.cbm],
    ["cost", t("requestSheet.col.cost"), main.cost],
    ["purchase", t("requestSheet.col.purchase"), main.purchase],
    ["sale", t("requestSheet.col.sale"), main.sale],
  ];
  return (
    <div
      className="flex flex-col gap-4"
      data-request-sheet
      data-sheet-mode="product"
      data-sheet-row={row.requestId}
      data-sheet-current=""
    >
      <Card title={t("requestProduct.title")}>
        <div className="flex flex-wrap items-start gap-4">
          <span
            className="shrink-0"
            data-sheet-thumb={row.photoId ? "" : "empty"}
          >
            <HoverZoomPhoto photoId={row.photoId ?? null} size="h-24 w-24" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-zinc-600">
              {row.code ? (
                <span className="font-mono text-xs" data-sheet-code>
                  {row.code}
                </span>
              ) : null}
              {row.variant ? (
                <span data-request-variant>{row.variant}</span>
              ) : null}
              {main.deadline ? (
                <span>
                  {t("requestSheet.col.deadline")}:{" "}
                  <span className="font-medium text-zinc-900">
                    {main.deadline}
                  </span>
                </span>
              ) : null}
            </p>
            {row.warnings.map((w, i) => (
              <p
                key={i}
                className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900 ring-1 ring-amber-200"
                data-sheet-warning
              >
                {w}
              </p>
            ))}
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {stats.map(([name, label, field]) =>
            field ? (
              <Stat key={name} name={name} label={label} field={field} t={t} />
            ) : null,
          )}
        </dl>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2" data-sheet-full>
        {row.groups.map((group) => (
          <div
            key={group.key}
            data-sheet-group={group.restricted ? undefined : group.key}
          >
            <Card title={group.title}>
              {group.restricted ? (
                <p
                  className="text-sm text-zinc-500"
                  data-sheet-restricted={group.key}
                >
                  {group.restricted}
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {group.sections.map((section) => (
                    <section key={section.key} data-sheet-section={section.key}>
                      {section.title ? (
                        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          {section.title}
                        </h3>
                      ) : null}
                      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                        {section.fields.map((field) => (
                          <div
                            key={field.key}
                            className={cx("min-w-0")}
                            data-sheet-field={field.key}
                          >
                            <dt className="text-xs text-zinc-500">
                              {field.label}
                            </dt>
                            <Value field={field} t={t} />
                          </div>
                        ))}
                      </dl>
                    </section>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
