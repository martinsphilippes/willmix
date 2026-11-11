import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * RFQ em espera (docs/RFQ_STANDBY.md): com `rfqEnabled` desligado (o padrão),
 * cada produto vai para um fornecedor só; a tela não deixa mandar a vários
 * nem a um segundo fornecedor. Com a RFQ ligada, tudo volta a ser como antes
 * (a solicitação espera a abertura da RFQ).
 */
withTempStore();

const { getStore, PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const requests = await import("@/lib/services/requests");
const { saveProductSheet } = await import("@/lib/services/product-sheet");
const { getSettings, setSetting } = await import("@/lib/settings");
const { pendingTasksFor: listTasks } = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;

let admin: User;
let supplierA: User;
let lineId: string;
let seq = 0;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  lineId = (await getStore().list("product_lines", { orderBy: "name" }))[0].id;
});

/** Solicitação (em nome de um cliente) de um produto do fornecedor dado. */
async function row(supplierId: string | null) {
  seq++;
  const product = await getStore().create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId,
    name: `Vaso ${seq}`,
    sku: null,
    specification: null,
    supplierId,
    active: true,
    source: "import",
  } as never);
  await saveProductSheet(admin, product.id, {
    factoryItemCode: `V-${seq}`,
    price: 4,
    currency: "USD",
    moq: 120,
    masterCartonQty: 12,
    netWeightPcKg: 0.2,
    cbmPerCarton: 0.02,
  });
  const request = await requests.createRequest(admin, {
    customerId: "cliente-joao",
    productId: product.id,
    productName: product.name,
    description: "RFQ em espera",
    specification: null,
    quantity: 1200,
    unit: "un",
    deadline: null,
  });
  return { request, product };
}

describe("RFQ em espera", () => {
  it("vem desligada por padrão", async () => {
    expect((await getSettings()).rfqEnabled).toBe(false);
  });

  it("produto sem fornecedor fica esperando na solicitação (enviar ao fornecedor)", async () => {
    const lone = await row(null);
    const { request } = lone;
    expect((await getStore().get("requests", request.id))?.status).toBe(
      "REQUESTED",
    );
    const tasks = await listTasks(admin);
    // A pendência leva à tela Pedidos → RFQ, onde o envio é feito (o cartão
    // saiu da tela da solicitação).
    expect(
      tasks.find(
        (task) => task.title === `Enviar ao fornecedor: ${lone.product.name}`,
      )?.link,
    ).toBe(`/app/rfq#req-${request.id}`);
    // Enviado a um fornecedor: a solicitação segue e a pendência some.
    await requests.assertRfqStandby([request.id], ["fornecedor-b"]);
    await requests.openRfq(admin, request.id, ["fornecedor-b"]);
    expect((await getStore().get("requests", request.id))?.status).toBe(
      "RFQ_OPEN",
    );
    expect(
      (await listTasks(admin)).some(
        (task) => task.title === `Enviar ao fornecedor: ${lone.product.name}`,
      ),
    ).toBe(false);
  });

  it("a tela recusa vários fornecedores e um segundo fornecedor depois do envio", async () => {
    const { request } = await row(supplierA.partyId);
    await requests.openRfq(admin, request.id, ["fornecedor-a"]);
    const refusal = async (ids: string[]) => {
      try {
        await requests.assertRfqStandby([request.id], ids);
      } catch (error) {
        return (error as Error).message;
      }
      return "ok";
    };
    expect(await refusal(["fornecedor-a", "fornecedor-b"])).toBe(
      "rfq_standby_one",
    );
    expect(await refusal(["fornecedor-b"])).toBe("rfq_standby_sent");
    expect(await refusal(["fornecedor-a"])).toBe("ok");
  });

  it("com a RFQ ligada, a solicitação espera a RFQ e a tela aceita vários", async () => {
    await setSetting("rfqEnabled", true);
    try {
      const a = await row(supplierA.partyId);
      const { request } = a;
      expect((await getStore().get("requests", request.id))?.status).toBe(
        "REQUESTED",
      );
      expect(
        await getStore().list("quotes", { filter: { requestId: request.id } }),
      ).toHaveLength(0);
      await requests.assertRfqStandby(
        [request.id],
        ["fornecedor-a", "fornecedor-b"],
      );
      const tasks = await listTasks(admin);
      expect(
        tasks.some((task) => task.title === `Abrir RFQ: ${a.product.name}`),
      ).toBe(true);
    } finally {
      await setSetting("rfqEnabled", false);
    }
  });
});
