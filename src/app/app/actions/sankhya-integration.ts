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

const erpSchema = z.object({
  codEmp: code(9999),
  topOrder: code(),
  topQuote: code(),
  codTipVenda: code(),
  paymentFromSupplier: z.boolean(),
  codVend: code(),
  codLocal: code(99999999),
  volumeMode: z.enum(["product", "fixed"]),
  codVol: z
    .string()
    .trim()
    .max(6)
    .regex(/^[A-Za-z0-9]*$/),
  autoLink: z.boolean(),
});

/** Grava as respostas das 5 perguntas (códigos do ERP para os pedidos). */
export async function saveSankhyaErpAction(form: FormData) {
  const user = await admin();
  let target: string;
  try {
    const input = erpSchema.parse({
      codEmp: str(form, "codEmp"),
      topOrder: str(form, "topOrder"),
      topQuote: str(form, "topQuote"),
      codTipVenda: str(form, "codTipVenda"),
      paymentFromSupplier: str(form, "paymentFromSupplier") === "1",
      codVend: str(form, "codVend"),
      codLocal: str(form, "codLocal"),
      volumeMode: str(form, "volumeMode") || "product",
      codVol: str(form, "codVol").toUpperCase(),
      autoLink: str(form, "autoLink") === "1",
    });
    const before = await getSankhyaErpSettings();
    // O envio automático dos pedidos do portal ainda não está na tela: mantém.
    await saveSankhyaErpSettings(
      { ...input, ordersEnabled: before.ordersEnabled },
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
    const lines = await importSankhyaSet(user, await fetchImportSet(n));
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
