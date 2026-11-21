import type { PaymentCondition } from "@/lib/db/schema";
import {
  scheduleFromText,
  type ConditionSchedule,
} from "@/lib/payment-condition-schedule";

/*
 * Condições de pagamento pela VW_AD_TIPONEGOCIACAO_WELL do Sankhya (dono,
 * 21/11/2026): a view é a lista que vale. Funções puras: a linha da view
 * vira a condição do portal, e a sincronização diz o que criar, mudar e
 * apagar (a tabela fica só com o que está na view). Quem grava é
 * src/lib/services/payment-conditions.ts.
 */

export const PAYMENT_CONDITION_VIEW = "sankhya.VW_AD_TIPONEGOCIACAO_WELL";

/** Nomes aceitos para cada campo (a view pode usar o nome da TGFTPV ou o próprio). */
const CODE_COLUMNS = [
  "CODTIPVENDA",
  "COD_TIPO_NEGOCIACAO",
  "COD_TIPVENDA",
  "CODIGO",
];
const NAME_COLUMNS = [
  "DESCRTIPVENDA",
  "DESCRICAO_TIPO_NEGOCIACAO",
  "DESCR_TIPO_NEGOCIACAO",
  "DESCRICAO",
  "NOME",
];
const ACTIVE_COLUMNS = ["ATIVO"];
const SUBTYPE_COLUMNS = ["SUBTIPOVENDA", "SUBTIPO_VENDA", "SUBTIPO"];

const pick = (row: Record<string, unknown>, names: string[]): unknown => {
  const keys = Object.keys(row);
  for (const name of names) {
    const key = keys.find((k) => k.toUpperCase() === name);
    if (key && row[key] != null && String(row[key]).trim() !== "")
      return row[key];
  }
  return undefined;
};

/** Colunas esperadas que a view não trouxe (aviso na tela). */
export function missingConditionColumns(columns: string[]): string[] {
  const have = new Set(columns.map((c) => c.toUpperCase()));
  const out: string[] = [];
  if (!CODE_COLUMNS.some((c) => have.has(c))) out.push("CODTIPVENDA");
  if (!NAME_COLUMNS.some((c) => have.has(c))) out.push("DESCRTIPVENDA");
  if (!ACTIVE_COLUMNS.some((c) => have.has(c))) out.push("ATIVO");
  return out;
}

export interface ViewCondition {
  code: number;
  name: string;
  active: boolean;
  /** Subtipo 1 = à vista no Sankhya. */
  cash: boolean;
  row: Record<string, string | number | null>;
}

/** A linha da view como condição; nula sem código inteiro. */
export function conditionFromViewRow(
  row: Record<string, unknown>,
): ViewCondition | null {
  const code = Number(pick(row, CODE_COLUMNS));
  if (!Number.isInteger(code) || code < 0) return null;
  const name =
    String(pick(row, NAME_COLUMNS) ?? "")
      .trim()
      .slice(0, 160) || `Condição ${code}`;
  const active = pick(row, ACTIVE_COLUMNS);
  const snapshot: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.toUpperCase();
    if (v == null) snapshot[key] = null;
    else if (typeof v === "number") snapshot[key] = v;
    else snapshot[key] = String(v).trim().slice(0, 500) || null;
  }
  return {
    code,
    name,
    active: active == null ? true : String(active).trim().toUpperCase() !== "N",
    cash: Number(pick(row, SUBTYPE_COLUMNS)) === 1,
    row: snapshot,
  };
}

/** Parcelas da condição: a regra do administrador vale mais que a descrição. */
export function conditionSchedule(
  c: Pick<PaymentCondition, "name" | "scheduleRule"> & { cash?: boolean },
): ConditionSchedule {
  const rule = c.scheduleRule?.trim();
  return scheduleFromText(rule || c.name, !rule && c.cash === true);
}

export interface ConditionSyncPlan {
  create: ViewCondition[];
  update: Array<{ id: string; view: ViewCondition }>;
  /** Condições do portal fora da view (saem da tabela). */
  remove: PaymentCondition[];
}

/**
 * O que muda para a tabela ficar igual à view. Código repetido na view vale
 * a primeira linha. View vazia não apaga nada (leitura sem linhas é erro,
 * não "nenhuma condição").
 */
export function planConditionSync(
  existing: PaymentCondition[],
  rows: Record<string, unknown>[],
): ConditionSyncPlan {
  const seen = new Map<number, ViewCondition>();
  for (const row of rows) {
    const c = conditionFromViewRow(row);
    if (c && !seen.has(c.code)) seen.set(c.code, c);
  }
  if (!seen.size) return { create: [], update: [], remove: [] };
  const byCode = new Map(existing.map((c) => [c.code, c]));
  const plan: ConditionSyncPlan = { create: [], update: [], remove: [] };
  for (const view of seen.values()) {
    const found = byCode.get(view.code);
    if (found) plan.update.push({ id: found.id, view });
    else plan.create.push(view);
  }
  plan.remove = existing.filter((c) => !seen.has(c.code));
  return plan;
}
