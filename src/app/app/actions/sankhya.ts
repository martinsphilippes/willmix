"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import { audit } from "@/lib/services/audit";
import {
  SankhyaError,
  cancelNotes,
  createNote,
  datasetSave,
  pingSankhya,
  upsertNoteItems,
} from "@/lib/integrations/sankhya-client";
import { requireUser, str } from "./helpers";

/*
 * Ações do Sankhya (Configurações → Sankhya, só o administrador). Escrevem no
 * ERP real: cada envio fica na auditoria. Volta para a tela com o resultado
 * (?sk=ok&…) ou com o código e o texto do Sankhya (?error=…&detail=…).
 */

const BACK = "/app/settings/sankhya";

/** Volta para a aba Explorar (a aba Integração tem as próprias ações). */
function back(params: Record<string, string>, hash = "") {
  return `${BACK}?${new URLSearchParams({ tab: "explore", ...params }).toString()}${hash}`;
}

function failure(error: unknown, hash: string) {
  if (error instanceof SankhyaError)
    return back(
      { error: error.code, detail: error.detail.slice(0, 600) },
      hash,
    );
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return back(
      {
        error: "invalid_input",
        detail: (error instanceof z.ZodError
          ? error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : error.message
        ).slice(0, 600),
      },
      hash,
    );
  console.error("[sankhya]", error);
  return back({ error: "unexpected" }, hash);
}

async function admin() {
  const user = await requireUser();
  assertRole(user, ["admin"]);
  return user;
}

const scalar = z.union([z.string(), z.number(), z.null()]);
const record = z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_.]*$/), scalar);
const jsonOf = <T extends z.ZodTypeAny>(schema: T, raw: string) =>
  schema.parse(raw ? JSON.parse(raw) : undefined) as z.infer<T>;

/** Testa a conexão: autentica e lê as empresas. */
export async function testSankhyaAction() {
  await admin();
  let target: string;
  try {
    const ping = await pingSankhya();
    target = back(
      {
        sk: "ping",
        ms: String(ping.ms),
        base: ping.baseUrl,
        companies: ping.companies
          .map((c) => `${c.CODEMP ?? ""} ${c.NOMEFANTASIA ?? ""}`.trim())
          .join(" · ")
          .slice(0, 300),
      },
      "#status",
    );
  } catch (error) {
    target = failure(error, "#status");
  }
  redirect(target);
}

const saveSchema = z.object({
  entity: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,79}$/),
  values: record.refine((v) => Object.keys(v).length > 0),
  pk: record.optional(),
});

/** DatasetSP.save: inclui (sem chave) ou altera (com chave) um registro. */
export async function sankhyaSaveAction(form: FormData) {
  const user = await admin();
  let target: string;
  try {
    const input = saveSchema.parse({
      entity: str(form, "entity"),
      values: jsonOf(z.unknown(), str(form, "values")),
      pk: str(form, "pk") ? jsonOf(z.unknown(), str(form, "pk")) : undefined,
    });
    const pk = input.pk
      ? (Object.fromEntries(
          Object.entries(input.pk).filter(([, v]) => v != null),
        ) as Record<string, string | number>)
      : undefined;
    const result = await datasetSave({ ...input, pk });
    await audit(
      user,
      pk ? "sankhya.update" : "sankhya.create",
      "sankhya",
      input.entity,
      `Sankhya ${input.entity} ${pk ? JSON.stringify(pk) : "(novo)"}`,
      null,
      { entity: input.entity, pk: pk ?? null, values: input.values },
    );
    target = back(
      {
        sk: "saved",
        result: JSON.stringify(result.rows[0] ?? {}).slice(0, 600),
      },
      "#write",
    );
  } catch (error) {
    target = failure(error, "#write");
  }
  redirect(target);
}

const noteSchema = z.object({
  header: record,
  items: z.array(record).min(1).max(500),
  informPrice: z.boolean(),
});

/**
 * Pedido/orçamento/cotação (CACSP): sem NUNOTA inclui a nota; com NUNOTA,
 * inclui ou altera os itens (com SEQUENCIA, altera aquele item).
 */
export async function sankhyaNoteAction(form: FormData) {
  const user = await admin();
  let target: string;
  try {
    const input = noteSchema.parse({
      header: jsonOf(z.unknown(), str(form, "header")),
      items: jsonOf(z.unknown(), str(form, "items")),
      informPrice: str(form, "informPrice") === "1",
    });
    const nunota = input.header.NUNOTA;
    let resultNunota: string | null;
    if (nunota != null && String(nunota).trim()) {
      await upsertNoteItems(String(nunota), input.items, input.informPrice);
      resultNunota = String(nunota);
    } else {
      resultNunota = (await createNote(input)).nunota;
    }
    await audit(
      user,
      nunota ? "sankhya.note.items" : "sankhya.note.create",
      "sankhya",
      resultNunota ?? "",
      `Sankhya NUNOTA ${resultNunota ?? "?"}`,
      null,
      input,
    );
    target = back({ sk: "note", nunota: resultNunota ?? "" }, "#note");
  } catch (error) {
    target = failure(error, "#note");
  }
  redirect(target);
}

const cancelSchema = z.object({
  nunotas: z
    .array(z.string().regex(/^\d{1,12}$/))
    .min(1)
    .max(50),
  justification: z.string().min(5).max(250),
});

/** CACSP.cancelarNota (pedidos faturados não são cancelados pelo Sankhya). */
export async function sankhyaCancelAction(form: FormData) {
  const user = await admin();
  let target: string;
  try {
    const input = cancelSchema.parse({
      nunotas: str(form, "nunotas")
        .split(/[\s,;]+/)
        .filter(Boolean),
      justification: str(form, "justification"),
    });
    await cancelNotes(input.nunotas, input.justification);
    await audit(
      user,
      "sankhya.note.cancel",
      "sankhya",
      input.nunotas.join(","),
      `Sankhya cancelamento ${input.nunotas.join(",")}`,
      null,
      input,
    );
    target = back(
      { sk: "cancelled", nunota: input.nunotas.join(",") },
      "#cancel",
    );
  } catch (error) {
    target = failure(error, "#cancel");
  }
  redirect(target);
}
