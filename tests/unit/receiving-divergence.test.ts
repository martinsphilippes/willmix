import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Divergência no recebimento (mapa E24 a E27; dono, 14/11/2026;
 * docs/RECEIVING.md): sem divergência na contagem os passos não existem; com
 * ela nascem os quatro, uma vez só. Comunicar a Compras (qualidade faz,
 * planner valida) → Fornecedor (comprador ou o fornecedor pelo portal) e
 * Evidência (qualidade faz, analista valida) → Financeiro (financeiro faz,
 * diretoria de compras valida), que espera os dois.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const rc = await import("@/lib/services/receiving");
const f = await import("@/lib/services/import-flow");
const team = await import("@/lib/services/team");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { flowStepOfImportKey } = await import("@/lib/flow");
const { orderSubtasks } = await import("@/lib/services/milestones");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;
type WellmixFunction = import("@/lib/db/schema").WellmixFunction;

let admin: User;
let operator: User; // comprador e planner (demonstração)
let quality: User;
let finance: User;
let director: User;
let designer: User;
let supplierA: User;
let supplierB: User;
let order: Order;
let clean: Order;

async function member(email: string, fn: WellmixFunction): Promise<User> {
  const u = await getStore().create("users", {
    email,
    name: email.split("@")[0],
    role: "operator",
    partyId: null,
    locale: "pt",
    passwordHash: null,
    active: true,
    importerId: null,
  });
  await team.setTeamMember(admin, u.id, {
    jobLevel: null,
    managerUserId: null,
    division: null,
    functions: [fn],
  });
  return (await getStore().get("users", u.id))!;
}

async function newOrder(joao: User, name: string): Promise<Order> {
  const req = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: name,
    description: name,
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
    notes: null,
  });
  const o = await orderFromRequest(admin, req);
  return getStore().update("orders", o.id, { status: "DELIVERED" });
}

const fresh = async () => (await getStore().get("orders", order.id))!;
const rows = () =>
  getStore().list("import_steps", { filter: { orderId: order.id } });
const divergenceRows = async () =>
  (await rows()).filter((s) => f.isDivergenceStep(s.key));
const pdf = async (who: User) => {
  const { uploadDocument } = await import("@/lib/services/documents");
  return (
    await uploadDocument(
      who,
      new File(["%PDF-1.4 evidencia"], "evidencia.pdf", {
        type: "application/pdf",
      }),
      { orderId: order.id, type: "import_step", visibility: "internal" },
    )
  ).id;
};
const view = async (user: User) =>
  f.importFlowView(user, await fresh(), "divergence");
const keysOf = (tasks: { link?: string | null; kind: string }[]) =>
  tasks
    .filter((t) => (t.link ?? "").includes("#divergence-flow"))
    .map((t) => t.kind);

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  operator = by("operador@wellmix.com");
  supplierA = by("supplier.a@china.com");
  supplierB = by("supplier.b@china.com");
  const joao = by("joao@lojista.com");
  quality = await member("qualidade.div@wellmix.com", "quality");
  finance = await member("fin.div@wellmix.com", "finance");
  director = await member("diretor.div@wellmix.com", "purchasing_director");
  designer = await member("design.div@wellmix.com", "designer");
  order = await newOrder(joao, "Jarra divergência");
  clean = await newOrder(joao, "Jarra sem divergência");
});

