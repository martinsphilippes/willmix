import "server-only";

import { getStore, type Material, type User } from "@/lib/db";
import { assertCan } from "@/lib/auth/function-access";
import {
  MATERIAL_SEED,
  materialKey,
  materialSeedId,
  type MaterialOption,
} from "@/lib/materials";
import { audit } from "./audit";

/*
 * Catálogo de materiais (dono, 21/11/2026; docs/PURCHASE_DEMAND.md, "Inner
 * do cliente, material do catálogo e Sem peso"). O fornecedor escolhe daqui
 * o material da ficha técnica na cotação; o servidor só aceita ids ativos.
 *
 * - Vazio, carrega sozinho a lista inicial (a Composição dos produtos do
 *   Sankhya, unificada em src/lib/materials.ts), uma vez.
 * - O Cadastro ajusta em Cadastros → Materiais: nome em pt, en e zh e
 *   ativo. Nada é apagado: o material desativado some da escolha, mas as
 *   fichas que já o citam continuam lendo o nome.
 */

export class MaterialError extends Error {}

const toOption = (m: Material): MaterialOption => ({
  id: m.id,
  namePt: m.namePt,
  nameEn: m.nameEn,
  nameZh: m.nameZh,
  nameKey: m.nameKey,
  active: m.active,
});

/** A lista inicial no banco, quando o catálogo está vazio (uma vez). */
async function seedWhenEmpty(rows: Material[]): Promise<Material[]> {
  if (rows.length) return rows;
  const store = getStore();
  const created: Material[] = [];
  for (const seed of MATERIAL_SEED) {
    try {
      created.push(
        await store.create("materials", {
          // Id fixo da lista inicial (o mesmo em todo banco).
          id: materialSeedId(seed.pt),
          namePt: seed.pt,
          nameEn: seed.en,
          nameZh: seed.zh,
          nameKey: materialKey(seed.pt),
          active: true,
          createdByUserId: null,
          updatedByUserId: null,
        }),
      );
    } catch {
      // Outra carga ao mesmo tempo (o índice único pelo nome segura a cópia).
    }
  }
  return created.length ? created : store.list("materials");
}

/**
 * O catálogo, por nome em português (com `includeInactive`, todos). Antes
 * do esquema publicado (sem a tabela), vazio.
 */
export async function listMaterials(
  options: { includeInactive?: boolean } = {},
): Promise<MaterialOption[]> {
  let rows: Material[];
  try {
    rows = await seedWhenEmpty(await getStore().list("materials"));
  } catch {
    return [];
  }
  return rows
    .filter((m) => options.includeInactive || m.active)
    .map(toOption)
    .sort((a, b) => a.namePt.localeCompare(b.namePt, "pt"));
}

/** Id → material (todos, para ler fichas que citam um desativado). */
export async function materialCatalog(): Promise<Map<string, MaterialOption>> {
  const all = await listMaterials({ includeInactive: true });
  return new Map(all.map((m) => [m.id, m]));
}

/**
 * Confere a escolha do fornecedor: só ids ativos do catálogo, sem repetir,
 * na ordem da escolha. Qualquer outro valor é recusado (não vira texto).
 */
export function checkMaterialIds(
  ids: readonly string[],
  catalog: ReadonlyMap<string, MaterialOption>,
): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const m = catalog.get(id);
    if (!m || !m.active) throw new MaterialError("material_not_in_catalog");
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export interface MaterialInput {
  namePt: string;
  nameEn: string;
  nameZh: string;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 80);

function checkInput(input: MaterialInput): MaterialInput {
  const out = {
    namePt: clean(input.namePt),
    nameEn: clean(input.nameEn),
    nameZh: clean(input.nameZh),
  };
  if (!out.namePt || !out.nameEn || !out.nameZh)
    throw new MaterialError("material_names_required");
  return out;
}

async function assertUniqueName(namePt: string, exceptId: string | null) {
  const key = materialKey(namePt);
  const all = await getStore().list("materials");
  if (all.some((m) => m.nameKey === key && m.id !== exceptId))
    throw new MaterialError("material_duplicate");
  return key;
}

export async function createMaterial(
  user: User,
  input: MaterialInput,
): Promise<Material> {
  assertCan(user, "materials.manage");
  const data = checkInput(input);
  // Garante a lista inicial antes do primeiro material à mão.
  await listMaterials();
  const nameKey = await assertUniqueName(data.namePt, null);
  const created = await getStore().create("materials", {
    ...data,
    nameKey,
    active: true,
    createdByUserId: user.id,
    updatedByUserId: user.id,
  });
  await audit(
    user,
    "material.create",
    "material",
    created.id,
    `Material incluído no catálogo: ${data.namePt} / ${data.nameEn} / ${data.nameZh}`,
    null,
    data,
  );
  return created;
}

export async function updateMaterial(
  user: User,
  id: string,
  input: MaterialInput,
): Promise<Material> {
  assertCan(user, "materials.manage");
  const store = getStore();
  const before = await store.get("materials", id);
  if (!before) throw new MaterialError("material_not_found");
  const data = checkInput(input);
  const nameKey = await assertUniqueName(data.namePt, id);
  const saved = await store.update("materials", id, {
    ...data,
    nameKey,
    updatedByUserId: user.id,
  });
  await audit(
    user,
    "material.update",
    "material",
    id,
    `Material alterado: ${before.namePt} → ${data.namePt}`,
    { namePt: before.namePt, nameEn: before.nameEn, nameZh: before.nameZh },
    data,
  );
  return saved;
}

export async function setMaterialActive(
  user: User,
  id: string,
  active: boolean,
): Promise<Material> {
  assertCan(user, "materials.manage");
  const store = getStore();
  const before = await store.get("materials", id);
  if (!before) throw new MaterialError("material_not_found");
  const saved = await store.update("materials", id, {
    active,
    updatedByUserId: user.id,
  });
  await audit(
    user,
    active ? "material.activate" : "material.deactivate",
    "material",
    id,
    `Material ${active ? "reativado" : "desativado"}: ${before.namePt}`,
    { active: before.active },
    { active },
  );
  return saved;
}

/**
 * Fichas técnicas com material de texto livre, de antes do catálogo (ou
 * citando um material desativado): o Cadastro revisa. Nada é apagado.
 */
export async function sheetsToReviewMaterial(): Promise<
  Array<{ sheetId: string; productId: string; supplierId: string; material: string }>
> {
  const [sheets, catalog] = await Promise.all([
    getStore()
      .list("supplier_product_sheets")
      .catch(() => []),
    materialCatalog(),
  ]);
  return sheets
    .filter((s) => {
      const ids = s.data?.materialIds;
      if (!ids?.length) return !!s.data?.material?.trim();
      return ids.some((id) => !catalog.get(id)?.active);
    })
    .map((s) => ({
      sheetId: s.id,
      productId: s.productId,
      supplierId: s.supplierId,
      material: s.data.material,
    }));
}
