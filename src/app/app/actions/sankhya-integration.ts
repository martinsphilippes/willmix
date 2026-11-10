"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import { audit } from "@/lib/services/audit";
import {
  SankhyaError,
  cancelNotes,
  createNote,
  pingSankhya,
  resetSankhyaTokenCache,
} from "@/lib/integrations/sankhya-client";
import {
  SANKHYA_SECRET_FIELDS,
  SankhyaSettingsError,
  getSankhyaErpSettings,
  saveSankhyaCredentials,
  saveSankhyaErpSettings,
} from "@/lib/integrations/sankhya-settings";
import { checkTestOrder } from "@/lib/integrations/sankhya-test-order";
import { fetchImportSet } from "@/lib/integrations/sankhya-sample";
import { importSankhyaSet } from "@/lib/integrations/sankhya-import";
import {
  resetFullLoad,
  runFullLoad,
} from "@/lib/integrations/sankhya-full-load";
import { FULL_LOAD_ENTITIES } from "@/lib/integrations/sankhya-mapping";
import { getStore } from "@/lib/db";
import { requireUser, str } from "./helpers";

/*
 * Configurações → Integração Sankhya (só o administrador; docs/SANKHYA.md):
 * gravar as credenciais (cifradas) e os códigos do ERP, testar a autenticação
 * e enviar um pedido/cotação de teste. Volta para a tela com o resultado na
 * URL (?it=…) ou com o código e o texto do erro (?error=…&detail=…). Os
 * segredos nunca vão para a URL nem para a auditoria.
 */

const BACK = "/app/settings/sankhya";

/** Volta para a aba Integração; "at" diz em qual parte mostrar o aviso. */
function back(params: Record<string, string>, hash: string) {
  return `${BACK}?${new URLSearchParams({ ...params, at: hash }).toString()}#${hash}`;
}

function failure(error: unknown, hash: string) {
  if (error instanceof SankhyaError)
    return back(
      { error: error.code, detail: error.detail.slice(0, 600) },
      hash,
    );
  if (error instanceof SankhyaSettingsError)
    return back({ error: error.code }, hash);
  if (error instanceof z.ZodError)
    return back(
      {
        error: "invalid_input",
        detail: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")
          .slice(0, 600),
      },
      hash,
    );
  console.error("[sankhya-integration]", error);
  return back({ error: "unexpected" }, hash);
}

async function admin() {
  const user = await requireUser();
  assertRole(user, ["admin"]);
  return user;
}

const secret = z.string().trim().max(4000);

const credentialsSchema = z.object({
  environment: z.enum(["production", "sandbox"]),
  clientId: secret,
  clientSecret: secret,
  xToken: secret,
  clear: z.array(z.enum(SANKHYA_SECRET_FIELDS)),
});

/** Grava as credenciais (campo vazio mantém o valor atual). */
export async function saveSankhyaCredentialsAction(form: FormData) {
  const user = await admin();
  let target: string;
  try {
    const input = credentialsSchema.parse({
      environment: str(form, "environment") || "production",
      clientId: str(form, "clientId"),
      clientSecret: str(form, "clientSecret"),
      xToken: str(form, "xToken"),
      clear: form.getAll("clear").map(String),
    });
    await saveSankhyaCredentials(input, user.id);
    resetSankhyaTokenCache();
    const changed = SANKHYA_SECRET_FIELDS.filter((f) => input[f]);
    await audit(
      user,
      "sankhya.credentials",
      "sankhya",
      "credentials",
      `Credenciais do Sankhya (${input.environment})`,
      null,
      // Só os nomes dos campos: nunca os valores.
      { environment: input.environment, changed, cleared: input.clear },
    );
    target = back({ it: "credentials" }, "credentials");
  } catch (error) {
    target = failure(error, "credentials");
  }
  redirect(target);
}

const code = (max = 999999) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().min(0).max(max).nullable(),
  );

/*
 * Códigos do ERP para os pedidos. Pelas respostas da Wellmix, o volume é
 * sempre UN e as TOPs ficam em Configurações → Processos (as regras gravam
 * topOrder/topQuote); aqui só o que ainda se escolhe. O que não vem no
 * formulário continua como estava gravado.
 */
const erpSchema = z.object({
  codEmp: code(9999),
  codTipVenda: code(),
  codVend: code(),
  codNat: code(999999999),
  codCenCus: code(999999999),
  codProj: code(999999999),
  currency: z.enum(["USD", "BRL", "CNY", "EUR"]),
  codMoeda: code(9999),
  erpNumberField: z.enum(["NUNOTA", "NUMNOTA"]),
});