describe("divergência no recebimento (E24 a E27)", () => {
  it("sem divergência na contagem, os passos não existem", async () => {
    const [item] = await getStore().list("order_items", {
      filter: { orderId: clean.id },
    });
    await rc.saveCounts(quality, clean.id, [
      { orderItemId: item.id, received: item.quantity, damaged: 0, note: null },
    ]);
    const steps = await getStore().list("import_steps", {
      filter: { orderId: clean.id },
    });
    expect(steps.filter((s) => f.isDivergenceStep(s.key))).toEqual([]);
    expect(await f.importFlowView(admin, clean, "divergence")).toEqual([]);
    expect(f.stepApplies(clean, "divergence_purchasing", false, steps)).toBe(
      false,
    );
    // Sem a lista dos passos, nunca vale.
    expect(f.stepApplies(clean, "divergence_purchasing")).toBe(false);
    await expect(
      f.submitStep(quality, clean.id, "divergence_purchasing", {
        value: "x",
      }),
    ).rejects.toThrow();
  });

  it("a primeira divergência cria os quatro passos pendentes, uma vez só", async () => {
    const [item] = await getStore().list("order_items", {
      filter: { orderId: order.id },
    });
    await rc.saveCounts(quality, order.id, [
      { orderItemId: item.id, received: 90, damaged: 0, note: "faltam 10" },
    ]);
    let div = await divergenceRows();
    expect(div.map((s) => s.key).sort()).toEqual(
      [...f.DIVERGENCE_STEPS].sort(),
    );
    expect(div.every((s) => s.status === "pending")).toBe(true);
    // Outra contagem com divergência (nova avaria): não recria.
    await rc.saveCounts(quality, order.id, [
      { orderItemId: item.id, received: 90, damaged: 2, note: "avaria" },
    ]);
    await f.openDivergenceSteps(admin, await fresh());
    div = await divergenceRows();
    expect(div).toHaveLength(4);
    // Cartão e menu: na Armazenagem (marco 16).
    expect((await view(admin)).map((v) => v.template.key)).toEqual(
      f.DIVERGENCE_STEPS,
    );
    for (const key of f.DIVERGENCE_STEPS)
      expect(flowStepOfImportKey(key)).toMatchObject({
        block: "delivery",
        key: "storage",
      });
    const subtasks = orderSubtasks({
      order: await fresh(),
      stages: [],
      requirements: [],
      importSteps: await rows(),
      track: null,
      receiving: null,
      lpco: false,
    }).filter((s) => f.isDivergenceStep(s.key));
    expect(subtasks).toHaveLength(4);
    expect(
      orderSubtasks({
        order: clean,
        stages: [],
        requirements: [],
        importSteps: [],
        track: null,
        receiving: null,
        lpco: false,
      }).filter((s) => f.isDivergenceStep(s.key)),
    ).toEqual([]);
  });

  it("quem faz e quem valida cada passo", async () => {
    const o = await fresh();
    // E24: qualidade faz, planner valida.
    expect(f.actsAs(quality, o, "quality")).toBe(true);
    expect(f.actsAs(designer, o, "quality")).toBe(false);
    expect(f.actsAs(operator, o, "planner")).toBe(true);
    expect(f.actsAs(quality, o, "planner")).toBe(false);
    // E25: comprador (e o fornecedor do pedido pelo portal).
    expect(f.actsAs(operator, o, "buyer")).toBe(true);
    expect(f.actsAs(designer, o, "buyer")).toBe(false);
    // E27: financeiro faz, diretoria de compras valida.
    expect(f.actsAs(finance, o, "finance")).toBe(true);
    expect(f.actsAs(director, o, "purchasing_director")).toBe(true);
    expect(f.actsAs(operator, o, "purchasing_director")).toBe(false);
    // O administrador age por todos.
    for (const actor of [
      "quality",
      "buyer",
      "planner",
      "finance",
      "purchasing_director",
    ] as const)
      expect(f.actsAs(admin, o, actor)).toBe(true);
    // Fornecedor: só o do pedido, e só a resposta.
    expect(await f.canSubmitStep(supplierA, o, "divergence_supplier")).toBe(
      true,
    );
    expect(await f.canSubmitStep(supplierB, o, "divergence_supplier")).toBe(
      false,
    );
    expect(await f.canSubmitStep(supplierA, o, "divergence_purchasing")).toBe(
      false,
    );
    expect(f.canSeeStep(supplierA, o, "divergence_supplier")).toBe(true);
    expect(f.canSeeStep(supplierA, o, "divergence_evidence")).toBe(false);
  });

  it("E24 primeiro: fornecedor e evidência esperam; a qualidade comunica e o planner valida", async () => {
    await expect(
      f.submitStep(operator, order.id, "divergence_supplier", {
        value: "ok",
        choice: "accepts",
      }),
    ).rejects.toThrow("previous_step");
    await expect(
      f.submitStep(quality, order.id, "divergence_evidence", {
        value: "fotos",
        documentId: await pdf(quality),
      }),
    ).rejects.toThrow("previous_step");
    await expect(
      f.submitStep(designer, order.id, "divergence_purchasing", {
        value: "x",
      }),
    ).rejects.toThrow();
    // Tarefa de fazer: da qualidade (não do designer).
    expect(keysOf(await pendingTasksFor(quality))).toContain("import_step");
    expect(keysOf(await pendingTasksFor(designer))).toEqual([]);
    expect(keysOf(await pendingTasksFor(finance))).toEqual([]);
    await f.submitStep(quality, order.id, "divergence_purchasing", {
      value: "Faltam 10 peças do SKU 1",
    });
    // Validar: do planner (o operador da demonstração), não da qualidade.
    expect(keysOf(await pendingTasksFor(operator))).toContain(
      "import_validate",
    );
    expect(keysOf(await pendingTasksFor(quality))).toEqual([]);
    await expect(
      f.validateStep(
        quality,
        order.id,
        "divergence_purchasing",
        "validated",
        null,
      ),
    ).rejects.toThrow();
    await expect(
      f.validateStep(
        designer,
        order.id,
        "divergence_purchasing",
        "validated",
        null,
      ),
    ).rejects.toThrow();
    await f.validateStep(
      operator,
      order.id,
      "divergence_purchasing",
      "validated",
      null,
    );
    const v = await view(operator);
    expect(v.find((x) => x.template.key === "divergence_supplier")?.ready).toBe(
      true,
    );
    expect(v.find((x) => x.template.key === "divergence_evidence")?.ready).toBe(
      true,
    );
  });

  it("E27 espera a resposta do fornecedor e a evidência validada", async () => {
    let v = await view(finance);
    const fin = () => v.find((x) => x.template.key === "divergence_finance")!;
    expect(fin().ready).toBe(false);
    expect(fin().canSubmit).toBe(false);
    // Resposta do fornecedor: exige a escolha e o texto.
    await expect(
      f.submitStep(supplierA, order.id, "divergence_supplier", {
        value: "Vamos repor",
      }),
    ).rejects.toThrow("choice_required");
    await expect(
      f.submitStep(supplierB, order.id, "divergence_supplier", {
        value: "x",
        choice: "accepts",
      }),
    ).rejects.toThrow();
    // A tarefa da resposta: do comprador e do fornecedor do pedido.
    expect(keysOf(await pendingTasksFor(supplierA))).toContain("import_step");
    expect(keysOf(await pendingTasksFor(supplierB))).toEqual([]);
    const reply = await f.submitStep(
      supplierA,
      order.id,
      "divergence_supplier",
      { value: "Repomos no próximo embarque", choice: "replaces" },
    );
    expect(reply.value).toBe("replaces:Repomos no próximo embarque");
    expect(
      f.parseChoice(f.stepTemplate("divergence_supplier"), reply.value),
    ).toEqual({ choice: "replaces", text: "Repomos no próximo embarque" });
    v = await view(finance);
    expect(fin().ready).toBe(false);
    // Evidência: arquivo obrigatório; o analista (Wellmix) valida.
    await expect(
      f.submitStep(quality, order.id, "divergence_evidence", {
        value: "fotos",
      }),
    ).rejects.toThrow("file_required");
    await f.submitStep(quality, order.id, "divergence_evidence", {
      value: "Fotos das caixas",
      documentId: await pdf(quality),
    });
    await expect(
      f.validateStep(
        quality,
        order.id,
        "divergence_evidence",
        "validated",
        null,
      ),
    ).rejects.toThrow("own_step");
    await f.validateStep(
      admin,
      order.id,
      "divergence_evidence",
      "validated",
      null,
    );
    v = await view(finance);
    expect(fin().ready).toBe(true);
    expect(fin().canSubmit).toBe(true);
    expect(
      (await view(operator)).find(
        (x) => x.template.key === "divergence_finance",
      )?.canSubmit,
    ).toBe(false);
    expect(keysOf(await pendingTasksFor(finance))).toContain("import_step");
  });

  it("o financeiro registra o resultado e a diretoria de compras valida", async () => {
    await expect(
      f.submitStep(operator, order.id, "divergence_finance", {
        choice: "discount",
        amount: 100,
        documentId: await pdf(admin),
      }),
    ).rejects.toThrow();
    await expect(
      f.submitStep(finance, order.id, "divergence_finance", {
        choice: "discount",
      }),
    ).rejects.toThrow("amount_required");
    // Sem valor: nem valor nem arquivo.
    const none = await f.submitStep(finance, order.id, "divergence_finance", {
      choice: "none",
      value: "Reposição no próximo pedido",
    });
    expect(none.amount).toBeNull();
    const step = await f.submitStep(finance, order.id, "divergence_finance", {
      choice: "credit",
      amount: 250,
      documentId: await pdf(finance),
    });
    expect(step).toMatchObject({
      value: "credit",
      amount: 250,
      currency: "BRL",
    });
    expect(keysOf(await pendingTasksFor(director))).toContain(
      "import_validate",
    );
    expect(keysOf(await pendingTasksFor(operator))).not.toContain(
      "import_validate",
    );
    await expect(
      f.validateStep(
        operator,
        order.id,
        "divergence_finance",
        "validated",
        null,
      ),
    ).rejects.toThrow();
    await f.validateStep(
      director,
      order.id,
      "divergence_finance",
      "validated",
      null,
    );
    const v = await view(admin);
    expect(v.every((x) => x.done)).toBe(true);
  });
});
