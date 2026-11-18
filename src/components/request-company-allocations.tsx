import type { Translate } from "@/i18n";
import type { Request } from "@/lib/db";
import { getStore } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import { taxIdText } from "@/lib/economic-group";
import { Table, Td, Th } from "./ui";

/**
 * Empresas do grupo econômico na solicitação (docs/ECONOMIC_GROUPS.md): as
 * peças de cada empresa em cada entrega e o total. Nada no pedido de um
 * cliente só.
 */
export async function RequestCompanyAllocations({
  request,
  t,
}: {
  request: Pick<Request, "companyAllocations">;
  t: Translate;
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
                <Td>{p?.name ?? "—"}</Td>
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
        </tbody>
      </Table>
    </section>
  );
}
