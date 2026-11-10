import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Quadros da operação lidos do banco (dados de demonstração): todas as
 * tabelas e filtros existem, cada pedido em andamento cai num quadrado só do
 * bloco 2 e os quadrados de dinheiro só aparecem com Finanças.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const { loadTowerBoard, BOARD_CARDS } =
  await import("@/lib/services/tower-board");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

async function placeOrder() {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: "Jarra do quadro",
    description: "Quadros da operação",
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, request.id, ["fornecedor-a"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 1000,
    sellCurrency: "BRL",
    downPaymentAmount: 300,
  });
  return r.confirmDownPayment(admin, request.id);
}

describe("quadros da operação lidos do banco", () => {
  it("todos os pedidos em andamento entram no bloco 2, um quadrado cada", async () => {
    const placed = await placeOrder();
    const waiting = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Copo novo",
      description: "Solicitação nova",
      specification: null,
      quantity: 1000,
      unit: "un",
      deadline: null,
      notes: null,
    });

    await getStore().create("bookings", {
      productId: "produto-do-quadro",
      status: "analysis",
    } as never);
    const board = await loadTowerBoard({ finance: true, booking: true });
    expect(board.cards.map((c) => c.key)).toEqual(
      BOARD_CARDS.map((c) => c.key),
    );
    expect(board.cards.find((c) => c.key === "bkOpen")!.count).toBe(1);
    const live = (await getStore().list("orders")).filter(
      (o) => o.status !== "CLOSED" && o.status !== "CANCELLED",
    );
    const main = board.cards.filter(
      (c) =>
        c.block === "order" &&
        c.key !== "ordClosedMonth" &&
        c.key !== "ordCancelledMonth",
    );
    expect(main.reduce((n, c) => n + c.count, 0)).toBe(live.length);
    const where = main.filter((c) => c.rows.some((x) => x.id === placed.id));
    expect(where).toHaveLength(1);
    // Pedido recém-criado: conferência da Wellmix e número no Sankhya.
    expect(where[0].key).toBe("ordConference");
    expect(
      board.cards
        .find((c) => c.key === "reqNew")!
        .rows.some((x) => x.id === waiting.id),
    ).toBe(true);

    // Sem Finanças: sem parcelas, sem "a receber" e sem valores.
    const operator = await loadTowerBoard({ finance: false });
    expect(operator.cards.map((c) => c.key)).not.toContain("parReceivable");
    // Sem a tela Booking: sem o quadrado do Booking.
    expect(operator.cards.some((c) => c.key === "bkOpen")).toBe(false);
    expect(operator.cards.every((c) => c.value === null)).toBe(true);
  });
});
