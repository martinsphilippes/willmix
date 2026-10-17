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
const { seedDemo } = await import("@/lib/seed");
const { createContainer, updateContainer } =
  await import("@/lib/services/containers");

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
    // Embarque sem limite: a chegada só existe antes dele em pedido antigo, e
    // aí o embarque real vale (a chegada volta a ser pedida).
    expect(dateBoundsFor("SHIPPING", "ship_date", valueOf)).toEqual({});
    // A chegada do navio continua limitada pela entrega já informada.
    const arrival = dateBoundsFor("SHIPPING", "eta", (stage, key) =>
      stage === "TRANSPORT" && key === "eta"
        ? "2026-12-01"
        : valueOf(stage, key),
    );
    expect(arrival.max).toBe("2026-12-01");
    expect(arrival.maxError).toBe("eta_after_delivery");
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
        "containers.error.eta_before_etd",
      ] as const)
        expect(t(key), `${locale} ${key}`).not.toBe(key);
    }
    // Pontuação de cada língua (chinês: parênteses e ponto de largura total).
    expect(
      translator("zh")("orders.error.boundWithDate", {
        text: "预计到港日期不能早于装船日期",
        date: "2026/10/21",
      }),
    ).toBe("预计到港日期不能早于装船日期（2026/10/21）。");
    expect(
      translator("pt")("orders.error.boundWithDate", {
        text: "A previsão de chegada não pode ser antes da data de embarque",
        date: "21/10/2026",
      }),
    ).toBe(
      "A previsão de chegada não pode ser antes da data de embarque (21/10/2026).",
    );
  });
});

describe("container: chegada prevista nunca antes da saída", () => {
  it("criar e editar recusam ETA antes do ETD", async () => {
    const { users } = await seedDemo();
    const admin = users.find((u) => u.email === "admin@wellmix.com")!;
    await expect(
      createContainer(admin, {
        code: "C-ETA",
        type: "40HC",
        etd: "2026-11-10",
        eta: "2026-11-01",
      }),
    ).rejects.toThrow("eta_before_etd");
    const ok = await createContainer(admin, {
      code: "C-OK",
      type: "40HC",
      etd: "2026-11-10",
      eta: "2026-12-10",
    });
    await expect(
      updateContainer(admin, ok.id, { eta: "2026-11-05" }),
    ).rejects.toThrow("eta_before_etd");
    await expect(
      updateContainer(admin, ok.id, { etd: "2026-12-20" }),
    ).rejects.toThrow("eta_before_etd");
    await updateContainer(admin, ok.id, { eta: "2026-11-10" });
  });
});
