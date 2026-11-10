import { describe, expect, it } from "vitest";
import {
  ORDER_PART_KEYS,
  ORDER_PART_PARALLEL,
  ORDER_PART_STAGE,
  documentPart,
  orderPartsByStage,
  plainPart,
  sheetPart,
  stepsPart,
} from "@/lib/order-parts";
import { STAGE_KEYS } from "@/lib/db/schema";

describe("partes do pedido na tabela de etapas", () => {
  it("toda parte fica debaixo de uma etapa que existe", () => {
    for (const key of ORDER_PART_KEYS)
      expect(STAGE_KEYS).toContain(ORDER_PART_STAGE[key]);
    for (const key of ORDER_PART_PARALLEL)
      expect(ORDER_PART_KEYS).toContain(key);
  });

  it("documento do pedido: conta as duas assinaturas", () => {
    expect(
      documentPart([{ key: "order_confirmed", status: "done" }], "/d"),
    ).toBe(null);
    const half = documentPart(
      [
        { key: "order_signed_wellmix", status: "done" },
        { key: "order_signed_supplier", status: "pending" },
      ],
      "/d",
    );
    expect(half).toMatchObject({ state: "active", done: 1, total: 2 });
    const full = documentPart(
      [
        { key: "order_signed_wellmix", status: "done" },
        { key: "order_signed_supplier", status: "done" },
      ],
      "/d",
    );
    expect(full?.state).toBe("done");
  });

  it("parte em passos: não começou, em andamento e concluída", () => {
    expect(stepsPart("import", [], "#x")).toBe(null);
    const step = (done: boolean, started: boolean) => ({ done, started });
    expect(
      stepsPart("certification", [step(false, false), step(false, false)], "#c")
        ?.state,
    ).toBe("pending");
    expect(
      stepsPart("certification", [step(true, true), step(false, false)], "#c"),
    ).toMatchObject({ state: "active", done: 1, total: 2 });
    expect(
      stepsPart("import", [step(true, true), step(true, true)], "#i")?.state,
    ).toBe("done");
  });

  it("ficha de compra: completa quando nada falta", () => {
    expect(sheetPart({ missing: 0, started: true }, "/s", null).state).toBe(
      "done",
    );
    expect(sheetPart({ missing: 3, started: true }, "/s", "x").state).toBe(
      "active",
    );
    expect(sheetPart({ missing: 3, started: false }, "/s", "x").state).toBe(
      "pending",
    );
  });

  it("agrupa por etapa na ordem do negócio e ignora o que o login não vê", () => {
    const map = orderPartsByStage([
      plainPart("production", "active", "#production"),
      null,
      plainPart("artwork", "pending", "#artwork"),
      plainPart("supplier_payment", "active", "#supplier-payment"),
      plainPart("receiving", "pending", "#receiving"),
    ]);
    expect(map.get("PACKAGING")?.map((p) => p.key)).toEqual([
      "artwork",
      "supplier_payment",
      "production",
    ]);
    expect(map.get("TRANSPORT")?.map((p) => p.key)).toEqual(["receiving"]);
    expect(map.has("PREPARATION")).toBe(false);
  });

  it("a certificação fica em Pedido criado, depois do documento: a certificadora recebe quando o pedido nasce", () => {
    const map = orderPartsByStage([
      stepsPart("certification", [{ done: false, started: false }], "#c"),
      documentPart(
        [{ key: "order_signed_wellmix", status: "pending" }],
        "/doc",
      ),
      sheetPart({ missing: 1, started: false }, "/s", null),
    ]);
    expect(map.get("ORDER_CREATED")?.map((p) => p.key)).toEqual([
      "document",
      "certification",
    ]);
    expect(map.get("PREPARATION")?.map((p) => p.key)).toEqual(["sheet"]);
  });
});
