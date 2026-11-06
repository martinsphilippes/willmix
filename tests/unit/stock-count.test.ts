import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Estoque: baixa por venda (nunca mais do que há no Brasil) e inventário às
 * cegas: duas chances; errou as duas, o admin é avisado, aprova a quantidade
 * e a diferença vira perda ligada ao inventário.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const c = await import("@/lib/services/containers");
const inv = await import("@/lib/services/inventory");
const s = await import("@/lib/services/stock");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;
let customer: User;

const brazil = async (productId: string) =>
  (await inv.loadInventory()).find((r) => r.productId === productId)?.brazil ??
  0;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  customer = users.find((u) => u.email === "joao@lojista.com")!;
  // 100 panelas e 48 bonecas em estoque livre num container já chegado.
  const container = await c.createContainer(admin, {
    code: "EST-1",
    type: "40HC",
    capacityCbm: 68,
  });
  await c.addContainerItem(admin, container.id, {
    productId: "prod-panela",
    quantity: 100,
  });
  await c.addContainerItem(admin, container.id, {
    productId: "prod-boneca",
    quantity: 48,
  });
  await getStore().update("containers", container.id, { status: "arrived" });
});

describe("countOutcome", () => {
  it("bate, tenta de novo ou vai ao admin", () => {
    expect(s.countOutcome(10, 10, 1)).toBe("ok");
    expect(s.countOutcome(10, 9, 1)).toBe("retry");
    expect(s.countOutcome(10, 9, 2)).toBe("review");
    expect(s.countOutcome(10, 10, 2)).toBe("ok");
  });
});

describe("baixa por venda", () => {
  it("tira do estoque no Brasil e da vitrine; não deixa passar do que há", async () => {
    expect(await brazil("prod-panela")).toBe(100);
    await s.recordSaleOut(operator, {
      productId: "prod-panela",
      quantity: 30,
      orderId: null,
      note: "NF 123",
    });
    expect(await brazil("prod-panela")).toBe(70);
    expect(
      (await c.availableStockByProduct()).get("prod-panela")?.quantity,
    ).toBe(70);
    await expect(
      s.recordSaleOut(operator, {
        productId: "prod-panela",
        quantity: 71,
        orderId: null,
        note: null,
      }),
    ).rejects.toThrow("stock_insufficient");
    await expect(
      s.recordSaleOut(customer, {
        productId: "prod-panela",
        quantity: 1,
        orderId: null,
        note: null,
      }),
    ).rejects.toThrow();
  });
});

describe("inventário às cegas", () => {
  it("só o admin abre; duas chances; admin aprova e a perda fica registrada", async () => {
    await expect(s.startStockCount(operator, null)).rejects.toThrow();
    const count = await s.startStockCount(admin, "Fim do mês");
    await expect(s.startStockCount(admin, null)).rejects.toThrow(
      "count_already_open",
    );
    const items = await getStore().list("stock_count_items", {
      filter: { countId: count.id },
    });
    const panela = items.find((i) => i.productId === "prod-panela")!;
    const boneca = items.find((i) => i.productId === "prod-boneca")!;
    expect(panela.expected).toBe(70);

    // Boneca confere de primeira.
    expect((await s.submitStockCount(operator, boneca.id, 48)).outcome).toBe(
      "ok",
    );
    // Panela: erra duas vezes.
    expect((await s.submitStockCount(operator, panela.id, 65)).outcome).toBe(
      "retry",
    );
    const before = (await getStore().list("notifications")).length;
    expect((await s.submitStockCount(operator, panela.id, 66)).outcome).toBe(
      "review",
    );
    const adminNotes = (await getStore().list("notifications")).filter(
      (n) => n.userId === admin.id,
    );
    expect((await getStore().list("notifications")).length).toBeGreaterThan(
      before,
    );
    expect(adminNotes.some((n) => n.subject.includes(`#${count.number}`))).toBe(
      true,
    );
    // Sem terceira chance; fechar exige tudo resolvido; só o admin aprova.
    await expect(s.submitStockCount(operator, panela.id, 70)).rejects.toThrow(
      "count_item_done",
    );
    await expect(s.closeStockCount(admin, count.id)).rejects.toThrow(
      "count_unfinished",
    );
    await expect(
      s.approveStockCountItem(operator, panela.id, 66, null),
    ).rejects.toThrow();

    const approved = await s.approveStockCountItem(
      admin,
      panela.id,
      66,
      "Caixa avariada",
    );
    expect(approved).toMatchObject({ status: "approved", difference: -4 });
    const losses = (await inv.listStockMovements()).filter(
      (m) => m.kind === "count_loss",
    );
    expect(losses).toHaveLength(1);
    expect(losses[0]).toMatchObject({
      productId: "prod-panela",
      quantity: -4,
      countId: count.id,
    });
    expect(await brazil("prod-panela")).toBe(66);

    // Tentativas gravadas no item.
    const saved = await getStore().get("stock_count_items", panela.id);
    expect(saved).toMatchObject({ attempt1Qty: 65, attempt2Qty: 66 });

    await s.closeStockCount(admin, count.id);
    expect((await getStore().get("stock_counts", count.id))?.status).toBe(
      "closed",
    );
    await expect(s.submitStockCount(operator, boneca.id, 48)).rejects.toThrow(
      "count_closed",
    );
  });
});
