import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Novo produto com aprovação (dono, 17/11/2026; docs/NEW_PRODUCT.md): a tela
 * "Novo produto" cria o produto inativo e aguardando aprovação; a pendência
 * vai para o administrador e para os superiores de quem pediu (o "Responde
 * a"); aprovado, fica ativo e segue para o Sankhya; recusado (com o motivo),
 * continua inativo até ser corrigido e reenviado. "Restaurar", a caixa
 * "Produto ativo" e a sincronização com o Sankhya não passam por cima.
 */
const h = vi.hoisted(() => ({
  current: null as unknown,
  redirects: [] as string[],
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    h.redirects.push(to);
  },
  notFound: () => {
    throw new Error("not_found");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.current,
}));

withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const approval = await import("@/lib/services/product-approval");
const pure = await import("@/lib/product-approval");
const catalog = await import("@/app/app/actions/catalog");
const approvalActions = await import("@/app/app/actions/product-approval");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { tasksForFunctions, kindGate } = await import("@/lib/task-owner");
const { flowStepsOf } = await import("@/lib/flow");
const { setProductsActive } = await import("@/lib/services/product-delete");
const { listPendingSync } = await import("@/lib/integrations/sankhya-sync");
type User = import("@/lib/db").User;
type Product = import("@/lib/db").Product;

let admin: User;
/** Comprador (abre Produtos); responde à diretoria. */
let buyer: User;
/** Diretoria de compras: o superior do comprador. */
let director: User;
/** Vendas: colega, sem relação com o comprador. */
let sales: User;
let lineId: string;

async function notesFor(userId: string) {
  return getStore().list("notifications", { filter: { userId } });
}

beforeAll(async () => {
  const { users } = await seedDemo();
  const store = getStore();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  director = users.find((u) => u.email === "diretoria@wellmix.com")!;
  sales = users.find((u) => u.email === "vendas@wellmix.com")!;
  buyer = await store.update(
    "users",
    users.find((u) => u.email === "operador@wellmix.com")!.id,
    { managerUserId: director.id },
  );
  const [line] = await store.list("product_lines", { limit: 1 });
  lineId = line.id;
});

describe("regras puras", () => {
  const team = [
    { id: "a", name: "A", role: "operator", active: true, managerUserId: "b" },
    { id: "b", name: "B", role: "operator", active: false, managerUserId: "c" },
    { id: "c", name: "C", role: "operator", active: true, managerUserId: "d" },
    {
      id: "d",
      name: "D",
      role: "operator",
      active: true,
      loginSuspended: true,
      managerUserId: "a",
    },
    { id: "z", name: "Z", role: "admin", active: true, managerUserId: null },
  ];

  it("superiores: quem saiu ou está suspenso não aprova, a cadeia segue; ciclo não volta a quem pediu", () => {
    expect(pure.superiorsOf("a", team).map((n) => n.id)).toEqual(["c"]);
    expect(pure.superiorsOf(null, team)).toEqual([]);
  });

  it("decide: o administrador sempre; o superior; nunca quem pediu", () => {
    expect(pure.canDecideApproval({ id: "z", role: "admin" }, "a", team)).toBe(
      true,
    );
    expect(
      pure.canDecideApproval({ id: "c", role: "operator" }, "a", team),
    ).toBe(true);
    expect(
      pure.canDecideApproval({ id: "a", role: "operator" }, "a", team),
    ).toBe(false);
    // Saiu da equipe: não decide.
    expect(
      pure.canDecideApproval({ id: "b", role: "operator" }, "a", team),
    ).toBe(false);
    expect(
      pure.canDecideApproval({ id: "c", role: "operator" }, null, team),
    ).toBe(false);
  });

  it("aguarda aprovação só inativo, pendente ou recusado", () => {
    expect(
      pure.awaitingApproval({ active: false, approvalStatus: "pending" }),
    ).toBe(true);
    expect(
      pure.awaitingApproval({ active: false, approvalStatus: "rejected" }),
    ).toBe(true);
    expect(
      pure.awaitingApproval({ active: true, approvalStatus: "pending" }),
    ).toBe(false);
    expect(
      pure.awaitingApproval({ active: false, approvalStatus: "approved" }),
    ).toBe(false);
    expect(pure.awaitingApproval({ active: false })).toBe(false);
    expect(
      pure.pendingApproval({ active: false, approvalStatus: "rejected" }),
    ).toBe(false);
  });
});

describe("pendência de aprovação", () => {
  it("passo do menu: Cadastros → Produtos; na tela Produtos", () => {
    expect(
      flowStepsOf({ kind: "product_approve" } as never).map(
        (s) => `${s.block}/${s.key}`,
      ),
    ).toEqual(["registry/products"]);
    expect(kindGate("product_approve")).toEqual({ screen: "products" });
  });
});

describe("fluxo do produto novo", () => {
  let product: Product;

  it("a tela Novo produto cria inativo, aguardando aprovação, e abre a ficha", async () => {
    h.current = buyer;
    h.redirects = [];
    const form = new FormData();
    form.set("name", "Garrafa térmica 500 ml");
    form.set("sku", "GT-500");
    form.set("lineId", lineId);
    form.set("material", "Inox");
    form.set("moq", "1000");
    form.append("active", "off");
    form.append("active", "on");
    form.set("specificationAuto", "1");
    await catalog.createProductSheetAction(form);
    expect(h.redirects).toHaveLength(1);
    const match = h.redirects[0].match(
      /^\/app\/products\/([^/?]+)\?created=1$/,
    );
    expect(match).not.toBeNull();
    product = (await getStore().get("products", match![1]))!;
    expect(product).toMatchObject({
      name: "Garrafa térmica 500 ml",
      sku: "GT-500",
      material: "Inox",
      moq: 1000,
      source: "manual",
      // A caixa "ativo" do envio não vale: nasce inativo.
      active: false,
      approvalStatus: "pending",
      approvalRequestedByUserId: buyer.id,
    });
    expect(product.approvalRequestedAt).toBeTruthy();
    // Especificação automática montada com os dados.
    expect(product.specification).toContain("Inox");
    // O superior recebe o aviso; o administrador não (vê em Pendências).
    expect(
      (await notesFor(director.id)).some((n) =>
        n.link?.startsWith(`/app/products/${product.id}`),
      ),
    ).toBe(true);
    expect(
      (await notesFor(admin.id)).some((n) =>
        n.link?.startsWith(`/app/products/${product.id}`),
      ),
    ).toBe(false);
    const audits = await getStore().list("audit_log", {
      filter: { entityId: product.id },
    });
    expect(audits.map((a) => a.action)).toContain("product.create");
  });

  it("Pendências: o administrador e o superior veem; o colega e quem pediu, não", async () => {
    const approves = async (who: User) =>
      tasksForFunctions(who, await pendingTasksFor(who)).filter(
        (t) => t.kind === "product_approve" && t.link.includes(product.id),
      );
    const forAdmin = await approves(admin);
    expect(forAdmin).toHaveLength(1);
    expect(forAdmin[0]).toMatchObject({
      group: "product_approve",
      link: `/app/products/${product.id}#approval`,
      ownerUserId: director.id,
    });
    expect(forAdmin[0].text?.values).toMatchObject({
      name: "Garrafa térmica 500 ml",
      sku: "GT-500",
      requester: buyer.name,
    });
    expect(await approves(director)).toHaveLength(1);
    expect(await approves(sales)).toHaveLength(0);
    expect(await approves(buyer)).toHaveLength(0);
  });

  it("fora do catálogo enquanto aguarda: 'Restaurar' e o Sankhya não passam por cima", async () => {
    expect(await setProductsActive(admin, [product.id], true)).toEqual({
      changed: 0,
      skipped: 1,
    });
    expect((await getStore().get("products", product.id))!.active).toBe(false);
    const pending = await listPendingSync({
      syncSince: "2000-01-01T00:00:00.000Z",
    } as never);
    expect(pending.products.map((p) => p.row.id)).not.toContain(product.id);
  });

  it("a caixa 'Produto ativo' da ficha não ativa o produto aguardando aprovação", async () => {
    h.current = admin;
    h.redirects = [];
    const form = new FormData();
    form.set("id", product.id);
    form.set("name", product.name);
    form.set("lineId", product.lineId);
    form.set("sku", product.sku ?? "");
    form.set("material", "Inox 304");
    form.append("active", "off");
    form.append("active", "on");
    await catalog.updateProductSheetAction(form);
    expect(h.redirects).toEqual([`/app/products/${product.id}?saved=1`]);
    const after = (await getStore().get("products", product.id))!;
    expect(after.material).toBe("Inox 304");
    expect(after.active).toBe(false);
    expect(after.approvalStatus).toBe("pending");
  });

  it("só o administrador ou um superior decide; recusar pede o motivo", async () => {
    await expect(
      approval.decideProductApproval(sales, product.id, {
        approve: true,
        note: null,
      }),
    ).rejects.toThrow("approval_forbidden");
    await expect(
      approval.decideProductApproval(buyer, product.id, {
        approve: true,
        note: null,
      }),
    ).rejects.toThrow("approval_forbidden");
    await expect(
      approval.decideProductApproval(director, product.id, {
        approve: false,
        note: "  ",
      }),
    ).rejects.toThrow("approval_reject_note");
  });

  it("o superior recusa pela tela: continua inativo, com o motivo, e quem pediu é avisado", async () => {
    h.current = director;
    h.redirects = [];
    const form = new FormData();
    form.set("productId", product.id);
    form.set("decision", "reject");
    form.set("note", "Falta a medida da caixa master");
    await approvalActions.decideProductApprovalAction(form);
    expect(h.redirects).toEqual([
      `/app/products/${product.id}?approval=rejected`,
    ]);
    const after = (await getStore().get("products", product.id))!;
    expect(after).toMatchObject({
      active: false,
      approvalStatus: "rejected",
      approvalDecidedByUserId: director.id,
      approvalNote: "Falta a medida da caixa master",
    });
    const note = (await notesFor(buyer.id)).find((n) =>
      n.link?.startsWith(`/app/products/${product.id}`),
    );
    expect(note?.body).toContain("Falta a medida da caixa master");
    // Recusado não é pendência de ninguém; aparece o "Reenviar" na ficha.
    expect(
      (await pendingTasksFor(admin)).filter(
        (t) => t.kind === "product_approve" && t.link.includes(product.id),
      ),
    ).toHaveLength(0);
    const view = await approval.productApprovalView(buyer, after);
    expect(view).toMatchObject({
      status: "rejected",
      canResubmit: true,
      canDecide: false,
      note: "Falta a medida da caixa master",
    });
    // Decidido não se decide de novo.
    await expect(
      approval.decideProductApproval(admin, product.id, {
        approve: true,
        note: null,
      }),
    ).rejects.toThrow("approval_not_pending");
  });

  it("corrigido e reenviado: volta para a aprovação com a recusa anterior; o administrador aprova", async () => {
    h.current = buyer;
    h.redirects = [];
    const form = new FormData();
    form.set("productId", product.id);
    await approvalActions.resubmitProductApprovalAction(form);
    expect(h.redirects).toEqual([
      `/app/products/${product.id}?approval=resubmitted#approval`,
    ]);
    let after = (await getStore().get("products", product.id))!;
    expect(after.approvalStatus).toBe("pending");
    expect(after.approvalNote).toBe("Falta a medida da caixa master");
    const view = await approval.productApprovalView(director, after);
    expect(view).toMatchObject({
      status: "pending",
      canDecide: true,
      superiorName: director.name,
    });
    // Reenviar só o recusado.
    await expect(
      approval.resubmitProductApproval(buyer, product.id),
    ).rejects.toThrow("approval_not_rejected");

    after = await approval.decideProductApproval(admin, product.id, {
      approve: true,
      note: null,
    });
    expect(after).toMatchObject({
      active: true,
      approvalStatus: "approved",
      approvalDecidedByUserId: admin.id,
    });
    expect(await approval.productApprovalView(admin, after)).toBeNull();
    const done = (await notesFor(buyer.id)).filter((n) =>
      n.link?.startsWith(`/app/products/${product.id}`),
    );
    expect(done.some((n) => n.kind === "done")).toBe(true);
    const actions = (
      await getStore().list("audit_log", { filter: { entityId: product.id } })
    ).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "product.create",
        "product.reject",
        "product.approval.resubmit",
        "product.approve",
      ]),
    );
  });

  it("sem superior no 'Responde a': o aviso vai para os administradores", async () => {
    const created = await approval.createProductForApproval(sales, {
      name: "Copo de vidro 300 ml",
      lineId,
    });
    expect(
      (await notesFor(admin.id)).some((n) =>
        n.link?.startsWith(`/app/products/${created.id}`),
      ),
    ).toBe(true);
    expect(await approval.productApproverFor(sales.id)).toBeNull();
    expect(await approval.productApproverFor(buyer.id)).toEqual({
      id: director.id,
      name: director.name,
    });
  });

  it("linha ou fornecedor inexistente: recusa sem criar", async () => {
    await expect(
      approval.createProductForApproval(buyer, {
        name: "Prato raso",
        lineId: "nao-existe",
      }),
    ).rejects.toThrow("line_not_found");
    await expect(
      approval.createProductForApproval(buyer, {
        name: "Prato raso",
        lineId,
        supplierId: "nao-existe",
      }),
    ).rejects.toThrow("supplier_not_found");
  });
});
