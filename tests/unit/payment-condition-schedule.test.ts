import { describe, expect, it } from "vitest";
import type { PaymentCondition } from "@/lib/db/schema";
import {
  scheduleFromText,
  scheduleSummary,
  type ConditionBase,
} from "@/lib/payment-condition-schedule";
import {
  conditionFromViewRow,
  conditionSchedule,
  missingConditionColumns,
  planConditionSync,
} from "@/lib/payment-condition-view";

/*
 * Condições de pagamento pela VW_AD_TIPONEGOCIACAO_WELL (dono, 21/11/2026):
 * parcelas por tempo (dias da nota) ou por evento do pedido, lidas da
 * descrição; a sincronização deixa a tabela igual à view.
 */

const days = (text: string, cash = false) =>
  scheduleFromText(text, cash).installments.map((i) => i.days);

describe("parcelas pela descrição", () => {
  it("lista de dias divide em partes iguais, a partir da nota", () => {
    const s = scheduleFromText("30/60/90 DIAS");
    expect(s.kind).toBe("time");
    expect(s.problem).toBeNull();
    expect(s.installments).toEqual([
      { percent: 33.33, base: "invoice", days: 30 },
      { percent: 33.33, base: "invoice", days: 60 },
      { percent: 33.34, base: "invoice", days: 90 },
    ]);
    expect(days("30/45 - DIAS")).toEqual([30, 45]);
    expect(days("30/40/50/60/70/80/90/100/110/120 DIA")).toHaveLength(10);
    expect(days("45 DIAS")).toEqual([45]);
    expect(days("A VISTA FIDELIDADE 07 DIAS")).toEqual([7]);
    expect(days("90 DIAS (AMOSTRA)")).toEqual([90]);
  });

  it("à vista: na nota; AMOSTRA só pelo subtipo à vista do Sankhya", () => {
    expect(scheduleFromText("A VISTA ANTECIPADO").installments).toEqual([
      { percent: 100, base: "invoice", days: 0 },
    ]);
    expect(scheduleFromText("AMOSTRA").problem).toBe("unreadable");
    expect(scheduleFromText("AMOSTRA", true).installments).toEqual([
      { percent: 100, base: "invoice", days: 0 },
    ]);
  });

  it("faixas com vencimentos diários ou de N em N dias", () => {
    const daily = days("30 A 65 (VENCIMENTOS DIARIOS)");
    expect(daily[0]).toBe(30);
    expect(daily.at(-1)).toBe(65);
    expect(daily).toHaveLength(36);
    expect(days("30 A 120 DD INTERV 3 DD")).toHaveLength(31);
    expect(days("45 a 135 VENC 7 EM 7 DD")).toEqual([
      45, 52, 59, 66, 73, 80, 87, 94, 101, 108, 115, 122, 129, 135,
    ]);
    expect(days("30 a 60 DD / VENC DE 3 EM 3 DD")).toHaveLength(11);
    const s = scheduleFromText("30 A 120 DIAS / VENCIM. DIARIOS");
    expect(s.installments).toHaveLength(91);
    expect(s.problem).toBeNull();
  });

  it("por evento: sinal no pedido, embarque e registro (Presença de Carga)", () => {
    const s = scheduleFromText("10% SIN, 40% EMB, 50% REGISTRO");
    expect(s.kind).toBe("event");
    expect(s.problem).toBeNull();
    expect(s.installments).toEqual([
      { percent: 10, base: "order", days: 0 },
      { percent: 40, base: "shipment", days: 0 },
      { percent: 50, base: "cargo_presence", days: 0 },
    ]);
  });

  it("soma diferente de 100 fica a revisar", () => {
    const s = scheduleFromText("20% SIN, 70% EMBQ");
    expect(s.kind).toBe("event");
    expect(s.problem).toBe("percent_sum");
  });

  it("dias depois do embarque", () => {
    expect(
      scheduleFromText("20% ANT-80% 150 DAYS AFTER SHIPPING").installments,
    ).toEqual([
      { percent: 20, base: "order", days: 0 },
      { percent: 80, base: "shipment", days: 150 },
    ]);
  });

  it("a regra do administrador vale mais que a descrição", () => {
    const s = conditionSchedule({
      name: "20% SIN, 70% EMBQ",
      scheduleRule: "20% SIN, 70% EMB, 10% ENTREGA",
    });
    expect(s.problem).toBeNull();
    expect(s.installments.at(-1)).toEqual({
      percent: 10,
      base: "delivery",
      days: 0,
    });
  });

  it("resumo curto", () => {
    const labels: Record<ConditionBase, string> = {
      invoice: "da nota",
      order: "no pedido",
      shipment: "no embarque",
      cargo_presence: "na Presença de Carga",
      delivery: "na entrega",
    };
    expect(scheduleSummary(scheduleFromText("30/60/90 DIAS"), labels, "dias")).toBe(
      "30/60/90 dias",
    );
    expect(
      scheduleSummary(
        scheduleFromText("10% SIN, 40% EMB, 50% REGISTRO"),
        labels,
        "dias",
      ),
    ).toBe("10% no pedido · 40% no embarque · 50% na Presença de Carga");
  });
});

