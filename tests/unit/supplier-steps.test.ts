import { describe, expect, it } from "vitest";
import { PARTNER_FLOW_STEPS } from "@/lib/flow";
import {
  SUPPLIER_STEPS,
  legacySupplierSteps,
  supplierStepOfImportKey,
  supplierStepOfItem,
  type SupplierStep,
} from "@/lib/supplier-steps";

/*
 * "Etapas que chegam até você" do fornecedor e da Trading (dono, 16/11/2026):
 * depois do Die Cut, Ficha de compra → Aprovar a arte → Assinar o pedido →
 * Confirmar sinal → Inspeção → Amostra → Transportadora → Carregamento →
 * Invoice, onde o serviço da Trading termina. Cada pendência cai na etapa
 * pelo passo do menu dela (o mesmo do menu lateral e dos marcos).
 */

const { IMPORT_STEPS } = await import("@/lib/services/import-flow");

const rank = (step: SupplierStep | null) =>
  step ? SUPPLIER_STEPS.indexOf(step) : -1;

describe("caminho do fornecedor e da Trading até a Invoice", () => {
  it("passos do embarque, da origem, das amostras e dos documentos: na etapa do mapa", () => {
    expect(
      Object.fromEntries(
        [
          // Amostra (R12 a R14) e a amostra da China de volta à trading.
          "samples_picked",
          "samples_brazil",
          "samples_china",
          "samples_returned",
          // Transportadora (R17 a R20).
          "origin_carrier",
          "origin_carrier_eta",
          "origin_costs",
          "container_at_factory",
          "container_empty",
          // Carregamento (R7, R21, R25, R26).
          "container_loaded",
          "shipping_load",
          "shipping_packing_list",
          "container_sealed",
          "container_at_port",
          // Invoice (R22, R22?) e a invoice do fluxo antigo de importação.
          "shipping_invoice",
          "invoice_packing",
          "invoice_signed",
        ].map((key) => [key, supplierStepOfImportKey(key)]),
      ),
    ).toEqual({
      samples_picked: "sample",
      samples_brazil: "sample",
      samples_china: "sample",
      samples_returned: "sample",
      origin_carrier: "carrier",
      origin_carrier_eta: "carrier",
      origin_costs: "carrier",
      container_at_factory: "carrier",
      container_empty: "carrier",
      container_loaded: "loading",
      shipping_load: "loading",
      shipping_packing_list: "loading",
      container_sealed: "loading",
      container_at_port: "loading",
      shipping_invoice: "invoice",
      invoice_packing: "invoice",
      invoice_signed: "invoice",
    });
    // Fora do caminho: certificação e a divergência no recebimento (depois
    // da Invoice, no grupo dos lotes com divergência).
    expect(supplierStepOfImportKey("cert_seal")).toBeNull();
    expect(supplierStepOfImportKey("divergence_supplier")).toBeNull();
    expect(supplierStepOfImportKey("danfe")).toBeNull();
  });

  it("todo passo em que o fornecedor faz ou confere tem etapa, sem passar da Invoice", () => {
    const mine = IMPORT_STEPS.filter(
      (tpl) =>
        (tpl.actor === "supplier" ||
          tpl.validator === "supplier" ||
          tpl.alsoBy === "supplier") &&
        tpl.group !== "divergence" &&
        tpl.group !== "certification",
    );
    expect(mine.length).toBeGreaterThan(10);
    for (const tpl of mine) {
      const step = supplierStepOfImportKey(tpl.key);
      expect(step, tpl.key).not.toBeNull();
      // Só as etapas depois da assinatura.
      expect(rank(step), tpl.key).toBeGreaterThan(rank("sign"));
    }
  });

  it("itens do pedido: pelo passo do menu do item; o aceite das amostras é do contrato", () => {
    const of = (stage: string, key: string, step?: string) =>
      supplierStepOfItem(stage, { key, step });
    // Ficha de compra (raia e checklist da linha).
    expect(of("PREPARATION", "purchase_sheet__item1")).toBe("sheet");
    expect(of("PREPARATION", "dieline")).toBe("sheet");
    // Die Cut.
    expect(of("PREPARATION", "die_cut__item1")).toBe("dieline");
    // Aprovar a arte e o contrato.
    expect(of("PACKAGING", "art_approval")).toBe("art");
    expect(of("PACKAGING", "order_signed_supplier")).toBe("sign");
    expect(of("PACKAGING", "sample_order_supplier")).toBe("sign");
    // Sinal: o recebimento confirmado do fluxo antigo.
    expect(of("SUPPLIER_PAYMENT", "payment_received")).toBe("deposit");
    // Inspeção: fotos, peso, medidas extras, vídeo e conformidade.
    for (const key of [
      "photo_unpacked",
      "photo_scale",
      "weight_measured",
      "gross_weight_measured",
      "production_video",
      "supplier_conformity",
    ])
      expect(of("INSPECTION", key), key).toBe("inspection");
    // O passo gravado no item vem primeiro (fase 5g).
    expect(of("INSPECTION", "x", "production/loading")).toBe("loading");
    // Depois da Invoice nada é dele.
    expect(of("DELIVERED", "delivered")).toBeNull();
    expect(of("CUSTOMS", "process_number")).toBeNull();
  });

  it("os passos do menu do fornecedor caem no caminho dele", () => {
    for (const step of PARTNER_FLOW_STEPS.supplier)
      expect(supplierStepOfItem("X", { key: "x", step }), step).not.toBeNull();
  });

  it("a ordem do caminho segue o mapa e termina na Invoice", () => {
    const after = SUPPLIER_STEPS.slice(SUPPLIER_STEPS.indexOf("dieline"));
    expect(after).toEqual([
      "dieline",
      "sheet",
      "art",
      "sign",
      "deposit",
      "inspection",
      "sample",
      "carrier",
      "loading",
      "invoice",
    ]);
    expect(SUPPLIER_STEPS.at(-1)).toBe("invoice");
    // Link antigo da etapa Embarque: as etapas que a substituíram.
    expect(legacySupplierSteps("supplier.shipping")).toEqual([
      "sample",
      "carrier",
      "loading",
      "invoice",
    ]);
    expect(legacySupplierSteps("supplier.invoice")).toBeNull();
  });
});
