import type { Translate } from "@/i18n";
import type { Request } from "@/lib/db";
import { getStore } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import { taxIdText } from "@/lib/economic-group";
import { companyName } from "@/lib/services/economic-groups";
import type { RoundPacking } from "@/lib/services/request-packing";
import { Table, Td, Th } from "./ui";

/**
 * Empresas do grupo econômico na solicitação (docs/ECONOMIC_GROUPS.md): as
 * peças de cada empresa em cada entrega e o total. Nada no pedido de um
 * cliente só. Abaixo das empresas (dono, 22/11/2026): as caixas master, a
 * cubagem e os containers de cada programação, pela embalagem da ficha.
 */
export async function RequestCompanyAllocations({
  request,
  t,
  packing,
}: {
  request: Pick<Request, "companyAllocations">;
  t: Translate;
  /**
   * Caixas, m³ e containers de cada programação (`roundPackingOf`) e o
   * container de referência ("40HC"). Sem ele, só as empresas.
   */
  packing?: { rounds: RoundPacking; container: string | null } | null;
}) {
  const rows = request.companyAllocations ?? [];
  if (!rows.length) return null;
  const parties = await listByIds(
    getStore(),
    "parties",
    rows.map((r) => r.customerId),
  );
  const byId = new Map(parties.map((p) => [p.id, p]));
  const rounds = Math.max(...rows.map((r) => r.quantities.length));
  const fmt = (n: number) => n.toLocaleString(t.intl);
  const cbmText = (n: number) =>
    n.toLocaleString(t.intl, { maximumFractionDigits: 3 });
  const dash = <span className="text-zinc-400">—</span>;
  /** Uma linha por programação (caixas, m³ ou containers) com o total. */
  const packingRow = (
    key: string,
    label: string,
    values: number[] | null,
    total: number | null,
    text: (n: number) => string,
    title?: string,
  ) => (
    <tr
      key={key}
      className="bg-zinc-50/70"
      data-request-companies-packing={key}
    >
      <Td colSpan={2} className="font-medium text-zinc-700">
        <span title={title}>{label}</span>
      </Td>
      {rounds > 1
        ? Array.from({ length: rounds }, (_, i) => (
            <Td
              key={i}
              className="text-right tabular-nums"
              data-request-companies-round={i + 1}
            >
              {values && values[i] !== undefined ? text(values[i]) : dash}
            </Td>
          ))
        : null}
      <Td
        className="text-right font-semibold tabular-nums"
        data-request-companies-total=""
      >
        {total !== null ? text(total) : dash}
      </Td>
    </tr>
  );
  return (
    <section
      className="mt-3 border-t border-zinc-100 pt-2.5"
      data-request-companies
    >
      <h3 className="mb-1.5 text-sm font-semibold text-zinc-800">
        {t("econGroup.request.title")}
      </h3>
      <Table>
        <thead>
          <tr>
            <Th>{t("econGroup.col.company")}</Th>
            <Th>{t("econGroup.col.taxId")}</Th>
            {rounds > 1
              ? Array.from({ length: rounds }, (_, i) => (
                  <Th key={i} className="text-right">
                    {i + 1}
                  </Th>
                ))
              : null}
            <Th className="text-right">{t("econGroup.request.total")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = byId.get(r.customerId);
            return (
              <tr key={r.customerId} data-request-company={r.customerId}>
                <Td>{p ? companyName(p) : "—"}</Td>
                <Td className="tabular-nums">{taxIdText(p?.taxId ?? null)}</Td>
                {rounds > 1
                  ? Array.from({ length: rounds }, (_, i) => (
                      <Td key={i} className="text-right tabular-nums">
                        {fmt(r.quantities[i] ?? 0)}
                      </Td>
                    ))
                  : null}
                <Td className="text-right font-semibold tabular-nums">
                  {fmt(r.quantities.reduce((a, b) => a + b, 0))}
                </Td>
              </tr>
            );
          })}
          {packing ? (
            <>
              {packingRow(
                "boxes",
                t("econGroup.request.boxes"),
                packing.rounds.boxes,
                packing.rounds.totals.boxes,
                fmt,
              )}
              {packingRow(
                "cbm",
                t("econGroup.request.cbm"),
                packing.rounds.cbm,
                packing.rounds.totals.cbm,
                cbmText,
              )}
              {packingRow(
                "containers",
                t("econGroup.request.containers", {
                  code: packing.container ?? "—",
                }),
                packing.rounds.containers,
                packing.rounds.totals.containers,
                fmt,
                t("econGroup.request.containersHint", {
                  code: packing.container ?? "—",
                }),
              )}
            </>
          ) : null}
        </tbody>
      </Table>
    </section>
  );
}