/** As 25 linhas da view que a Wellmix mandou (21/11/2026): todas lidas. */
const VIEW_ROWS: Array<[number, string, number]> = [
  [4, "AMOSTRA", 1],
  [6, "30 DIAS", 2],
  [8, "30/60 DIAS", 3],
  [9, "45 DIAS", 2],
  [11, "30/45/60 DIAS", 3],
  [12, "30/60/90 DIAS", 3],
  [13, "30/40/50/60 DIAS", 3],
  [15, "30/45/60/75/90 DIAS", 3],
  [16, "30/45/60/75/90/105 DIAS", 3],
  [19, "30/45/60/75/90/105/120 DIAS", 3],
  [49, "30/40/50/60/70/80/90/100/110/120 DIA", 3],
  [52, "30/40/50/60/70/80/90 DIAS", 3],
  [53, "30/45 - DIAS", 3],
  [55, "30/45/60/75 DIAS", 3],
  [104, "A VISTA ANTECIPADO", 1],
  [120, "30/40/50 DIAS", 3],
  [157, "A VISTA FIDELIDADE 07 DIAS", 2],
  [188, "90 DIAS (AMOSTRA)", 2],
  [246, "30 A 65 (VENCIMENTOS DIARIOS)", 3],
  [252, "30 A 120 DIAS / VENCIM. DIARIOS", 3],
  [255, "30 A 120 DD INTERV 3 DD", 3],
  [256, "45 a 135 VENC 7 EM 7 DD", 3],
  [257, "30 a 60 DD / VENC DE 3 EM 3 DD", 3],
  [258, "10% SIN, 40% EMB, 50% REGISTRO", 3],
  [259, "20% SIN, 70% EMBQ", 3],
];

describe("linhas da view", () => {
  it("lê código, descrição, ativo e subtipo", () => {
    const c = conditionFromViewRow({
      CODTIPVENDA: 4,
      DESCRTIPVENDA: "AMOSTRA ",
      ATIVO: "S",
      SUBTIPOVENDA: 1,
    });
    expect(c).toMatchObject({ code: 4, name: "AMOSTRA", active: true, cash: true });
    expect(conditionFromViewRow({ CODTIPVENDA: "x" })).toBeNull();
    expect(
      conditionFromViewRow({ COD_TIPO_NEGOCIACAO: 9, DESCRICAO: "45 DIAS", ATIVO: "N" }),
    ).toMatchObject({ code: 9, active: false });
    expect(missingConditionColumns(["CODTIPVENDA", "DESCRTIPVENDA"])).toEqual([
      "ATIVO",
    ]);
  });

  it("só a 259 fica a revisar (soma 90%)", () => {
    const review = VIEW_ROWS.filter(([, name, sub]) => {
      const c = conditionFromViewRow({
        CODTIPVENDA: 0,
        DESCRTIPVENDA: name,
        SUBTIPOVENDA: sub,
      })!;
      return conditionSchedule({
        name: c.name,
        scheduleRule: null,
        cash: c.cash,
      }).problem;
    }).map(([code]) => code);
    expect(review).toEqual([259]);
  });
});

describe("sincronização", () => {
  const cond = (code: number, id = `c${code}`): PaymentCondition =>
    ({ id, code, name: `C${code}`, active: true }) as PaymentCondition;

  it("cria, atualiza e tira o que não está na view", () => {
    const plan = planConditionSync(
      [cond(4), cond(199), cond(172)],
      [
        { CODTIPVENDA: 4, DESCRTIPVENDA: "AMOSTRA" },
        { CODTIPVENDA: 258, DESCRTIPVENDA: "10% SIN, 40% EMB, 50% REGISTRO" },
        { CODTIPVENDA: 258, DESCRTIPVENDA: "repetida" },
      ],
    );
    expect(plan.create.map((c) => [c.code, c.name])).toEqual([
      [258, "10% SIN, 40% EMB, 50% REGISTRO"],
    ]);
    expect(plan.update.map((u) => u.id)).toEqual(["c4"]);
    expect(plan.remove.map((c) => c.code)).toEqual([199, 172]);
  });

  it("view vazia não apaga nada", () => {
    expect(planConditionSync([cond(4)], [])).toEqual({
      create: [],
      update: [],
      remove: [],
    });
  });
});
