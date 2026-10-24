import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { effectiveMoq, isPieceUnit } from "@/lib/moq";

/*
 * Pedido mínimo na solicitação: produto do catálogo com mínimo (ficha mestre,
 * senão cadastro) não aceita quantidade menor, nem do cliente nem da Wellmix.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createRequest, createRequestBatch, productMoq, createFollowUpRequest } =
  await import("@/lib/services/requests");
const { saveProductSheet } = await import("@/lib/services/product-sheet");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

const base = (productId: string | null, quantity: number, unit = "un") => ({
  customerId: "cliente-joao",
  productId,
  productName: "Teste MOQ",
  description: "Pedido mínimo",
  specification: null,
  quantity,
  unit,
  deadline: null,
  notes: null,
});

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

describe("regras puras", () => {
  it("unidades de peça e mínimo que vale", () => {
    for (const u of ["", "un", "UN", "pç", "pcs", "peças", "pieces", "件"])
      expect(isPieceUnit(u)).toBe(true);
    for (const u of ["cx", "kg", "m", "caixas", "par"])
      expect(isPieceUnit(u)).toBe(false);
    expect(effectiveMoq(null, 500)).toBe(500);
    expect(effectiveMoq(800, 500)).toBe(800);
    expect(effectiveMoq(0, 500)).toBe(500);
    expect(effectiveMoq(null, null)).toBeNull();
    expect(effectiveMoq(-1, 0)).toBeNull();
  });
});

describe("pedido mínimo ao criar a solicitação", () => {
  it("abaixo do mínimo do cadastro é recusado para cliente e Wellmix; no mínimo passa", async () => {
    // prod-panela: moq 500 no cadastro (seed), sem ficha mestre.
    expect(await productMoq("prod-panela")).toBe(500);
    await expect(createRequest(joao, base("prod-panela", 100))).rejects.toThrow(
      "below_moq",
    );
    await expect(createRequest(admin, base("prod-panela", 499))).rejects.toThrow(
      "below_moq",
    );
    const ok = await createRequest(joao, base("prod-panela", 500));
    expect(ok.quantity).toBe(500);
    // Nada foi criado nas recusas (e o número não foi gasto).
    const rows = await getStore().list("requests", {
      filter: { productId: "prod-panela" },
    });
    expect(rows.filter((r) => r.productName === "Teste MOQ")).toHaveLength(1);
  });

  it("em outra unidade (caixas) não se compara; sem produto do catálogo ou sem mínimo passa", async () => {
    await expect(
      createRequest(joao, base("prod-panela", 10, "cx")),
    ).resolves.toBeTruthy();
    await expect(createRequest(joao, base(null, 1))).resolves.toBeTruthy();
    // prod-jarra: sem mínimo.
    expect(await productMoq("prod-jarra")).toBeNull();
    await expect(createRequest(joao, base("prod-jarra", 1))).resolves.toBeTruthy();
  });

  it("a ficha mestre manda sobre o cadastro; o lote inteiro é recusado antes de criar qualquer solicitação", async () => {
    await saveProductSheet(admin, "prod-panela", { moq: 800 } as never);
    expect(await productMoq("prod-panela")).toBe(800);
    await expect(createRequest(joao, base("prod-panela", 600))).rejects.toThrow(
      "below_moq",
    );
    const before = (await getStore().list("requests")).length;
    await expect(
      createRequestBatch(
        joao,
        { customerId: "cliente-joao", deadline: null, notes: null, requestedForUserId: joao.id },
        [
          { productId: "prod-jarra", productName: "Jarra", description: "x", specification: null, quantity: 10, unit: "un", sourcingDemand: false },
          { productId: "prod-panela", productName: "Panela", description: "x", specification: null, quantity: 700, unit: "un", sourcingDemand: false },
        ],
      ),
    ).rejects.toThrow("below_moq");
    // A primeira nasceu e foi cancelada pela reversão do lote; nenhuma ativa sobrou.
    const after = await getStore().list("requests");
    expect(after.slice(before).every((r) => r.status === "CANCELLED")).toBe(true);
  });

  it("recompra a partir de um pedido também respeita o mínimo", async () => {
    const store = getStore();
    const r = await import("@/lib/services/requests");
    const users = await store.list("users");
    const supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
    // Pedido da jarra (sem mínimo na hora da compra).
    const request = await createRequest(joao, base("prod-jarra", 100));
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const [quote] = await store.list("quotes", { filter: { requestId: request.id } });
    await r.answerQuote(supplierA, quote.id, { price: 2, currency: "USD", leadTimeDays: 10, conditions: null });
    await r.selectQuote(admin, quote.id, { sellPrice: 1000, sellCurrency: "BRL", downPaymentAmount: 300 });
    const order = await r.confirmDownPayment(admin, request.id);
    // Depois o cadastro ganhou mínimo: a recompra abaixo dele é recusada.
    await store.update("products", "prod-jarra", { moq: 1000 });
    await expect(
      createFollowUpRequest(admin, order.id, { quantity: 10, origin: "replenishment" }),
    ).rejects.toThrow("below_moq");
    await expect(
      createFollowUpRequest(joao, order.id, { quantity: 1000, origin: "replenishment" }),
    ).resolves.toBeTruthy();
    await store.update("products", "prod-jarra", { moq: null });
  });
});
