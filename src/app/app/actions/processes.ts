"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import { audit } from "@/lib/services/audit";
import {
  PROCESS_EVENTS,
  SANKHYA_ACTIONS,
  STOCK_ACTIONS,
  type ProcessEventKey,
  type ProcessRule,
} from "@/lib/process-rules";
import { saveProcessRules } from "@/lib/services/process-engine";
import {
  getSankhyaErpSettings,
  saveSankhyaErpSettings,
} from "@/lib/integrations/sankhya-settings";
import { requireUser, str } from "./helpers";

/*
 * Configurações → Processos (só o administrador; docs/PROCESSES.md): grava as
 * regras status → estoque/Sankhya e liga ou desliga a execução no Sankhya
 * (desligada, as ações ficam só registradas como simuladas).
 */

const BACK = "/app/settings/sankhya?tab=process";

async function admin() {
  const user = await requireUser();
  assertRole(user, ["admin"]);
  return user;
}

const ruleSchema = z.object({
  event: z.enum(PROCESS_EVENTS as [ProcessEventKey, ...ProcessEventKey[]]),
  active: z.boolean(),
  stock: z.enum(STOCK_ACTIONS),
  sankhya: z.enum(SANKHYA_ACTIONS),
  top: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().min(1).max(99999999).nullable(),
  ),
  note: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
});

export async function saveProcessRulesAction(form: FormData) {
  const user = await admin();
  let target: string;
  try {
    const rules: ProcessRule[] = [];
    for (let i = 0; i < PROCESS_EVENTS.length; i++) {
      if (!form.has(`rules.${i}.event`)) continue;
      rules.push(
        ruleSchema.parse({
          event: str(form, `rules.${i}.event`),
          active: str(form, `rules.${i}.active`) === "1",
          stock: str(form, `rules.${i}.stock`) || "none",
          sankhya: str(form, `rules.${i}.sankhya`) || "none",
          top: str(form, `rules.${i}.top`),
          note: str(form, `rules.${i}.note`),
        }),
      );
    }
    if (new Set(rules.map((r) => r.event)).size !== rules.length)
      throw new z.ZodError([]);
    await saveProcessRules(user, rules);
    target = `${BACK}&saved=1#rules`;
  } catch (error) {
    target = `${BACK}&error=invalid_input&detail=${encodeURIComponent(
      error instanceof z.ZodError
        ? error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")
        : String(error),
    ).slice(0, 600)}#rules`;
  }
  redirect(target);
}

/** Liga/desliga a execução das ações no Sankhya (pedidos e notas). */
export async function setSankhyaExecutionAction(form: FormData) {
  const user = await admin();
  const enabled = str(form, "enabled") === "1";
  const before = await getSankhyaErpSettings();
  const { updatedAt: _u, updatedBy: _b, ...rest } = before;
  void _u;
  void _b;
  // A primeira vez que liga marca o início da sincronização: só o que for
  // criado a partir de agora vai como novo para o Sankhya.
  await saveSankhyaErpSettings(
    {
      ...rest,
      ordersEnabled: enabled,
      syncSince: rest.syncSince ?? (enabled ? new Date().toISOString() : null),
    },
    user.id,
  );
  await audit(
    user,
    "sankhya.execution",
    "sankhya",
    "erp",
    enabled
      ? "Execução no Sankhya ligada"
      : "Execução no Sankhya desligada (simulação)",
    { ordersEnabled: before.ordersEnabled },
    { ordersEnabled: enabled },
  );
  redirect(`${BACK}#execution`);
}

/** "Sincronizar agora": envia as pendências ao Sankhya (até ~40 s). */
export async function runSankhyaSyncAction() {
  const user = await admin();
  const { runSankhyaSync } = await import("@/lib/integrations/sankhya-sync");
  const run = await runSankhyaSync(user);
  redirect(
    `${BACK}&sync=${run.enabled ? "ran" : "off"}&done=${run.done}&errors=${run.errors}&remaining=${run.remaining}#sync`,
  );
}

const defaultsSchema = z.object({
  partnerDefaults: z.record(
    z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/),
    z.union([z.string().max(200), z.number()]),
  ),
  productDefaults: z.record(
    z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/),
    z.union([z.string().max(200), z.number()]),
  ),
});

/** Campos fixos ao incluir parceiro e produto no Sankhya (JSON). */
export async function saveSyncDefaultsAction(form: FormData) {
  const user = await admin();
  let target: string;
  try {
    const parse = (raw: string) => (raw.trim() ? JSON.parse(raw) : {});
    const input = defaultsSchema.parse({
      partnerDefaults: parse(str(form, "partnerDefaults")),
      productDefaults: parse(str(form, "productDefaults")),
    });
    const before = await getSankhyaErpSettings();
    const { updatedAt: _u, updatedBy: _b, ...rest } = before;
    void _u;
    void _b;
    await saveSankhyaErpSettings({ ...rest, ...input }, user.id);
    await audit(
      user,
      "sankhya.sync_defaults",
      "sankhya",
      "erp",
      "Campos fixos ao incluir no Sankhya",
      {
        partnerDefaults: before.partnerDefaults ?? {},
        productDefaults: before.productDefaults ?? {},
      },
      input,
    );
    target = `${BACK}&defaults=1#sync`;
  } catch (error) {
    target = `${BACK}&error=invalid_input&detail=${encodeURIComponent(
      error instanceof z.ZodError
        ? error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")
        : error instanceof Error
          ? error.message
          : String(error),
    ).slice(0, 600)}#sync`;
  }
  redirect(target);
}
