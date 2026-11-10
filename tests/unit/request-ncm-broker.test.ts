import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* NCM da solicitação pelo despachante: ele recebe a pendência, vê só o produto
   (nada comercial), confirma antes do pedido; a Wellmix continua podendo. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const rn = await import("@/lib/services/request-ncm");
const r = await import("@/lib/services/requests");
const { pendingTasksFor } = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;

let admin: User;
let broker: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  broker = users.find((u) => u.email === "despachante@comex.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  await setSetting("aiMode", "MANUAL");
});

async function newRequest(productId: string | null, name: string) {
  return r.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: name,
    description: `${name} para classificar`,
    specification: "Material: vidro",
    quantity: 1000,
    unit: "un",
    deadline: null,
  });
}

const ncmTasks = async (user: User) =>
  (await pendingTasksFor(user)).filter((t) => t.kind === "ncm_classify");

describe("NCM da solicitação pelo despachante", () => {
  it("quem classifica: despachante com empresa e Wellmix; cliente e fornecedor não", () => {
    expect(rn.canClassifyNcm(admin)).toBe(true);
    expect(rn.canClassifyNcm(broker)).toBe(true);
    expect(rn.canClassifyNcm({ role: "broker", partyId: null })).toBe(false);
    expect(rn.canClassifyNcm(joao)).toBe(false);
    expect(rn.canClassifyNcm(supplierA)).toBe(false);
  });

  it("produto sem NCM vira pendência do despachante, que leva à tela só do NCM", async () => {
    const request = await newRequest(null, "Jarra de vidro sem cadastro");
    const tasks = await ncmTasks(broker);
    const mine = tasks.find(
      (t) => t.link === `/app/requests/${request.id}/ncm`,
    );
    expect(mine).toBeTruthy();
    expect(mine!.title).toContain("Jarra de vidro sem cadastro");
    // Nada do cliente na pendência do despachante.
    expect(mine!.customerId).toBeUndefined();
    // A Wellmix e o fornecedor não ganham essa pendência.
    expect(await ncmTasks(admin)).toEqual([]);
    expect(await ncmTasks(supplierA)).toEqual([]);
  });

  it("a tela do despachante traz o produto e nada comercial", async () => {
    const request = await newRequest(null, "Copo de vidro");
    const work = await rn.ncmWorkFor(broker, request.id);
    expect(work).toMatchObject({
      requestId: request.id,
      productName: "Copo de vidro",
      specification: "Material: vidro",
      editable: true,
      ncm: { status: "none" },
    });
    const keys = Object.keys(work!);
    for (const hidden of [
      "customerId",
      "quantity",
      "sellPrice",
      "supplierId",
      "requestedForUserId",
      "notes",
    ])
      expect(keys).not.toContain(hidden);
    expect(JSON.stringify(work)).not.toContain("cliente-joao");
    // Cliente e fornecedor não abrem.
    await expect(rn.ncmWorkFor(joao, request.id)).rejects.toThrow("forbidden");
    await expect(rn.ncmWorkFor(supplierA, request.id)).rejects.toThrow(
      "forbidden",
    );
  });

  it("despachante confirma: sai da fila, a solicitação usa o NCM e o cadastro o recebe", async () => {
    const store = getStore();
    const [product] = await store.list("products", { limit: 1 });
    await store.update("products", product.id, { ncm: null });
    const request = await newRequest(product.id, product.name);
    expect((await rn.requestNcm(request)).status).toBe("none");

    await expect(
      rn.confirmRequestNcm(joao, request.id, "7013.37.00", "manual"),
    ).rejects.toThrow("forbidden");
    await expect(
      rn.confirmRequestNcm(supplierA, request.id, "7013.37.00", "manual"),
    ).rejects.toThrow("forbidden");
    await expect(
      rn.confirmRequestNcm(broker, request.id, "7013", "manual"),
    ).rejects.toThrow("ncm_invalid");

    await rn.confirmRequestNcm(broker, request.id, "7013.37.00", "manual");
    const saved = (await store.get("requests", request.id))!;
    expect(saved).toMatchObject({
      ncm: "70133700",
      ncmConfirmedByUserId: broker.id,
    });
    expect((await rn.requestNcm(saved)).status).toBe("confirmed");
    expect((await store.get("products", product.id))?.ncm).toBe("7013.37.00");
    expect(
      (await ncmTasks(broker)).some(
        (t) => t.link === `/app/requests/${request.id}/ncm`,
      ),
    ).toBe(false);
    // O analista fica sabendo.
    const notices = await store.list("notifications", {
      filter: { link: `/app/requests/${request.id}#ncm` },
    });
    expect(notices.length).toBeGreaterThan(0);
    expect(notices.every((n) => n.role !== "broker")).toBe(true);
    // Outra solicitação do mesmo produto já nasce com o NCM do cadastro: sem pendência.
    const again = await newRequest(product.id, product.name);
    expect((await rn.requestNcm(again)).status).toBe("product");
    expect(
      (await ncmTasks(broker)).some(
        (t) => t.link === `/app/requests/${again.id}/ncm`,
      ),
    ).toBe(false);
  });

  it("a Wellmix continua confirmando, e o despachante não mexe depois do pedido nem em cancelada", async () => {
    const store = getStore();
    const request = await newRequest(null, "Taça de vidro");
    await rn.confirmRequestNcm(admin, request.id, "7013.28.00", "manual");
    expect((await store.get("requests", request.id))?.ncm).toBe("70132800");

    const ordered = await newRequest(null, "Prato de vidro");
    await store.update("requests", ordered.id, {
      status: "ORDERED",
      orderId: "pedido-qualquer",
    });
    await expect(
      rn.confirmRequestNcm(broker, ordered.id, "7013.49.00", "manual"),
    ).rejects.toThrow("ncm_closed");
    await expect(rn.suggestRequestNcm(broker, ordered.id)).rejects.toThrow(
      "ncm_closed",
    );
    expect((await rn.ncmWorkFor(broker, ordered.id))?.editable).toBe(false);

    const cancelled = await newRequest(null, "Tigela de vidro");
    await store.update("requests", cancelled.id, { status: "CANCELLED" });
    expect(await rn.ncmWorkFor(broker, cancelled.id)).toBeNull();
    await expect(
      rn.confirmRequestNcm(broker, cancelled.id, "7013.49.00", "manual"),
    ).rejects.toThrow("request_closed");
  });

  it("lote novo sem NCM: um aviso só para o despachante", async () => {
    const store = getStore();
    const inApp = { userId: broker.id, channel: "inapp" } as const;
    const before = (await store.list("notifications", { filter: inApp }))
      .length;
    const created = await r.createRequestBatch(
      joao,
      {
        customerId: "cliente-joao",
        deadline: null,
        notes: null,
        requestedForUserId: null,
      },
      ["Vaso de vidro", "Garrafa de vidro"].map((name) => ({
        productId: null,
        productName: name,
        description: name,
        specification: null,
        quantity: 500,
        unit: "un",
        sourcingDemand: false,
      })),
    );
    expect(created).toHaveLength(2);
    const after = await store.list("notifications", { filter: inApp });
    expect(after.length - before).toBe(1);
    const notice = after.find((n) => n.link === "/app/tasks");
    expect(notice?.subject).toContain("2");
  });
});
