"use server";

import { ZodError, z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { parseNumberInput } from "@/lib/number-input";
import { audit } from "@/lib/services/audit";
import { getSettings, setSetting } from "@/lib/settings";
import {
  superplanParams,
  type SuperplanBusinessType,
  type SuperplanExpense,
  type SuperplanParams,
} from "@/lib/superplan";
import { requireUser, run, str } from "./helpers";

/*
 * Parâmetros do Superplan (docs/SUPERPLAN.md): tabela de tipos de negócio,
 * despesas padrão por container, fretes, câmbio, folga da embalagem no peso,
 * fatores de preço e impostos da venda. Só o administrador grava. Tudo é
 * conferido antes de gravar (um valor inválido não deixa metade salva) e a
 * recusa aponta o campo. Linha sem nome sai da tabela; a linha vazia do fim
 * cria uma nova. O antes e o depois ficam na auditoria: nada se perde.
 */

const BACK = "/app/superplan#parametros";
/** Linhas por tabela que o formulário pode mandar (a tela manda as atuais + 1). */
const MAX_ROWS = 200;

/** Chave de uma despesa (thc, ce, item11...). */
const EXPENSE_KEY = /^[A-Za-z0-9_-]{1,40}$/;

/** Número digitado (vírgula ou ponto), dentro do intervalo. */
const amount = (min: number, max: number, opts: { int?: boolean } = {}) =>
  z.string().transform((raw, ctx) => {
    const n = parseNumberInput(raw, opts);
    if (n === null || Number.isNaN(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message: "invalid_number" });
      return z.NEVER;
    }
    return n;
  });

const count = (form: FormData, key: string) => {
  const n = Number(str(form, key));
  return Number.isInteger(n) && n >= 0 ? Math.min(n, MAX_ROWS) : 0;
};

export async function saveSuperplanParamsAction(form: FormData) {
  const user = await requireUser();
  await run(BACK, async () => {
    // Os parâmetros mudam o preço mínimo de todos os produtos: só o
    // administrador grava, como os tributos da importação (Configurações).
    assertRole(user, ["admin"]);
    assertScreen(user, "superplan");

    const issues: z.core.$ZodIssue[] = [];
    const read = <T>(name: string, schema: z.ZodType<T>): T | null => {
      const result = schema.safeParse(str(form, name));
      if (result.success) return result.data;
      issues.push(
        ...result.error.issues.map((issue) => ({
          ...issue,
          path: [name, ...issue.path],
        })),
      );
      return null;
    };
    const fail = (name: string) =>
      issues.push({
        code: "custom",
        message: "invalid",
        path: [name],
        input: str(form, name),
      });

    // Tipos de negócio: nome vazio = linha fora (remoção ou linha nova vazia).
    const businessTypes: SuperplanBusinessType[] = [];
    const names = new Set<string>();
    for (let i = 0; i < count(form, "typesCount"); i++) {
      const p = `types.${i}`;
      const name = str(form, `${p}.name`).replace(/\s+/g, " ").slice(0, 120);
      if (!name) continue;
      if (names.has(name.toLocaleLowerCase("pt-BR"))) {
        fail(`${p}.name`);
        continue;
      }
      names.add(name.toLocaleLowerCase("pt-BR"));
      const markup = read(`${p}.markup`, amount(0.01, 100));
      const commissionPct = read(`${p}.commissionPct`, amount(0, 100));
      const adminExpensesPct = read(`${p}.adminExpensesPct`, amount(0, 100));
      const targetProfitPct = read(`${p}.targetProfitPct`, amount(0, 100));
      const wdPct = read(`${p}.wdPct`, amount(0, 1000));
      if (
        markup === null ||
        commissionPct === null ||
        adminExpensesPct === null ||
        targetProfitPct === null ||
        wdPct === null
      )
        continue;
      businessTypes.push({
        name,
        markup,
        commissionPct,
        adminExpensesPct,
        targetProfitPct,
        wdPct,
      });
    }
    if (!businessTypes.length && !issues.length) fail("types.0.name");

    // Despesas por container: descrição vazia = linha fora.
    const expenses: SuperplanExpense[] = [];
    const keys = new Set<string>();
    for (let i = 0; i < count(form, "expensesCount"); i++) {
      const p = `expenses.${i}`;
      const label = str(form, `${p}.label`).replace(/\s+/g, " ").slice(0, 120);
      if (!label) continue;
      const amountBrl = read(`${p}.amountBrl`, amount(0, 1e9, { int: true }));
      if (amountBrl === null) continue;
      // Chave estável da despesa (THC, CE...); a nova ganha uma.
      let key = str(form, `${p}.key`);
      if (!EXPENSE_KEY.test(key) || keys.has(key)) key = `item${i + 1}`;
      while (keys.has(key)) key = `${key}x`;
      keys.add(key);
      expenses.push({
        key,
        label,
        amountBrl,
        customs: form.get(`${p}.customs`) === "on",
      });
    }

    const defaultName = str(form, "defaultBusinessType");
    const next = {
      businessTypes,
      defaultBusinessType: defaultName,
      expenses,
      freightUsd: read("freightUsd", amount(0, 1e7, { int: true })),
      roadFreightBrl: read("roadFreightBrl", amount(0, 1e7, { int: true })),
      futureSpreadBrl: read("futureSpreadBrl", amount(0, 100)),
      freightFxPct: read("freightFxPct", amount(0, 100)),
      afrmmPct: read("afrmmPct", amount(0, 100)),
      afrmmFixedBrl: read("afrmmFixedBrl", amount(0, 1e7, { int: true })),
      // Folga da embalagem no peso (bruto estimado = líquido + este %).
      grossEstimatePct: read("grossEstimatePct", amount(0, 100)),
      priceFactors: {
        table: read("priceFactors.table", amount(0.01, 100)),
        wholesale: read("priceFactors.wholesale", amount(0.01, 100)),
        retail: read("priceFactors.retail", amount(0.01, 100)),
      },
      saleTaxes: {
        icmsPct: read("saleTaxes.icmsPct", amount(0, 100)),
        pisPct: read("saleTaxes.pisPct", amount(0, 100)),
        cofinsPct: read("saleTaxes.cofinsPct", amount(0, 100)),
        irPct: read("saleTaxes.irPct", amount(0, 100)),
        csllPct: read("saleTaxes.csllPct", amount(0, 100)),
      },
    };
    if (issues.length) throw new ZodError(issues);

    // Passa pela mesma conferência da leitura (tipo padrão que sumiu volta
    // ao primeiro da tabela, por exemplo).
    const value: SuperplanParams = superplanParams(next);
    const before = superplanParams((await getSettings()).superplan);
    await setSetting("superplan", value);
    await audit(
      user,
      "settings.superplan",
      "settings",
      "superplan",
      "Parâmetros do Superplan atualizados",
      before,
      value,
    );
    return "/app/superplan?saved=1#parametros";
  });
}
