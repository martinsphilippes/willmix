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
    // Recebimento no CD (casos do menu, fora das Pendências).
    expect(ids({ kind: "receiving_storage" })).toEqual(["delivery/storage"]);
    expect(ids({ kind: "receiving_return" })).toEqual(["delivery/return"]);
    expect(ids({ kind: "preproduction_plan" })).toEqual([
      "production/pre-production",
    ]);
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
    // O resto: o pedido na tela do passo (a visão é do passo).
    expect(caseHref(of("order/art"), task)).toBe("/app/flow/order/art/o1");
    // Telas focadas do pedido seguem diretas.
    expect(
      caseHref(of("production/cargo-docs"), {
        kind: "import_step",
        link: "/app/orders/o1/shipping-docs#packing",
        orderId: "o1",
      }),
    ).toBe("/app/orders/o1/shipping-docs#packing");
  });

  it("todo passo tem nome e explicação nos três idiomas", () => {
    for (const s of FLOW_STEPS)
      for (const dict of [pt, en, zh] as Record<string, string>[]) {
        expect(dict[`flow.step.${s.block}.${s.key}`]).toBeTruthy();
        expect(dict[`flow.help.${s.block}.${s.key}`]).toBeTruthy();
      }
  });
});

describe("resolver na tela do passo", () => {
  it("a ação volta só para uma tela de passo do menu", async () => {
    const { flowReturnTo } = await import("@/app/app/actions/helpers");
    const form = (v: string) => {
      const f = new FormData();
      f.set("returnTo", v);
      return f;
    };
    expect(flowReturnTo(form("/app/flow/order/art"))).toBe(
      "/app/flow/order/art",
    );
    // O pedido na tela do passo.
    expect(flowReturnTo(form("/app/flow/order/art/o-1_x"))).toBe(
      "/app/flow/order/art/o-1_x",
    );
    for (const bad of [
      "die-cut",
      "/app/orders/o1",
      "https://evil.example/app/flow/order/art",
      "/app/flow/order/art?x=1",
      "/app/flow/order/art/o1/extra",
      "//app/flow/order/art",
    ])
      expect(flowReturnTo(form(bad))).toBeNull();
    expect(flowReturnTo(new FormData())).toBeNull();
  });

  it("validação e arte final trazem os arquivos das outras tarefas", async () => {
    const { laneInputKeys } = await import("@/lib/purchase-lanes");
    const reqs = [
      { key: "art__i1", status: "done", documentId: "d-art" },
      { key: "art_review__i1", status: "pending", documentId: null },
      { key: "certificate__i1", status: "done", documentId: "d-cert" },
    ] as const;
    expect(laneInputKeys("art_review__i1", reqs)).toEqual([
      { label: "lane.input.review", documentId: "d-art" },
    ]);
    // Sem a validação feita, a arte final só traz o certificado.
    expect(laneInputKeys("art_final__i1", reqs)).toEqual([
      { label: "lane.input.certificate", documentId: "d-cert" },
    ]);
    const reviewed = [
      ...reqs.filter((r) => r.key !== "art_review__i1"),
      { key: "art_review__i1", status: "done" as const, documentId: null },
    ];
    expect(laneInputKeys("art_final__i1", reviewed)).toEqual([
      { label: "lane.input.art", documentId: "d-art" },
      { label: "lane.input.certificate", documentId: "d-cert" },
    ]);
    expect(laneInputKeys("art__i1", reqs)).toEqual([]);
  });
});

describe("itens com tela própria na tela do passo", () => {
  it("contrato, amostras, pedido mínimo, prazo e ficha levam à tela deles", async () => {
    const { ownScreenOf } = await import("@/components/flow-step-forms");
    expect(ownScreenOf("order_signed_wellmix", "o1")?.href).toBe(
      "/app/orders/o1/purchase-order",
    );
    expect(ownScreenOf("order_sign_send", "o1")?.href).toBe(
      "/app/orders/o1/purchase-order",
    );
    expect(ownScreenOf("sample_order", "o1")?.href).toBe(
      "/app/orders/o1/samples",
    );
    expect(ownScreenOf("moq_confirmed__i1", "o1")?.href).toBe(
      "/app/orders/o1/die-cut",
    );
    expect(ownScreenOf("purchase_sheet", "o1")?.href).toBe(
      "/app/orders/o1/purchase-sheet",
    );
    // Arte e medidas seguem com o formulário na própria tela do passo.
    expect(ownScreenOf("art__i1", "o1")).toBeNull();
    expect(ownScreenOf("gross_weight_measured", "o1")).toBeNull();
  });
});

