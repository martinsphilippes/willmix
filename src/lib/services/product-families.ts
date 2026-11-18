import "server-only";

import {
  getStore,
  type ProductFamilyRow,
  type ProductLine,
  type User,
} from "@/lib/db";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  byNameAndCode,
  familiesOfTree,
  familyCodeOf,
  groupCode,
  servesFamilies,
  type GroupNode,
} from "@/lib/party-families";
import { audit } from "./audit";
import { familyKey } from "./product-origin";
import {
  resetSankhyaProductFamilies,
  sankhyaProductGroups,
} from "./sankhya-product-families";

/*
 * Grupo de produto (família) (dono, 18/11/2026; docs/PARTNER_FAMILIES.md).
 *
 * - O cadastro (`product_families`) é o 1º nível da árvore de grupos do
 *   Sankhya (TGFGRU), a mesma família da Nova solicitação, gravada com o
 *   código do Sankhya. Vem do Sankhya: sozinho quando está vazio (como os
 *   resumos dos pedidos) e pelo "Atualizar do Sankhya" do administrador.
 *   Família que sumiu de lá fica inativa; nada é apagado.
 * - A família de cada linha (`product_lines.familyCode`) é calculada da
 *   mesma árvore (sobe até o topo).
 * - O parceiro (Fornecedor, Trading, Supplier, Factory) marca as famílias
 *   que atende (`party_families`): entra na cotação de compra das linhas
 *   delas (src/lib/services/purchase-quote.ts).
 */

export class PartyFamilyError extends Error {
  constructor(
    readonly code:
      | "forbidden"
      | "not_found"
      | "family_party_type"
      | "family_unknown"
      | "families_sankhya_unavailable",
  ) {
    super(code);
  }
}

/** Famílias do cadastro, por nome e código (com `includeInactive`, todas). */
export async function listProductFamilies(
  options: { includeInactive?: boolean } = {},
): Promise<ProductFamilyRow[]> {
  const rows = await getStore()
    .list("product_families")
    .catch(() => [] as ProductFamilyRow[]);
  return rows
    .filter((f) => options.includeInactive || f.active)
    .sort(byNameAndCode);
}

/** Resultado de uma atualização do cadastro pelo Sankhya. */
export interface FamilySyncResult {
  families: number;
  created: number;
  updated: number;
  inactivated: number;
  lines: number;
  converted: number;
}

/**
 * Atualiza o cadastro de famílias e a família de cada linha pela árvore de
 * grupos do Sankhya. Sem o Sankhya (não configurado ou fora do ar): nulo, e
 * nada muda. Converte os vínculos antigos "Linhas atendidas"
 * (`supplier_lines`) em famílias atendidas, sem apagar os antigos.
 */
export async function syncProductFamilies(
  user: User | null,
  options: { fresh?: boolean } = {},
): Promise<FamilySyncResult | null> {
  if (options.fresh) resetSankhyaProductFamilies();
  const groups = await sankhyaProductGroups();
  if (!groups.size) return null;
  return applyFamilyTree(user, groups);
}

