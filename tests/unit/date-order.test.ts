import { describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Datas do pedido em ordem: a previsão de chegada nunca antes da data de
 * embarque. Limites do calendário (com o aviso de cada lado) e a data que
 * precisa vir antes na mesma etapa.
 */
withTempStore();

const { dateBoundsFor, datePrerequisite } =
  await import("@/lib/workflow/engine");
const { translator } = await import("@/i18n");

const values: Record<string, string> = {
  "SHIPPING.ship_date": "2026-10-21",
  "SHIPPING.eta": "2026-11-20",
};
const valueOf = (stage: string, key: string) =>
  values[`${stage}.${key}`] ?? null;

describe("limites das datas", () => {
  it("chegada: a partir do embarque; embarque: até a chegada", () => {
    expect(dateBoundsFor("SHIPPING", "eta", valueOf)).toEqual({
      min: "2026-10-21",
      minError: "eta_before_ship_date",
      max: undefined,
      maxError: undefined,
    } as never);
    const ship = dateBoundsFor("SHIPPING", "ship_date", valueOf);
    expect(ship.max).toBe("2026-11-20");
    expect(ship.maxError).toBe("ship_date_after_eta");
    expect(ship.min).toBeUndefined();
    // Entrega: a partir da chegada do navio.
    const delivery = dateBoundsFor("TRANSPORT", "eta", valueOf);
    expect(delivery.min).toBe("2026-11-20");
    expect(delivery.minError).toBe("delivery_before_eta");
  });

  it("sem a outra data ainda, sem limite", () => {
    expect(dateBoundsFor("SHIPPING", "eta", () => null)).toEqual({});
  });
});

describe("data que vem antes", () => {
  it("a chegada espera o embarque (mesma etapa); a entrega não espera", () => {
    expect(datePrerequisite("SHIPPING", "eta")).toEqual({
      key: "ship_date",
      code: "ship_date_first",
    });
    expect(datePrerequisite("SHIPPING", "ship_date")).toBeNull();
    expect(datePrerequisite("TRANSPORT", "eta")).toBeNull();
  });

  it("textos do aviso e do erro nas três línguas", () => {
    for (const locale of ["pt", "en", "zh"] as const) {
      const t = translator(locale);
      for (const key of [
        "orders.waiting.ship_date_first",
        "orders.error.ship_date_first",
        "orders.error.eta_before_ship_date",
      ] as const)
        expect(t(key), `${locale} ${key}`).not.toBe(key);
    }
  });
});