/** Grava os códigos do ERP para os pedidos. */
export async function saveSankhyaErpAction(form: FormData) {
  const user = await admin();
  let target: string;
  try {
    const input = erpSchema.parse({
      codEmp: str(form, "codEmp"),
      codTipVenda: str(form, "codTipVenda"),
      codVend: str(form, "codVend"),
      codNat: str(form, "codNat"),
      codCenCus: str(form, "codCenCus"),
      codProj: str(form, "codProj"),
      currency: str(form, "currency") || "USD",
      codMoeda: str(form, "codMoeda"),
      erpNumberField: str(form, "erpNumberField") || "NUNOTA",
    });
    const before = await getSankhyaErpSettings();
    const { updatedAt: _u, updatedBy: _b, ...rest } = before;
    void _u;
    void _b;
    await saveSankhyaErpSettings(
      { ...rest, ...input, volumeMode: "fixed", codVol: "UN" },
      user.id,
    );
    await audit(
      user,
      "sankhya.erp",
      "sankhya",
      "erp",
      "Códigos do Sankhya para os pedidos",
      before,
      input,
    );
    target = back({ it: "erp" }, "erp");
  } catch (error) {
    target = failure(error, "erp");
  }
  redirect(target);
}

/** Teste de autenticação: token novo + leitura das empresas. */
export async function testSankhyaAuthAction() {
  await admin();
  let target: string;
  try {
    resetSankhyaTokenCache();
    const ping = await pingSankhya();
    target = back(
      {
        it: "auth",
        base: ping.baseUrl,
        ms: String(ping.ms),
        authMs: String(ping.authMs),
        expires: String(ping.expiresIn),
        tokenLength: String(ping.tokenLength),
        total: String(ping.totalCompanies),
        companies: JSON.stringify(ping.companies).slice(0, 1500),
      },
      "auth",
    );
  } catch (error) {
    target = failure(error, "auth");
  }
  redirect(target);
}

const testOrderSchema = z.object({
  kind: z.enum(["order", "quote"]),
  codParc: z.coerce.number().int().positive(),
  codProd: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive().max(10_000_000),
  unitPrice: z.coerce.number().min(0).max(1_000_000_000),
});

/**
 * Pedido ou cotação de teste no ERP com os códigos gravados: confere parceiro,
 * produto e TOP no Sankhya, inclui a nota (CACSP.incluirNota) e volta com o
 * NUNOTA para a tela mostrar o que ficou gravado.
 */
export async function sankhyaTestOrderAction(form: FormData) {
  const user = await admin();
  let target: string;
  try {
    target = await sendTestOrder(user, form);
  } catch (error) {
    target = failure(error, "order");
  }
  redirect(target);
}

async function sendTestOrder(
  user: Awaited<ReturnType<typeof admin>>,
  form: FormData,
): Promise<string> {
  const input = testOrderSchema.parse({
    kind: str(form, "kind") || "order",
    codParc: str(form, "codParc"),
    codProd: str(form, "codProd"),
    quantity: str(form, "quantity").replace(",", "."),
    unitPrice: str(form, "unitPrice").replace(",", "."),
  });
  const check = await checkTestOrder(await getSankhyaErpSettings(), input);
  if (!check.ok)
    return back({ error: check.code, detail: check.detail }, "order");
  const { nunota } = await createNote(check.note);
  await audit(
    user,
    "sankhya.note.test",
    "sankhya",
    nunota ?? "",
    `Sankhya teste de ${input.kind === "order" ? "pedido" : "cotação"}: NUNOTA ${nunota ?? "?"}`,
    null,
    check.note,
  );
  return back({ it: "order", nunota: nunota ?? "" }, "order");
}

const cancelSchema = z.object({
  nunota: z.string().regex(/^\d{1,12}$/),
  justification: z.string().trim().min(5).max(250),
});

/** Cancela no ERP a nota de teste (CACSP.cancelarNota). */
export async function sankhyaCancelTestAction(form: FormData) {
  const user = await admin();
  let target: string;
  try {
    const input = cancelSchema.parse({
      nunota: str(form, "nunota"),
      justification: str(form, "justification"),
    });
    await cancelNotes([input.nunota], input.justification);
    await audit(
      user,
      "sankhya.note.cancel",
      "sankhya",
      input.nunota,
      `Sankhya cancelamento do teste ${input.nunota}`,
      null,
      input,
    );
    target = back({ it: "cancelled", nunota: input.nunota }, "order");
  } catch (error) {
    target = failure(error, "order");
  }
  redirect(target);
}

/**
 * Carga do Sankhya: grava no portal as N últimas notas de importação (1 a 5)
 * com parceiros, produtos, linhas e financeiro (sankhya-import.ts). Volta para
 * a aba Carga com o resultado de cada registro.
 */