/** A árvore já lida: grava as famílias, a família das linhas e converte. */
export async function applyFamilyTree(
  user: User | null,
  groups: ReadonlyMap<string, GroupNode>,
): Promise<FamilySyncResult> {
  const store = getStore();
  const now = new Date().toISOString();
  const tree = familiesOfTree(groups);
  const current = await store
    .list("product_families")
    .catch(() => [] as ProductFamilyRow[]);
  const byCode = new Map(current.map((f) => [f.code, f]));
  let created = 0;
  let updated = 0;
  let inactivated = 0;
  for (const f of tree) {
    const nameKey = familyKey(f.name);
    const have = byCode.get(f.code);
    if (!have) {
      await store.create("product_families", {
        code: f.code,
        name: f.name,
        nameKey,
        active: true,
        syncedAt: now,
      });
      created++;
    } else if (
      have.name !== f.name ||
      !have.active ||
      have.nameKey !== nameKey
    ) {
      await store.update("product_families", have.id, {
        name: f.name,
        nameKey,
        active: true,
        syncedAt: now,
      });
      updated++;
    } else await store.update("product_families", have.id, { syncedAt: now });
  }
  // Família que não está mais na árvore: inativa (os vínculos ficam).
  const inTree = new Set(tree.map((f) => f.code));
  for (const f of current)
    if (f.active && !inTree.has(f.code)) {
      await store.update("product_families", f.id, { active: false });
      inactivated++;
    }
  // Família de cada linha, pela mesma árvore. Em lotes por família (~1 mil
  // linhas na carga do Sankhya: uma ida ao banco por lote, não por linha).
  const lines = await store.list("product_lines");
  const changes = new Map<string, string[]>();
  for (const line of lines) {
    const family = familyCodeOf(line.sankhyaCode, groups);
    if (!family || family === (line.familyCode ?? null)) continue;
    changes.set(family, [...(changes.get(family) ?? []), line.id]);
  }
  let changedLines = 0;
  for (const [family, ids] of changes)
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      if (store.updateWhere)
        await store.updateWhere(
          "product_lines",
          { id: chunk },
          { familyCode: family },
        );
      else
        for (const id of chunk)
          await store.update("product_lines", id, { familyCode: family });
      changedLines += chunk.length;
    }
  const converted = await convertLineLinks(
    user,
    new Map(
      lines.map((l) => [
        l.id,
        familyCodeOf(l.sankhyaCode, groups) ?? l.familyCode ?? null,
      ]),
    ),
  );
  await audit(
    user,
    "product_families.sync",
    "product_family",
    "sankhya",
    `Famílias do Sankhya: ${tree.length} (${created} novas, ${updated} alteradas, ${inactivated} inativadas); ${changedLines} linha(s) com a família; ${converted} vínculo(s) de linha convertido(s)`,
  );
  return {
    families: tree.length,
    created,
    updated,
    inactivated,
    lines: changedLines,
    converted,
  };
}

/**
 * Vínculos antigos fornecedor × linha (`supplier_lines`, "Linhas
 * atendidas"): cada um ainda não convertido vira o vínculo com a família da
 * linha (se ainda não existe) e fica marcado (`familyConvertedAt`). Converte
 * uma vez só: desmarcar a família depois não é desfeito por outra
 * atualização, e a cotação passa a seguir a família (a seção da tela). Nada
 * é apagado; o vínculo de linha sem família (sem grupo do Sankhya) não é
 * convertido e continua valendo na cotação como antes.
 */
async function convertLineLinks(
  user: User | null,
  lineFamily: ReadonlyMap<string, string | null>,
): Promise<number> {
  const store = getStore();
  const old = (await store.list("supplier_lines").catch(() => [])).filter(
    (row) => !row.familyConvertedAt,
  );
  if (!old.length) return 0;
  const links = await store.list("party_families").catch(() => []);
  const have = new Set(links.map((l) => `${l.partyId}|${l.familyCode}`));
  const now = new Date().toISOString();
  let converted = 0;
  for (const row of old) {
    const family = lineFamily.get(row.lineId);
    if (!family) continue;
    if (!have.has(`${row.supplierId}|${family}`)) {
      await store.create("party_families", {
        partyId: row.supplierId,
        familyCode: family,
        createdByUserId: row.createdByUserId ?? user?.id ?? null,
      });
      have.add(`${row.supplierId}|${family}`);
    }
    await store.update("supplier_lines", row.id, { familyConvertedAt: now });
    converted++;
  }
  return converted;
}

let lastAttempt = 0;
let pendingFill: Promise<void> | null = null;
const RETRY_MS = 10 * 60 * 1000;

/**
 * Cadastro vazio: carrega do Sankhya uma vez (autocorreção, como os resumos
 * dos pedidos). Sem o Sankhya, tenta de novo depois de 10 minutos.
 */
