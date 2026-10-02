import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Estoque por produto: itens de container sem pedido, em containers não encerrados. */
withTempStore();

const { seedDemo } = await import("@/lib/seed");
const {
  createContainer,
  addContainerItem,
  setContainerStatus,
  availableStockByProduct,
} = await import("@/lib/services/containers");
type User = import("@/lib/db").User;

let admin: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("estoque disponível por produto", () => {
  it("soma itens sem pedido, separa o que está a caminho e ignora encerrados", async () => {
    const before = await availableStockByProduct();
    const base = before.get("prod-jarra")?.quantity ?? 0;
    const baseTransit = before.get("prod-jarra")?.inTransit ?? 0;

    const arrived = await createContainer(admin, {
      code: "STK-ARR",
      type: "40HC",
    });
    await addContainerItem(admin, arrived.id, {
      productId: "prod-jarra",
      name: "Jarra",
      quantity: 100,
      unitsPerBox: 10,
      cbmPerBox: 0.05,
    });
    await setContainerStatus(admin, arrived.id, "arrived");

    const shipping = await createContainer(admin, {
      code: "STK-SHP",
      type: "40HC",
    });
    await addContainerItem(admin, shipping.id, {
      productId: "prod-jarra",
      name: "Jarra",
      quantity: 40,
      unitsPerBox: 10,
      cbmPerBox: 0.05,
    });

    const closed = await createContainer(admin, {
      code: "STK-CLS",
      type: "40HC",
    });
    await addContainerItem(admin, closed.id, {
      productId: "prod-jarra",
      name: "Jarra",
      quantity: 999,
      unitsPerBox: 10,
      cbmPerBox: 0.05,
    });
    await setContainerStatus(admin, closed.id, "closed");

    const stock = (await availableStockByProduct()).get("prod-jarra")!;
    expect(stock.quantity).toBe(base + 140);
    expect(stock.inTransit).toBe(baseTransit + 40);
  });
});
