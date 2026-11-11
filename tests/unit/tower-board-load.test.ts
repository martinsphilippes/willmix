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
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const { loadTowerBoard, BOARD_CARDS } =
  await import("@/lib/services/tower-board");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

async function placeOrder() {
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
  return orderFromRequest(admin, request, { downPaymentAmount: 300 });
}

describe("quadros da operação lidos do banco", () => {
  it("todos os pedidos em andamento entram no bloco do pedido, um quadrado cada", async () => {
    const placed = await placeOrder();

    // Com Finanças: todos os quadrados.
    const board = await loadTowerBoard({ finance: true });
    expect(board.cards.map((c) => c.key)).toEqual(
      BOARD_CARDS.map((c) => c.key),
    );
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
    // Pedido sem o fluxo do portal (como os do Sankhya): na etapa de preparação, só visibilidade.
    expect(where[0].key).toBe("ordPrepSankhya");

    // Sem Finanças: sem parcelas, sem "a receber" e sem valores.
    const operator = await loadTowerBoard({ finance: false });
    expect(operator.cards.map((c) => c.key)).not.toContain("parReceivable");
    expect(operator.cards.every((c) => c.value === null)).toBe(true);
  });
});
