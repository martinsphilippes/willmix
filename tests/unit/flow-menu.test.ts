import { describe, expect, it } from "vitest";
import {
  FLOW_STEPS,
  caseHref,
  countByStep,
  flowStepOfImportKey,
  flowStepsOf,
  itemsInStep,
  stepId,
} from "@/lib/flow";
import { pt, en, zh } from "@/i18n/modules/flow";

/* Blocos e passos do menu (docs/FLOW_MENU.md): cada pendência cai no passo
   de onde vem; a de etapa que junta itens de passos diferentes conta uma vez
   em cada; mensagem a responder fica no cabeçalho. */
const ids = (task: Parameters<typeof flowStepsOf>[0]) =>
  flowStepsOf(task).map(stepId);

describe("passos do menu", () => {
  it("tipo da pendência → passo", () => {
    expect(ids({ kind: "booking_invite" })).toEqual(["new-product/quotes"]);
    expect(ids({ kind: "supplier_request" })).toEqual([
      "new-product/negotiations",
    ]);
    expect(ids({ kind: "sampling_validate" })).toEqual([
      "new-product/negotiations",
    ]);
    expect(ids({ kind: "art_review" })).toEqual(["order/art"]);
    expect(ids({ kind: "cert_step", stepKey: "cert_lab" })).toEqual([
      "order/certification",
    ]);
    expect(ids({ kind: "review" })).toEqual(["order/review"]);
    expect(ids({ kind: "sku_fix" })).toEqual(["production/inspection"]);
    expect(ids({ kind: "production_follow" })).toEqual([
      "production/production",
    ]);
    expect(ids({ kind: "invoice_due" })).toEqual(["finance/finance"]);
    expect(ids({ kind: "ncm_classify" })).toEqual(["registry/products"]);
    expect(ids({ kind: "message_reply" })).toEqual([]);
  });

  it("passos do embarque e da importação → passo do mapa", () => {
    const step = (stepKey: string) => ids({ kind: "import_step", stepKey });
    expect(step("booking")).toEqual(["production/booking"]);
    expect(step("container_loaded")).toEqual(["production/loading"]);
    expect(step("shipping_packing")).toEqual(["production/cargo-docs"]);
    expect(step("samples_china")).toEqual(["production/sample"]);
    expect(step("channel")).toEqual(["delivery/channel"]);
    expect(step("danfe")).toEqual(["delivery/invoice"]);
    expect(step("cargo_presence")).toEqual(["delivery/cargo-presence"]);
    expect(ids({ kind: "import_validate", stepKey: "assign" })).toEqual([
      "order/certification",
    ]);
  });

  it("todo passo do embarque, da importação e da certificação tem o passo do menu", async () => {
    const { IMPORT_STEP_KEYS } = await import("@/lib/db/schema");
    expect(IMPORT_STEP_KEYS.filter((k) => !flowStepOfImportKey(k))).toEqual([]);
    expect(
      flowStepOfImportKey("cert_seal") &&
        stepId(flowStepOfImportKey("cert_seal")!),
    ).toBe("order/certification");
    expect(stepId(flowStepOfImportKey("container_sealed")!)).toBe(
      "production/loading",
    );
  });

  it("pendência de etapa: cada item no passo dele, sem repetir", () => {
    const task = {
      kind: "requirement",
      stageKey: "PREPARATION",
      items: [
        { key: "art__i1", label: "Arte" },
        { key: "certificate__i1", label: "Certificado" },
        { key: "art_review__i2", label: "Validação" },
        { key: "gross_weight_measured", label: "Peso" },
      ],
    };
    expect(ids(task).sort()).toEqual([
      "order/art",
      "order/certification",
      "order/orders",
    ]);
    const art = FLOW_STEPS.find((s) => stepId(s) === "order/art")!;
    expect(itemsInStep(art, task).map((i) => i.label)).toEqual([
      "Arte",
      "Validação",
    ]);
    expect(
      ids({ kind: "requirement", stageKey: "CUSTOMS", items: [{ key: "x" }] }),
    ).toEqual(["delivery/cargo-presence"]);
  });

  it("contagem por passo com as atrasadas", () => {
    const counts = countByStep([
      { kind: "art_fix", overdue: true },
      { kind: "art_review", overdue: false },
      { kind: "review", overdue: false },
    ]);
    expect(counts.get("order/art")).toEqual({ count: 2, overdue: 1 });
    expect(counts.get("order/review")).toEqual({ count: 1, overdue: 0 });
  });

  it("o atalho leva à tela focada do pedido quando ela existe", () => {
    const of = (key: string) => FLOW_STEPS.find((s) => stepId(s) === key)!;
    const task = { kind: "requirement", link: "/app/orders/o1", orderId: "o1" };
    expect(caseHref(of("order/contract"), task)).toBe(
      "/app/orders/o1/purchase-order",
    );
    expect(caseHref(of("order/art-material"), task)).toBe(
      "/app/orders/o1/die-cut",
    );
    expect(caseHref(of("order/art"), task)).toBe("/app/orders/o1");
  });

  it("todo passo tem nome e explicação nos três idiomas", () => {
    for (const s of FLOW_STEPS)
      for (const dict of [pt, en, zh] as Record<string, string>[]) {
        expect(dict[`flow.step.${s.block}.${s.key}`]).toBeTruthy();
        expect(dict[`flow.help.${s.block}.${s.key}`]).toBeTruthy();
      }
  });
});