describe("aba Todos no passo", () => {
  it("passos abertos do pedido: prontos, não concluídos, só na fase deles", async () => {
    const { openImportStepKeys } = await import("@/lib/services/import-flow");
    const order = {
      id: "o1",
      status: "SHIPPING",
      flow: "customer_request",
      incoterm: null,
    } as never;
    const opts = { certification: false, samples: false };
    const open = openImportStepKeys(order, [], opts);
    // O primeiro passo do embarque está pronto; os que dependem dele, não.
    expect(open).toContain("booking");
    expect(open).not.toContain("draft_bl");
    // Concluído sai; o seguinte fica pronto.
    const booked = [
      { orderId: "o1", key: "booking", status: "validated" },
    ] as never[];
    const next = openImportStepKeys(order, booked, opts);
    expect(next).not.toContain("booking");
    expect(next).toContain("draft_bl");
    // Antes da inspeção, o embarque não está em andamento.
    expect(
      openImportStepKeys(
        { ...(order as object), status: "PREPARATION" } as never,
        [],
        opts,
      ),
    ).toEqual([]);
    // Certificação e amostras só quando o chamador diz que valem.
    expect(open.some((k) => k.startsWith("cert_"))).toBe(false);
    expect(open.some((k) => k.startsWith("samples_"))).toBe(false);
    expect(
      openImportStepKeys(order, [], { certification: true, samples: false }),
    ).toContain("cert_memorial");
  });
});

describe("passos dos parceiros", () => {
  it("todo passo do mapa dos parceiros existe; nenhum leva a passo só da Wellmix", async () => {
    const { PARTNER_FLOW_STEPS, partnerStepsOf } = await import("@/lib/flow");
    for (const [role, ids] of Object.entries(PARTNER_FLOW_STEPS)) {
      expect(partnerStepsOf(role).map(stepId)).toEqual(
        FLOW_STEPS.map(stepId).filter((id) => ids.includes(id)),
      );
      expect(partnerStepsOf(role)).toHaveLength(ids.length);
      // Telas da Wellmix (recebimento, pré-produção, produção, frete do
      // pedido, Overview) ficam fora do menu dos parceiros.
      for (const id of [
        "delivery/storage",
        "delivery/return",
        "production/pre-production",
        "production/production",
      ])
        expect(ids).not.toContain(id);
    }
    expect(partnerStepsOf("customer")).toEqual([]);
    expect(partnerStepsOf("legal")).toEqual([]);
  });
});

describe("LPCO, Amostras e Ofertas", () => {
  it("LPCO só no pedido com produto de NCM da lista (prefixo, com ou sem pontos)", async () => {
    const { lpcoPrefixes, ncmNeedsLpco, stepApplies, openImportStepKeys } =
      await import("@/lib/services/import-flow");
    const prefixes = lpcoPrefixes("3304, 9503.00;  8516\n x 1");
    expect(prefixes).toEqual(["3304", "950300", "8516"]);
    expect(ncmNeedsLpco("3304.99.10", prefixes)).toBe(true);
    expect(ncmNeedsLpco("95030099", prefixes)).toBe(true);
    expect(ncmNeedsLpco("9504.50.00", prefixes)).toBe(false);
    expect(ncmNeedsLpco(null, prefixes)).toBe(false);
    expect(lpcoPrefixes("")).toEqual([]);
    const order = {
      id: "o1",
      status: "SHIPPING",
      flow: "customer_request",
      incoterm: null,
    } as never;
    expect(stepApplies(order, "lpco")).toBe(false);
    expect(stepApplies(order, "lpco", true)).toBe(true);
    const opts = { certification: false, samples: false };
    expect(openImportStepKeys(order, [], opts)).not.toContain("lpco");
    expect(openImportStepKeys(order, [], { ...opts, lpco: true })).toContain(
      "lpco",
    );
    // Entrega → LPCO, também no menu do comex.
    expect(ids({ kind: "import_step", stepKey: "lpco" })).toEqual([
      "delivery/lpco",
    ]);
    const { PARTNER_FLOW_STEPS } = await import("@/lib/flow");
    expect(PARTNER_FLOW_STEPS.comex).toContain("delivery/lpco");
  });

  it("amostra no Brasil e produto com a venda ativada caem em Vendas", () => {
    expect(ids({ kind: "sales_sample" })).toEqual(["sales/samples"]);
    expect(ids({ kind: "sales_product" })).toEqual(["sales/offers"]);
  });
});