export async function sankhyaImportSampleAction(form: FormData) {
  const user = await admin();
  let target: string;
  try {
    const n = z.coerce
      .number()
      .int()
      .min(1)
      .max(5)
      .parse(str(form, "n") || "1");
    const lines = await importSankhyaSet(
      user,
      await fetchImportSet(n),
      await getSankhyaErpSettings(),
    );
    const summary = lines.slice(0, 80).map((l) => ({
      e: l.entity,
      c: l.code,
      o: l.outcome,
      i: l.id,
      l: l.label.slice(0, 60),
      r: l.reason,
    }));
    target = `${BACK}?${new URLSearchParams({ tab: "load", n: String(n), imported: JSON.stringify(summary) }).toString()}#imported`;
  } catch (error) {
    target = `${BACK}?${new URLSearchParams({
      tab: "load",
      error:
        error instanceof SankhyaError ? error.code : "sankhya_import_failed",
      detail: (error instanceof SankhyaError
        ? error.detail
        : error instanceof Error
          ? error.message
          : String(error)
      ).slice(0, 600),
    }).toString()}#imported`;
    if (!(error instanceof SankhyaError))
      console.error("[sankhya-import]", error);
  }
  redirect(target);
}

const fullLoadSchema = z.object({
  entity: z.enum(FULL_LOAD_ENTITIES),
  reset: z.boolean(),
  auto: z.boolean(),
});

/**
 * Carga completa de um cadastro (condições de pagamento, fornecedores e
 * clientes, produtos): processa lotes por até ~40 s e volta com o progresso;
 * chamar de novo continua de onde parou. "Recomeçar" zera o cursor.
 */
export async function sankhyaFullLoadAction(form: FormData) {
  const user = await admin();
  let target: string;
  const hash = "full";
  try {
    const input = fullLoadSchema.parse({
      entity: str(form, "entity"),
      reset: str(form, "reset") === "1",
      auto: str(form, "auto") === "1",
    });
    if (input.reset) {
      await resetFullLoad(input.entity);
      target = `${BACK}?tab=load&full=${input.entity}#${hash}`;
    } else {
      const { progress } = await runFullLoad(user, input.entity);
      target = `${BACK}?${new URLSearchParams({
        tab: "load",
        full: input.entity,
        ran: progress.done ? "done" : "partial",
        // "Até o fim": a tela envia de novo sozinha enquanto faltar.
        ...(input.auto && !progress.done ? { auto: "1" } : {}),
      }).toString()}#${hash}`;
    }
  } catch (error) {
    if (!(error instanceof SankhyaError) && !(error instanceof z.ZodError))
      console.error("[sankhya-full-load]", error);
    target = `${BACK}?${new URLSearchParams({
      tab: "load",
      error:
        error instanceof SankhyaError ? error.code : "sankhya_import_failed",
      detail: (error instanceof SankhyaError
        ? error.detail
        : error instanceof Error
          ? error.message
          : String(error)
      ).slice(0, 600),
    }).toString()}#${hash}`;
  }
  redirect(target);
}

const conditionSchema = z.object({
  id: z.string().max(64).optional(),
  code: z.coerce.number().int().min(0).max(99999999),
  name: z.string().trim().min(1).max(160),
  active: z.boolean(),
  notes: z.string().trim().max(2000),
});

const CONDITIONS = "/app/settings/sankhya?tab=payment";

/**
 * Condição de pagamento (tabela igual à TGFTPV do Sankhya; compra e venda):
 * inclui ou altera no portal. O envio ao Sankhya entra com a sincronização.
 */
export async function savePaymentConditionAction(form: FormData) {
  const user = await admin();
  let target: string;
  try {
    const input = conditionSchema.parse({
      id: str(form, "id") || undefined,
      code: str(form, "code"),
      name: str(form, "name"),
      active: str(form, "active") === "1",
      notes: str(form, "notes"),
    });
    const store = getStore();
    const [sameCode] = await store.list("payment_conditions", {
      filter: { code: input.code },
      limit: 1,
    });
    if (sameCode && sameCode.id !== input.id) {
      target = `${CONDITIONS}&error=duplicate_code&detail=${input.code}#conditions`;
    } else if (input.id) {
      const before = await store.get("payment_conditions", input.id);
      if (!before) throw new z.ZodError([]);
      const after = await store.update("payment_conditions", input.id, {
        code: input.code,
        name: input.name,
        active: input.active,
        notes: input.notes || null,
        updatedByUserId: user.id,
      });
      await audit(
        user,
        "payment_condition.update",
        "payment_condition",
        input.id,
        `Condição de pagamento ${input.code} ${input.name}`,
        before,
        after,
      );
      target = `${CONDITIONS}&saved=${input.code}#conditions`;
    } else {
      const created = await store.create("payment_conditions", {
        code: input.code,
        name: input.name,
        active: input.active,
        notes: input.notes || null,
        source: "portal",
        updatedByUserId: user.id,
      });
      await audit(
        user,
        "payment_condition.create",
        "payment_condition",
        created.id,
        `Condição de pagamento ${input.code} ${input.name}`,
        null,
        created,
      );
      target = `${CONDITIONS}&saved=${input.code}#conditions`;
    }
  } catch (error) {
    target = `${CONDITIONS}&error=invalid_input&detail=${encodeURIComponent(
      error instanceof z.ZodError
        ? error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")
        : String(error),
    ).slice(0, 600)}#conditions`;
  }
  redirect(target);
}
