import { beforeAll, describe, expect, it } from "vitest";
import { reachSignature, signOrderAs, withTempStore } from "./setup";

/*
 * Pendências do fornecedor (pedido do dono, 10/11/2026): o filtro é a etapa
 * que chega na mão dele, do Booking ao embarque (`supplier.<etapa>`), a
 * assinatura do documento é uma etapa à parte, e cada pendência diz desde
 * quando está com ele e quando o produto foi carregado no sistema. Os outros
 * papéis continuam com os grupos de antes.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const {
  SUPPLIER_STEPS,
  filterTasks,
  pendingTasksFor,
  supplierGroup,
  supplierStepOfGroup,
  taskGroups,
} = await import("@/lib/services/tasks");
const { translator } = await import("@/i18n");
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

async function request(name: string, productId: string | null = null) {
  return r.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: name,
    description: name,
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    notes: null,
  });
}

async function newOrder(name: string) {
  const req = await request(name);
  return orderFromRequest(admin, req, {
    price: 3.6,
    sellPrice: 10_000,
    downPaymentAmount: 3000,
  });
}

const mine = async () => pendingTasksFor(supplierA);

describe("pendências do fornecedor por etapa", () => {
  it("toda etapa do caminho tem nome e explicação nos três idiomas", () => {
    expect([...SUPPLIER_STEPS]).toEqual([
      "booking",
      "request",
      "dieline",
      "sheet",
      "art",
      "sign",
      "inspection",
      "shipping",
    ]);
    for (const locale of ["pt", "en", "zh"] as const) {
      const t = translator(locale);
      for (const step of SUPPLIER_STEPS) {
        const name = `tasks.group.${supplierGroup(step)}`;
        const help = `supplierTasks.help.${step}`;
        expect(t(name as never), name).not.toBe(name);
        expect(t(help as never), help).not.toBe(help);
      }
    }
    expect(supplierStepOfGroup("supplier.sign")).toBe("sign");
    expect(supplierStepOfGroup("supplier.outra")).toBeNull();
    expect(supplierStepOfGroup("PACKAGING")).toBeNull();
  });

  it("pedido: ficha de compra, aprovar a arte e assinar são etapas separadas, na ordem do caminho", async () => {
    const order = await newOrder("Pedido das etapas");
    const ofOrder = async () =>
      (await mine()).filter((t) => t.orderNumber === order.number);
    // Preparação aberta: a ficha de compra é dele.
    await reachSignature(admin, order.id, "packaging");
    // (a Wellmix concluiu a Preparação no lugar dele: nada de ficha pendente)
    expect((await ofOrder()).some((t) => t.group === "supplier.sheet")).toBe(
      false,
    );
    // Arte enviada e documento enviado para assinatura: a arte chega a ele;
    // a assinatura ainda espera a Wellmix.
    await reachSignature(admin, order.id);
    let tasks = await ofOrder();
    const art = tasks.find((t) => t.group === "supplier.art")!;
    expect(art.kind).toBe("requirement");
    expect(art.link).toBe(`/app/orders/${order.id}`);
    expect(tasks.some((t) => t.group === "supplier.sign")).toBe(false);
    // O filtro da etapa acha a pendência; o de outra etapa, não.
    const links = (group: string) =>
      filterTasks(tasks, { group }).map((t) => t.link);
    expect(links("supplier.art")).toContain(art.link);
    expect(links("supplier.sign")).not.toContain(art.link);
    // A Wellmix continua com os grupos dela (nenhum "supplier.*").
    expect(
      (await pendingTasksFor(admin)).some((t) => supplierStepOfGroup(t.group)),
    ).toBe(false);
    // Está com ele desde que a arte foi enviada.
    const [artRow] = await getStore().list("requirements", {
      filter: { orderId: order.id, key: "art" },
    });
    expect(art.sinceAt).toBe(artRow.submittedAt);
    expect(art.loadedAt).toBeTruthy();
    // A Wellmix assina: a assinatura passa a ser dele, em linha própria,
    // levando direto ao documento.
    await signOrderAs(admin, order.id);
    tasks = await ofOrder();
    const sign = tasks.find((t) => t.group === "supplier.sign")!;
    expect(sign.link).toBe(`/app/orders/${order.id}/purchase-order`);
    expect(sign.detail).toContain("assinado pelo fornecedor");
    expect(tasks.find((t) => t.group === "supplier.art")!.detail).not.toContain(
      "assinado",
    );
    const [wellmixRow] = await getStore().list("requirements", {
      filter: { orderId: order.id, key: "order_signed_wellmix" },
    });
    expect(sign.sinceAt).toBe(wellmixRow.submittedAt);
    // Etapas na ordem do caminho (arte antes de assinar).
    const groups = taskGroups(tasks).map((g) => g.group);
    expect(groups.indexOf("supplier.art")).toBeLessThan(
      groups.indexOf("supplier.sign"),
    );
    // Assinou: a pendência da assinatura some.
    await signOrderAs(supplierA, order.id);
    expect((await ofOrder()).some((t) => t.group === "supplier.sign")).toBe(
      false,
    );
  });
});
