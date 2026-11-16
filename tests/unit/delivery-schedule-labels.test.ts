import { describe, expect, it } from "vitest";
import { translator } from "@/i18n";
import {
  deliveryCompositionLabels,
  deliveryGenerateLabels,
  deliveryItemLabels,
  deliveryPlanLabels,
} from "@/components/delivery-schedule-labels";
import type { OrderPlanLabels } from "@/components/request-items";
import type { ScheduleLabels } from "@/components/request-schedule";
import type { ContainerCompositionLabels } from "@/components/container-composition";
import { generateLabels } from "@/components/generate-labels";
import { dictionaries } from "@/i18n/dictionaries";

/*
 * Telas TS - Trading Sales e Venda - Encomenda (dono, 16/11/2026;
 * docs/REQUEST_SCREENS.md, seção 6): cada programação é uma entrega prevista
 * ao cliente, e a data é a do recebimento pelo cliente. Só os textos mudam
 * (por cima dos de sempre); o que não fala das programações fica igual.
 */
const t = translator("pt");
const plan = {
  manual: "fixada",
  issues: "Ajuste:",
  days: "{n} dias",
  custom: "Outro",
} as unknown as OrderPlanLabels;
const item = {
  intl: "pt-BR",
  quantity: "Peças",
  total: "Total",
  days: "{n} dias",
  custom: "Outro",
} as unknown as ScheduleLabels;

describe("textos das programações nas telas TS e Venda", () => {
  it("o padrão pedido pelo dono", () => {
    const p = deliveryPlanLabels(t, plan);
    expect(p.dates).toBe("Datas previstas de recebimento pelo cliente");
    expect(p.firstDate).toBe("Data prevista do 1º recebimento");
    expect(p.count).toBe("Quantidade de entregas programadas");
    expect(p.interval).toBe("Intervalo entre recebimentos previstos");
    // "Programação 1 — Recebimento previsto: 16/03/2027" (o chip junta).
    expect(p.n.replace("{n}", "1")).toBe("Programação 1");
    expect(p.receipt).toBe("Recebimento previsto");
    // O conceito de programação fica; o que não fala delas não muda.
    expect(p.title).toBe("Programação de entregas ao cliente");
    expect(p.manual).toBe("fixada");
    expect(p.issues).toBe("Ajuste:");
    expect(p.hint).toContain("não as de produção, embarque ou saída");
  });

  it("cartão de cada produto, gerador e Composição de containers", () => {
    const i = deliveryItemLabels(t, item);
    expect(i.expected).toBe("Recebimento previsto");
    expect(i.firstDate).toBe("Data prevista do 1º recebimento");
    expect(i.interval).toBe("Intervalo entre recebimentos previstos");
    expect(i.quantity).toBe("Peças");
    const g = deliveryGenerateLabels(t, generateLabels(t));
    expect(g.rounds).toBe("Quantidade de entregas programadas");
    expect(g.perRound).toBe("Containers por entrega programada");
    expect(g.res.title).toBe("Resultado das entregas programadas");
    // O resto do gerador continua (caixas, container, ocupação).
    expect(g.total).toBe(generateLabels(t).total);
    expect(g.res.cartons).toBe(generateLabels(t).res.cartons);
    const c = deliveryCompositionLabels(t, {
      title: "Composição de containers",
      roundN: "Programação {n}",
    } as ContainerCompositionLabels);
    expect(c.title).toBe("Composição de containers");
    expect(c.roundN.replace("{n}", "2")).toBe("Programação 2");
    expect(c.roundDate?.replace("{date}", "30/04/2027")).toBe(
      "Recebimento previsto: 30/04/2027",
    );
  });

  it("em inglês e chinês, os mesmos campos", () => {
    for (const locale of ["en", "zh"] as const) {
      const tl = translator(locale);
      const p = deliveryPlanLabels(tl, plan);
      for (const v of [p.dates, p.firstDate, p.count, p.interval, p.receipt])
        expect(v && !v.startsWith("deliverySchedule.")).toBe(true);
    }
  });

  /*
   * Revisão completa (dono, 16/11/2026): nas telas TS e Venda, a recusa do
   * envio vem de deliverySchedule.error.<código> quando existe. Toda recusa
   * que fala de programação tem essa versão, nos três idiomas, e ela fala da
   * entrega ou do recebimento pelo cliente.
   */
  it("toda recusa do envio que fala de programação tem a versão das entregas", () => {
    const pt = dictionaries.pt as Record<string, string>;
    const codes = Object.keys(pt)
      .filter((k) => k.startsWith("reqBatch.error.") && /programa/i.test(pt[k]))
      .map((k) => k.slice("reqBatch.error.".length));
    expect(codes).toEqual(
      expect.arrayContaining([
        "after_create",
        "schedule_too_soon",
        "schedule_out_of_order",
        "schedule_mismatch",
        "schedule_product_changed",
      ]),
    );
    for (const code of codes) {
      const key = `deliverySchedule.error.${code}`;
      for (const locale of ["pt", "en", "zh"] as const)
        expect(
          (dictionaries[locale] as Record<string, string>)[key],
          `${locale}: ${key}`,
        ).toBeTruthy();
      expect(pt[key], key).toMatch(
        /receb|entregas? programad|entrega prevista/i,
      );
    }
  });
});
