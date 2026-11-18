import "server-only";
import { getStore, type Party, type User } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import type { EconomicGroup, GroupCompany } from "@/lib/economic-group";

/*
 * Grupo econômico do Sankhya na Nova solicitação (dono, 18/11/2026;
 * docs/ECONOMIC_GROUPS.md). A VW_AD_CLIENTE_WELL diz o grupo de cada
 * cliente (`parties.economicGroupCode`, o CODPARC da empresa que representa
 * o grupo). Escolher como cliente a empresa que representa um grupo com
 * outras empresas abre o pedido do grupo: um pedido só ao fornecedor, com as
 * quantidades de cada empresa em cada produto.
 */

export type { EconomicGroup, GroupCompany } from "@/lib/economic-group";

const CODE = /^\d{1,12}$/;

/**
 * Quantas outras empresas (ativas) cada grupo tem, pelo código do cliente
 * que o representa. Grupo sem outra empresa não entra no mapa.
 */
export async function groupSizes(
  codes: readonly string[],
): Promise<Map<string, number>> {
  const wanted = [...new Set(codes.filter((c) => CODE.test(c)))];
  const out = new Map<string, number>();
  if (!wanted.length) return out;
  const members = await listColumns(
    getStore(),
    "parties",
    ["economicGroupCode", "sankhyaCode", "active"],
    { filter: { type: "customer", economicGroupCode: wanted } },
  );
  for (const m of members) {
    const code = m.economicGroupCode;
    if (!code || !m.active || m.sankhyaCode === code) continue;
    out.set(code, (out.get(code) ?? 0) + 1);
  }
  return out;
}

/** O código do grupo que o cliente representa, ou nulo. */
function headCode(party: Pick<Party, "type" | "sankhyaCode">): string | null {
  const code = party.type === "customer" ? (party.sankhyaCode ?? "") : "";
  return CODE.test(code) ? String(Number(code)) : null;
}

/**
 * O grupo que o cliente representa, com as empresas (só as ativas e a que
 * representa) e a distribuição padrão. Nulo quando o cliente não representa
 * um grupo com outra empresa (pedido de um cliente só).
 */
export async function economicGroupOf(
  customerId: string,
): Promise<EconomicGroup | null> {
  const store = getStore();
  const head = await store.get("parties", customerId);
  if (!head) return null;
  const code = headCode(head);
  if (!code) return null;
  const members = await listColumns(
    store,
    "parties",
    ["name", "taxId", "sankhyaCode", "active", "economicGroupName"],
    { filter: { type: "customer", economicGroupCode: code } },
  );
  const others = members
    .filter((m) => m.active && m.id !== head.id && m.sankhyaCode !== code)
    .sort((a, b) => a.name.localeCompare(b.name, "pt"));
  if (!others.length) return null;
  const company = (
    p: Pick<Party, "id" | "name" | "taxId" | "sankhyaCode">,
    isHead: boolean,
  ): GroupCompany => ({
    id: p.id,
    name: p.name,
    taxId: p.taxId ?? null,
    code: p.sankhyaCode ?? null,
    head: isHead,
  });
  const companies = [
    company(head, true),
    ...others.map((o) => company(o, false)),
  ];
  const ids = new Set(companies.map((c) => c.id));
  const rows = await store.list("economic_group_shares", {
    filter: { groupCode: code },
  });
  const shares: Record<string, number> = {};
  for (const r of rows)
    if (ids.has(r.customerId) && Number.isFinite(r.percent))
      shares[r.customerId] = r.percent;
  return {
    code,
    name: head.economicGroupName || head.name,
    companies,
    shares,
  };
}

/** As empresas do grupo que o cliente representa (ids), com ele. */
export async function groupCompanyIds(
  customerId: string,
): Promise<Set<string>> {
  const group = await economicGroupOf(customerId);
  return new Set(group ? group.companies.map((c) => c.id) : []);
}

/**
 * Grava a distribuição padrão do grupo (percentuais que somam 100, só das
 * empresas do grupo). Troca a anterior inteira.
 */
export async function saveGroupShares(
  user: User,
  customerId: string,
  shares: Record<string, number>,
): Promise<EconomicGroup> {
  const group = await economicGroupOf(customerId);
  if (!group) throw new Error("not_a_group");
  const ids = new Set(group.companies.map((c) => c.id));
  const entries = Object.entries(shares).filter(
    ([id, pct]) => ids.has(id) && Number.isFinite(pct) && pct > 0,
  );
  if (entries.some(([, pct]) => pct > 100)) throw new Error("invalid_percent");
  const total = entries.reduce((s, [, pct]) => s + pct, 0);
  if (Math.abs(total - 100) > 0.01) throw new Error("percent_total");
  const store = getStore();
  const old = await store.list("economic_group_shares", {
    filter: { groupCode: group.code },
  });
  for (const r of old) await store.remove("economic_group_shares", r.id);
  for (const [id, pct] of entries)
    await store.create("economic_group_shares", {
      groupCode: group.code,
      customerId: id,
      percent: Math.round(pct * 100) / 100,
      updatedByUserId: user.id,
    });
  return { ...group, shares: Object.fromEntries(entries) };
}