export async function ensureFamilyRegistry(): Promise<void> {
  const any = await getStore()
    .list("product_families", { limit: 1 })
    .catch(() => null);
  // Tabela ainda não publicada (esquema): nada a fazer.
  if (!any || any.length) return;
  if (Date.now() - lastAttempt < RETRY_MS) return;
  lastAttempt = Date.now();
  pendingFill ??= syncProductFamilies(null)
    .then(() => undefined)
    .catch((error) => {
      console.error("[families] carga do cadastro de famílias", error);
    })
    .finally(() => {
      pendingFill = null;
    });
  await pendingFill;
}

/**
 * Famílias das linhas (para a cotação de compra). Linha ainda sem a família
 * gravada: calculada pela árvore do Sankhya e gravada (autocorreção).
 */
export async function familyCodesForLines(
  lineIds: readonly string[],
): Promise<string[]> {
  const ids = [...new Set(lineIds.filter(Boolean))];
  if (!ids.length) return [];
  const store = getStore();
  const lines = (await store.list("product_lines", {
    filter: { id: ids },
  })) as ProductLine[];
  const codes = new Set<string>();
  const missing = lines.filter(
    (l) => !l.familyCode && groupCode(l.sankhyaCode),
  );
  for (const l of lines) if (l.familyCode) codes.add(l.familyCode);
  if (missing.length) {
    const groups = await sankhyaProductGroups().catch(
      () => new Map<string, GroupNode>(),
    );
    for (const l of missing) {
      const family = familyCodeOf(l.sankhyaCode, groups);
      if (!family) continue;
      codes.add(family);
      await store
        .update("product_lines", l.id, { familyCode: family })
        .catch(() => undefined);
    }
  }
  return [...codes].sort();
}

/** As famílias que o parceiro atende (códigos). */
export async function partyFamilyCodes(partyId: string): Promise<string[]> {
  const rows = await getStore()
    .list("party_families", { filter: { partyId } })
    .catch(() => []);
  return [...new Set(rows.map((r) => r.familyCode))].sort();
}

/**
 * Grava as famílias que o parceiro atende (troca a lista inteira). Mesma
 * regra das "Linhas atendidas": a equipe Wellmix com a tela Cadastros.
 */
export async function setPartyFamilies(
  user: User,
  partyId: string,
  familyCodes: readonly string[],
): Promise<{ added: number; removed: number }> {
  if (!isWellmix(user)) throw new PartyFamilyError("forbidden");
  assertScreen(user, "parties");
  const store = getStore();
  const party = await store.get("parties", partyId);
  if (!party) throw new PartyFamilyError("not_found");
  if (!servesFamilies(party.type))
    throw new PartyFamilyError("family_party_type");
  const wanted = new Set(familyCodes.map((c) => c.trim()).filter(Boolean));
  const known = new Set(
    (await listProductFamilies({ includeInactive: true })).map((f) => f.code),
  );
  for (const code of wanted)
    if (!known.has(code)) throw new PartyFamilyError("family_unknown");
  const current = await store.list("party_families", { filter: { partyId } });
  const before = [...new Set(current.map((r) => r.familyCode))].sort();
  let removed = 0;
  for (const row of current)
    if (!wanted.has(row.familyCode)) {
      await store.remove("party_families", row.id);
      removed++;
    }
  const have = new Set(current.map((r) => r.familyCode));
  let added = 0;
  for (const code of wanted)
    if (!have.has(code)) {
      await store.create("party_families", {
        partyId,
        familyCode: code,
        createdByUserId: user.id,
      });
      have.add(code);
      added++;
    }
  if (added || removed)
    await audit(
      user,
      "party.families",
      "party",
      partyId,
      `Grupos de produto (famílias) de ${party.name}: ${[...wanted].sort().join(", ") || "nenhum"}`,
      { families: before },
      { families: [...wanted].sort() },
    );
  return { added, removed };
}

/** Atualizar do Sankhya (botão do administrador). */
export async function refreshFamiliesFromSankhya(
  user: User,
): Promise<FamilySyncResult> {
  if (!isAdmin(user)) throw new PartyFamilyError("forbidden");
  const result = await syncProductFamilies(user, { fresh: true });
  if (!result) throw new PartyFamilyError("families_sankhya_unavailable");
  return result;
}
