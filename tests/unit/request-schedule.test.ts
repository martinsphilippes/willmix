import { describe, expect, it } from "vitest";
import {
  MAX_REQUEST_SCHEDULE,
  addDaysIso,
  buildSchedule,
  parseRequestSchedule,
  scheduleToLots,
  scheduleTotal,
  splitEvenly,
} from "@/lib/workflow/request-schedule";

/* Programação de entregas da solicitação: divisão, datas, leitura do formulário e lotes da ficha. */

describe("conta da programação", () => {
  it("divide em partes inteiras com o resto nas primeiras", () => {
    expect(splitEvenly(1000, 4)).toEqual([250, 250, 250, 250]);
    expect(splitEvenly(1001, 4)).toEqual([251, 250, 250, 250]);
    expect(splitEvenly(5, 3)).toEqual([2, 2, 1]);
    expect(splitEvenly(0, 2)).toEqual([0, 0]);
    expect(splitEvenly(10, 99)).toHaveLength(MAX_REQUEST_SCHEDULE);
  });

  it("datas previstas: 1ª data + intervalo × (n − 1)", () => {
    expect(addDaysIso("2026-11-20", 45)).toBe("2027-01-04");
    const s = buildSchedule({
      intervalDays: 45,
      firstDate: "2026-11-20",
      quantities: [300, 300, 400],
    });
    expect(s.items.map((i) => i.expectedAt)).toEqual([
      "2026-11-20",
      "2027-01-04",
      "2027-02-18",
    ]);
    expect(s.items.map((i) => i.index)).toEqual([1, 2, 3]);
    expect(scheduleTotal(s)).toBe(1000);
  });
});

describe("formulário", () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };

  it("lê count, intervalo, 1ª data e quantidades por programação", () => {
    const s = parseRequestSchedule(
      form({
        "p0.schedule.count": "3",
        "p0.schedule.intervalDays": "30",
        "p0.schedule.firstDate": "2026-12-01",
        "p0.schedule.qty.1": "100",
        "p0.schedule.qty.2": "150,5",
        "p0.schedule.qty.3": "50",
      }),
      "p0.",
    )!;
    expect(s.intervalDays).toBe(30);
    expect(s.items.map((i) => i.quantity)).toEqual([100, 150.5, 50]);
    expect(s.items[2].expectedAt).toBe("2027-01-30");
    // Sem programação: nulo.
    expect(
      parseRequestSchedule(form({ "p0.quantity": "10" }), "p0."),
    ).toBeNull();
    expect(
      parseRequestSchedule(form({ "p0.schedule.count": "0" }), "p0."),
    ).toBeNull();
  });

  it("recusa o que não fecha: mais de 6, intervalo inválido, data inválida, quantidade zero", () => {
    const base = {
      "p0.schedule.intervalDays": "45",
      "p0.schedule.firstDate": "2026-12-01",
      "p0.schedule.qty.1": "10",
      "p0.schedule.qty.2": "10",
    };
    expect(() =>
      parseRequestSchedule(form({ ...base, "p0.schedule.count": "7" }), "p0."),
    ).toThrow("invalid_input");
    expect(() =>
      parseRequestSchedule(
        form({
          ...base,
          "p0.schedule.count": "2",
          "p0.schedule.intervalDays": "0",
        }),
        "p0.",
      ),
    ).toThrow("invalid_input");
    expect(() =>
      parseRequestSchedule(
        form({
          ...base,
          "p0.schedule.count": "2",
          "p0.schedule.firstDate": "01/12/2026",
        }),
        "p0.",
      ),
    ).toThrow("invalid_input");
    expect(() =>
      parseRequestSchedule(
        form({ ...base, "p0.schedule.count": "2", "p0.schedule.qty.2": "0" }),
        "p0.",
      ),
    ).toThrow("invalid_input");
  });
});

describe("ficha de compra", () => {
  it("programações viram lotes da ficha: mesmo intervalo e caixas arredondadas para cima", () => {
    const s = buildSchedule({
      intervalDays: 45,
      firstDate: "2026-11-20",
      quantities: [250, 250, 260],
    });
    expect(scheduleToLots(s, 24)).toEqual([
      { departureIntervalDays: 45, masterCartons: 11 },
      { departureIntervalDays: 45, masterCartons: 11 },
      { departureIntervalDays: 45, masterCartons: 11 },
    ]);
    expect(scheduleToLots(s, null)?.map((l) => l.masterCartons)).toEqual([
      null,
      null,
      null,
    ]);
    expect(scheduleToLots(null, 24)).toBeNull();
  });
});
