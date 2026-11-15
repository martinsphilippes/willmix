import { describe, expect, it } from "vitest";
import {
  MIN_FIRST_DATE_DAYS,
  addDaysIso,
  assertScheduleWindow,
  buildSchedule,
  launchDateOf,
  minFirstDate,
  outOfOrderDates,
  parseRequestSchedule,
  planDates,
} from "@/lib/workflow/request-schedule";
import { buildPurchaseRounds, sameDates } from "@/lib/purchase-rounds";
import {
  assertSameSchedule,
  parseRequestItems,
} from "@/app/app/actions/request-items";

/*
 * Nova solicitação (dono, 15/11/2026): a 1ª programação a partir do
 * lançamento + 120 dias corridos (o 120º incluso); cada data da lista
 * editável sozinha e fixada à mão; trocar o intervalo recalcula só as
 * automáticas; datas fora de ordem apontadas e recusadas; a data que vale
 * de cada programação é gravada e segue para o pedido pai e os filhos.
 */

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("1ª data: lançamento + 120 dias corridos", () => {
  it("lançamento em 15/11/2026: a 1ª data permitida é 15/03/2027", () => {
    expect(MIN_FIRST_DATE_DAYS).toBe(120);
    expect(minFirstDate("2026-11-15")).toBe("2027-03-15");
    // O 119º dia ainda não vale; o 120º vale.
    expect(addDaysIso("2026-11-15", 119)).toBe("2027-03-14");
  });

  it("a data de lançamento é o dia em Brasília da solicitação gravada", () => {
    // 23h30 de 15/11 em Brasília (02h30 de 16/11 em UTC): ainda 15/11.
    expect(launchDateOf("2026-11-16T02:30:00.000Z")).toBe("2026-11-15");
    expect(launchDateOf("2026-11-15T12:00:00.000Z")).toBe("2026-11-15");
    // Sem data gravada (solicitação nova): hoje.
    expect(launchDateOf(null)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("no servidor: o 119º dia é recusado, o 120º aceito", () => {
    const at = (first: string) =>
      buildSchedule({
        intervalDays: 45,
        firstDate: first,
        quantities: [10, 10],
      });
    expect(() => assertScheduleWindow(at("2027-03-14"), "2026-11-15")).toThrow(
      "schedule_too_soon",
    );
    expect(() =>
      assertScheduleWindow(at("2027-03-15"), "2026-11-15"),
    ).not.toThrow();
    // A referência é o lançamento gravado: reaberta depois, vale o mesmo.
    expect(() => assertScheduleWindow(at("2027-03-15"), "2026-12-01")).toThrow(
      "schedule_too_soon",
    );
    // Pedido único (sem programação): nada a conferir.
    expect(() => assertScheduleWindow(null, "2026-11-15")).not.toThrow();
  });

  it("a 1ª data que vale é a da Programação 1, mesmo fixada à mão", () => {
    const pinnedTooSoon = buildSchedule({
      intervalDays: 45,
      firstDate: "2027-03-15",
      quantities: [10, 10],
      pins: ["2027-03-10", null],
    });
    expect(() => assertScheduleWindow(pinnedTooSoon, "2026-11-15")).toThrow(
      "schedule_too_soon",
    );
  });
});

describe("datas das programações: automáticas e fixadas à mão", () => {
  it("a edição de uma programação não desloca as outras", () => {
    const auto = planDates(4, "2027-03-15", 45);
    expect(auto).toEqual([
      "2027-03-15",
      "2027-04-29",
      "2027-06-13",
      "2027-07-28",
    ]);
    // Programação 2 trocada à mão: só ela muda.
    expect(planDates(4, "2027-03-15", 45, [null, "2027-05-10"])).toEqual([
      "2027-03-15",
      "2027-05-10",
      "2027-06-13",
      "2027-07-28",
    ]);
  });

  it("trocar o intervalo recalcula só as automáticas e preserva a fixada", () => {
    const pins = [null, "2027-05-10"];
    expect(planDates(4, "2027-03-15", 30, pins)).toEqual([
      "2027-03-15",
      "2027-05-10",
      "2027-05-14",
      "2027-06-13",
    ]);
    // Intervalo de 60: a 3ª (automática) cai antes da 2ª (fixada)? Não:
    // 15/03 + 120 = 13/07; a fixada 10/05 continua no meio, em ordem.
    expect(outOfOrderDates(planDates(4, "2027-03-15", 60, pins))).toEqual([]);
  });

  it("aponta as programações fora de ordem depois do recálculo", () => {
    // Programação 2 fixada em 01/06; com 30 dias, a 3ª (14/05) fica antes.
    const dates = planDates(4, "2027-03-15", 30, [null, "2027-06-01"]);
    expect(dates).toEqual([
      "2027-03-15",
      "2027-06-01",
      "2027-05-14",
      "2027-06-13",
    ]);
    expect(outOfOrderDates(dates)).toEqual([{ n: 3, prev: 2 }]);
    // Data igual à anterior também precisa de ajuste.
    expect(outOfOrderDates(["2027-03-15", "2027-03-15"])).toEqual([
      { n: 2, prev: 1 },
    ]);
    // Em branco não entra (o campo obrigatório avisa).
    expect(outOfOrderDates(["", ""])).toEqual([]);
    // No servidor, fora de ordem é recusado.
    expect(() =>
      assertScheduleWindow(
        buildSchedule({
          intervalDays: 30,
          firstDate: "2027-03-15",
          quantities: [1, 1, 1, 1],
          pins: [null, "2027-06-01"],
        }),
        "2026-11-15",
      ),
    ).toThrow("schedule_out_of_order");
  });
});

describe("gravação: a data de cada programação vai com a solicitação", () => {
  const plan = (extra: Record<string, string> = {}) =>
    form({
      "p0.schedule.count": "3",
      "p0.schedule.intervalDays": "45",
      "p0.schedule.firstDate": "2027-03-15",
      "p0.schedule.qty.1": "100",
      "p0.schedule.qty.2": "100",
      "p0.schedule.qty.3": "100",
      ...extra,
    });

  it("a fixada à mão vale e fica marcada; as outras são as automáticas", () => {
    const s = parseRequestSchedule(
      plan({
        "p0.schedule.manual.2": "1",
        "p0.schedule.date.2": "2027-05-10",
        // Data automática mandada pela tela: o servidor faz a conta.
        "p0.schedule.date.3": "2030-01-01",
      }),
      "p0.",
    )!;
    expect(s.items.map((i) => i.expectedAt)).toEqual([
      "2027-03-15",
      "2027-05-10",
      "2027-06-13",
    ]);
    expect(s.items.map((i) => !!i.manual)).toEqual([false, true, false]);
    // Sem a marca, a data mandada não vale.
    const plain = parseRequestSchedule(
      plan({ "p0.schedule.date.2": "2027-05-10" }),
      "p0.",
    )!;
    expect(plain.items[1]).toEqual({
      index: 2,
      quantity: 100,
      expectedAt: "2027-04-29",
    });
  });

  it("recusa data fixada inválida", () => {
    expect(() =>
      parseRequestSchedule(
        plan({
          "p0.schedule.manual.2": "1",
          "p0.schedule.date.2": "10/05/2027",
        }),
        "p0.",
      ),
    ).toThrow("invalid_input");
  });

  it("os produtos do pedido precisam das mesmas datas, inclusive as fixadas", () => {
    const row = (n: number, extra: Record<string, string>) => ({
      [`p${n}.productName`]: `Produto ${n}`,
      [`p${n}.description`]: `Produto ${n}`,
      [`p${n}.quantity`]: "200",
      [`p${n}.schedule.count`]: "2",
      [`p${n}.schedule.intervalDays`]: "45",
      [`p${n}.schedule.firstDate`]: "2027-03-15",
      [`p${n}.schedule.qty.1`]: "100",
      [`p${n}.schedule.qty.2`]: "100",
      ...extra,
    });
    const pinned = {
      "p0.schedule.manual.2": "1",
      "p0.schedule.date.2": "2027-05-10",
    };
    const same = parseRequestItems(
      form({
        ...row(0, pinned),
        ...row(1, {
          "p1.schedule.manual.2": "1",
          "p1.schedule.date.2": "2027-05-10",
        }),
      }),
    );
    expect(() => assertSameSchedule(same)).not.toThrow();
    const different = parseRequestItems(
      form({ ...row(0, pinned), ...row(1, {}) }),
    );
    expect(() => assertSameSchedule(different)).toThrow("schedule_mismatch");
  });

  it("o pedido pai e os filhos usam a data gravada de cada programação", () => {
    const withPin = buildSchedule({
      intervalDays: 45,
      firstDate: "2027-03-15",
      quantities: [10, 20],
      pins: [null, "2027-05-10"],
    });
    const planned = buildPurchaseRounds([
      { productId: "p1", schedule: withPin },
      {
        productId: "p2",
        schedule: buildSchedule({
          intervalDays: 45,
          firstDate: "2027-03-15",
          quantities: [5, 5],
          pins: [null, "2027-05-10"],
        }),
      },
    ]);
    expect(
      "rounds" in planned && planned.rounds!.map((r) => r.expectedAt),
    ).toEqual(["2027-03-15", "2027-05-10"]);
    // Mesmos parâmetros, mas outra data na programação 2: datas diferentes.
    const auto = buildSchedule({
      intervalDays: 45,
      firstDate: "2027-03-15",
      quantities: [5, 5],
    });
    expect(sameDates(withPin, auto)).toBe(false);
    expect(
      buildPurchaseRounds([
        { productId: "p1", schedule: withPin },
        { productId: "p2", schedule: auto },
      ]),
    ).toEqual({ error: "purchase_order_schedule_mixed" });
  });
});
