import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Vários produtos numa solicitação só: cada produto vira uma solicitação; 2+ no mesmo lote. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createRequestBatch, batchSiblings, createRequest } =
  await import("@/lib/services/requests");
const { parseRequestItems } = await import("@/app/app/actions/request-items");
const { canViewRequest } = await import("@/lib/auth/permissions");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let maria: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  // Outro cliente (não existe no seed): mesmo papel, outra empresa.
  maria = {
    ...joao,
    id: "user-maria",
    partyId: "cliente-maria",
    email: "maria@atacado.com",
  };
});

const item = (
  name: string,
  extra: Partial<Parameters<typeof createRequestBatch>[2][number]> = {},
) => ({
  productId: null,
  productName: name,
  description: `Descrição ${name}`,
  specification: null,
  quantity: 10,
  unit: "un",
  sourcingDemand: false,
  ...extra,
});

describe("formulário com várias linhas", () => {
  it("lê as linhas pelo prefixo p<n>., aceita buracos e ignora campos soltos", () => {
    const form = new FormData();
    form.set("customerId", "cliente-joao");
    form.set("p0.productId", "prod-jarra");
    form.set("p0.productName", "");
    form.set("p0.description", "Jarra");
    form.set("p0.quantity", "1.200");
    form.set("p0.unit", "cx");
    // p1 foi removida na tela; p2 segue.
    form.set("p2.productName", "  Copo  ");
    form.set("p2.description", "Copo de vidro");
    form.set("p2.quantity", "50,5");
    form.set("p2.sourcingDemand", "on");
    form.append(
      "p2.attachments",
      new File([], "vazio.png", { type: "image/png" }),
    );
    form.append(
      "p2.attachments",
      new File(["x"], "foto.png", { type: "image/png" }),
    );
    const rows = parseRequestItems(form);
    expect(rows.map((r) => r.index)).toEqual([0, 2]);
    expect(rows[0]).toMatchObject({
      productId: "prod-jarra",
      productName: "",
      description: "Jarra",
      quantity: 1.2,
      unit: "cx",
      sourcingDemand: false,
    });
    expect(rows[0].attachments).toEqual([]);
    expect(rows[1]).toMatchObject({
      productId: null,
      productName: "Copo",
      quantity: 50.5,
      unit: "un",
      sourcingDemand: true,
    });
    // Arquivo vazio (input sem seleção) não conta.
    expect(rows[1].attachments.map((f) => f.name)).toEqual(["foto.png"]);
  });

  it("mais de 30 linhas: recusa antes de criar qualquer coisa", () => {
    const form = new FormData();
    for (let i = 0; i < 31; i++) form.set(`p${i}.productName`, `P${i}`);
    expect(() => parseRequestItems(form)).toThrow("too_many_products");
  });

  it("sem linhas: nada", () => {
    const form = new FormData();
    form.set("customerId", "cliente-joao");
    form.set("quantity", "3");
    expect(parseRequestItems(form)).toEqual([]);
  });
});

describe("lote de solicitações", () => {
  it("2+ produtos: uma solicitação por produto, mesmo lote, cada uma com seus dados", async () => {
    const store = getStore();
    const created = await createRequestBatch(
      joao,
      { customerId: "cliente-joao", deadline: null, notes: "Pedido grande" },
      [
        item("Jarra", { productId: "prod-jarra", quantity: 100 }),
        item("Copo", { quantity: 200, unit: "cx" }),
        item("Panela nova", { sourcingDemand: true }),
      ],
    );
    expect(created).toHaveLength(3);
    const groupId = created[0].groupId;
    expect(groupId).toBeTruthy();
    for (const r of created) {
      expect(r.groupId).toBe(groupId);
      expect(r.customerId).toBe("cliente-joao");
      expect(r.notes).toBe("Pedido grande");
      expect(r.status).toBe("REQUESTED");
    }
    expect(created.map((r) => r.productName)).toEqual([
      "Jarra",
      "Copo",
      "Panela nova",
    ]);
    expect(created.map((r) => r.quantity)).toEqual([100, 200, 10]);
    expect(created[1].unit).toBe("cx");
    expect(created.map((r) => r.origin)).toEqual([
      "manual",
      "manual",
      "sourcing_demand",
    ]);
    // Sourcing sob demanda só para o produto fora do catálogo.
    const sourcing = await store.list("sourcing_items", {
      filter: { requestId: created[2].id },
    });
    expect(sourcing).toHaveLength(1);
    expect(
      await store.list("sourcing_items", {
        filter: { requestId: created[0].id },
      }),
    ).toHaveLength(0);

    // Irmãos do lote: os outros dois, sem a própria.
    const siblings = await batchSiblings(created[1]);
    expect(siblings.map((r) => r.id).sort()).toEqual(
      [created[0].id, created[2].id].sort(),
    );
    // Auditoria do lote.
    const logs = await store.list("audit_log", {
      filter: { entityId: groupId! },
    });
    expect(logs.some((l) => l.action === "request.batch")).toBe(true);
  });

  it("um produto só: solicitação comum, sem lote (coluna não vai ao banco)", async () => {
    const [only] = await createRequestBatch(
      joao,
      { customerId: "cliente-joao", deadline: null, notes: null },
      [item("Sozinho")],
    );
    expect(only.groupId ?? null).toBeNull();
    expect(await batchSiblings(only)).toEqual([]);
    const plain = await createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Avulsa",
      description: "Avulsa",
      specification: null,
      quantity: 1,
      unit: "un",
      deadline: null,
      notes: null,
    });
    expect("groupId" in plain && plain.groupId != null).toBe(false);
  });

  it("sem produtos: recusa; cliente não cria lote para outro cliente", async () => {
    await expect(
      createRequestBatch(
        joao,
        { customerId: "cliente-joao", deadline: null, notes: null },
        [],
      ),
    ).rejects.toThrow("no_products");
    await expect(
      createRequestBatch(
        joao,
        { customerId: "cliente-maria", deadline: null, notes: null },
        [item("A"), item("B")],
      ),
    ).rejects.toThrow();
  });

  it("isolamento: outro cliente não vê as solicitações do lote nem seus irmãos", async () => {
    // Wellmix em nome do João: o lote inteiro fica com o solicitante dele.
    const created = await createRequestBatch(
      admin,
      {
        customerId: "cliente-joao",
        deadline: null,
        notes: null,
        requestedForUserId: joao.id,
      },
      [item("X"), item("Y")],
    );
    for (const r of created) expect(r.requestedForUserId).toBe(joao.id);
    for (const r of created) {
      expect(canViewRequest(joao, r)).toBe(true);
      expect(canViewRequest(maria, r)).toBe(false);
    }
    // A tela filtra os irmãos com canViewRequest; aqui só confirma a regra.
    const siblings = await batchSiblings(created[0]);
    expect(siblings.filter((r) => canViewRequest(maria, r))).toEqual([]);
  });
});
