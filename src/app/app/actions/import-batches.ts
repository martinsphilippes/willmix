"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import {
  applyImportBatch,
  cancelImportBatch,
  createImportBatch,
  IMPORT_ENTITIES,
  setBatchMapping,
  TARGET_FIELDS,
} from "@/lib/services/import-batches";
import { requireUser, run, str } from "./helpers";

/*
 * Importação de planilhas (XLSX/CSV) em lote: upload → mapeamento → conferência
 * → importação. O serviço audita cada passo; aqui só validação e redirecionamento.
 */

const entitySchema = z.enum(IMPORT_ENTITIES);

export async function createImportBatchAction(form: FormData) {
  const user = await requireUser();
  const entity = str(form, "entity");
  await run(`/app/import?entity=${entity}`, async () => {
    assertWellmix(user);
    const parsed = z
      .object({ entity: entitySchema, sheet: z.string().max(80).nullable() })
      .parse({ entity, sheet: str(form, "sheet") || null });
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0)
      throw new Error("file_required");
    const batch = await createImportBatch(
      user,
      parsed.entity,
      file,
      parsed.sheet ?? undefined,
    );
    return `/app/import/${batch.id}`;
  });
}

/**
 * Mapeamento: cada coluna vem como par h_<i> (cabeçalho) e f_<i> (campo destino).
 * Chaves "__defaultLineId" e "__defaultCurrency" são opções do lote, não colunas.
 */
export async function setBatchMappingAction(form: FormData) {
  const user = await requireUser();
  const batchId = str(form, "batchId");
  await run(`/app/import/${batchId}`, async () => {
    assertWellmix(user);
    const entity = entitySchema.parse(str(form, "entity"));
    const allowed = new Set(TARGET_FIELDS[entity].map((f) => f.key));
    const mapping: Record<string, string> = {};
    const used = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const header = form.get(`h_${i}`);
      if (typeof header !== "string") break;
      const target = str(form, `f_${i}`);
      if (!target || !allowed.has(target) || used.has(target)) continue;
      used.add(target);
      mapping[header] = target;
    }
    if (entity === "products") {
      const lineId = str(form, "__defaultLineId");
      if (lineId) mapping.__defaultLineId = lineId;
      const currency = str(form, "__defaultCurrency").toUpperCase();
      if (/^[A-Z]{3}$/.test(currency)) mapping.__defaultCurrency = currency;
    } else if (entity === "sourcing_items") {
      const currency = str(form, "__defaultCurrency").toUpperCase();
      if (/^[A-Z]{3}$/.test(currency)) mapping.__defaultCurrency = currency;
    }
    if (!Object.values(mapping).includes("name"))
      throw new Error("missing_name");
    await setBatchMapping(user, batchId, mapping);
    return `/app/import/${batchId}`;
  });
}

/** Decisão por linha: d_<índice> = create | update | skip (padrão = sugerido). */
export async function applyImportBatchAction(form: FormData) {
  const user = await requireUser();
  const batchId = str(form, "batchId");
  await run(`/app/import/${batchId}`, async () => {
    assertWellmix(user);
    const decisions: Record<string, string> = {};
    const decisionSchema = z.enum(["create", "update", "skip"]);
    for (const [key, value] of form.entries()) {
      if (!key.startsWith("d_") || typeof value !== "string") continue;
      const decision = decisionSchema.safeParse(value);
      if (!decision.success) throw new Error("invalid_decision");
      decisions[key.slice(2)] = decision.data;
    }
    await applyImportBatch(user, batchId, decisions);
    return `/app/import/${batchId}`;
  });
}

export async function cancelImportBatchAction(form: FormData) {
  const user = await requireUser();
  const batchId = str(form, "batchId");
  await run(`/app/import/${batchId}`, async () => {
    assertWellmix(user);
    await cancelImportBatch(user, batchId);
    return "/app/import";
  });
}
