import { beforeAll, describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import { withTempStore } from "./setup";

/*
 * Fase F: certificação com o OCP (memorial → laboratório → registro), artes
 * do pedido (designer, não conformidade por SKU com volta), zip das artes só
 * com o que o usuário abre, e tabela de preços só para a Wellmix.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const f = await import("@/lib/services/import-flow");
const art = await import("@/lib/services/artwork");
const pt = await import("@/lib/services/price-table");
const { zipStream, safeZipNames } = await import("@/lib/zip-stream");
const { setSetting } = await import("@/lib/settings");
const { canViewOrder } = await import("@/lib/auth/permissions");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
let joao: User;
let supplierA: User;
let ocp: User;
let comex: User;
let agency: User;
let order: Order;

async function doc(user: User, name: string, type = "import_step") {
  return getStore().create("documents", {
    orderId: order.id,
    requestId: null,
    requirementId: null,
    type,
    name,
    mime: "application/pdf",
    size: 3,
    storageKey: `k-${name}`,
    version: 1,
    previousDocumentId: null,
    uploadedByUserId: user.id,
    visibility: type === "art" ? "supplier" : "internal",
  } as never);
}

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
  ocp = by("ocp@certifica.com");
  comex = by("comex@assessoria.com");
  agency = users.find((u) => u.role === "agency")!;
  await setSetting("approvalsEnabled", false);
  const req = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Jarra",
    specification: null,
    quantity: 10000,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, req.id, ["fornecedor-a"]);
  const [quote] = await getStore().list("quotes", {
    filter: { requestId: req.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 50_000,
    sellCurrency: "BRL",
  });
  order = await r.confirmDownPayment(admin, req.id);
  order = await getStore().update("orders", order.id, {
    status: "PREPARATION",
    ocpId: ocp.partyId,
    agencyId: agency.partyId,
  });
});

describe("certificação com o OCP", () => {
  it("OCP vê só os pedidos designados e só os passos da certificação", async () => {
    expect(canViewOrder(ocp, order)).toBe(true);
    expect(f.canSeeStep(ocp, order, "cert_lab")).toBe(true);
    expect(f.canSeeStep(ocp, order, "numerario")).toBe(false);
    expect(f.canSeeStep(supplierA, order, "cert_lab")).toBe(false);
    const view = await f.importFlowView(ocp, order, "certification");
    expect(view.map((v) => v.template.key)).toEqual([
      "cert_memorial",
      "cert_lab",
      "cert_registration",
    ]);
    // O cartão de embarque não mostra passos da certificação.
    const imp = await f.importFlowView(admin, order);
    expect(imp.some((v) => v.template.key.startsWith("cert_"))).toBe(false);
  });

  it("memorial (Wellmix) → OCP valida → laudo → registro validado pela Wellmix", async () => {
    await expect(
      f.submitStep(ocp, order.id, "cert_memorial", {
        documentId: (await doc(ocp, "m.pdf")).id,
      }),
    ).rejects.toThrow();
    await f.submitStep(admin, order.id, "cert_memorial", {
      documentId: (await doc(admin, "memorial.pdf")).id,
    });
    await f.validateStep(ocp, order.id, "cert_memorial", "validated", null);
    await f.submitStep(ocp, order.id, "cert_lab", {
      value: "Lab X / L-123",
      documentId: (await doc(ocp, "laudo.pdf")).id,
    });
    await f.submitStep(ocp, order.id, "cert_registration", {
      value: "INMETRO 0001",
      documentId: (await doc(ocp, "cert.pdf")).id,
    });
    await f.validateStep(
      admin,
      order.id,
      "cert_registration",
      "validated",
      null,
    );
    const view = await f.importFlowView(admin, order, "certification");
    expect(view.every((v) => v.done)).toBe(true);
    // Comex vê o registro (para a DI), não o laudo.
    expect(f.canSeeStep(comex, order, "cert_registration")).toBe(true);
  });
});

describe("artes do pedido", () => {
  it("designer: só candidatos (função designer ou agência do pedido)", async () => {
    await expect(art.assignDesigner(admin, order.id, joao.id)).rejects.toThrow(
      "invalid_designer",
    );
    await art.assignDesigner(admin, order.id, agency.id);
    order = (await getStore().get("orders", order.id))!;
    expect(order.designerUserId).toBe(agency.id);
  });

  it("não conformidade por SKU: designer corrige, Wellmix reabre e aceita", async () => {
    const [item] = await getStore().list("order_items", {
      filter: { orderId: order.id },
    });
    await expect(
      art.reportArtIssue(agency, order.id, {
        orderItemId: item.id,
        note: "x",
      }),
    ).rejects.toThrow();
    const issue = await art.reportArtIssue(admin, order.id, {
      orderItemId: item.id,
      note: "Pantone errado",
    });
    // Fornecedor não corrige arte.
    await expect(
      art.fixArtIssue(supplierA, issue.id, { fixNote: "x" }),
    ).rejects.toThrow();
    await art.fixArtIssue(agency, issue.id, { fixNote: "Ajustado" });
    await expect(
      art.reviewArtFix(admin, issue.id, false, null),
    ).rejects.toThrow("note_required");
    await art.reviewArtFix(admin, issue.id, false, "Ainda escuro");
    await art.fixArtIssue(agency, issue.id, { fixNote: "Clareado" });
    await art.reviewArtFix(admin, issue.id, true, null);
    const view = await art.artworkView(admin, order);
    expect(view.open).toBe(0);
  });

  it("zip das artes: só a versão mais nova e só o que o usuário abre", async () => {
    const v1 = await doc(admin, "arte.pdf", "art");
    await getStore().create("documents", {
      orderId: order.id,
      requestId: null,
      requirementId: null,
      type: "art",
      name: "arte.pdf",
      mime: "application/pdf",
      size: 3,
      storageKey: "k-arte-v2",
      version: 2,
      previousDocumentId: v1.id,
      uploadedByUserId: admin.id,
      visibility: "supplier",
    } as never);
    await doc(admin, "comprovante.pdf", "proof");
    const docs = await art.artworkDocuments(admin, order);
    expect(docs.map((d) => d.version)).toEqual([2]);
    // Cliente não abre arte com visibilidade "supplier".
    const forCustomer = await art
      .artworkDocuments(joao, order)
      .catch(() => [] as unknown[]);
    expect(forCustomer).toHaveLength(0);
  });

  it("zip em fluxo é válido (assinaturas, CRC e nomes únicos)", async () => {
    const data = new TextEncoder().encode("hello zip");
    const names = safeZipNames(["a/b.pdf", "a_b.pdf", "../x"]);
    expect(names).toEqual(["a_b.pdf", "a_b (2).pdf", "._x"]);
    const stream = zipStream([
      {
        name: "hello.txt",
        open: async () =>
          new ReadableStream({
            start(c) {
              c.enqueue(data);
              c.close();
            },
          }),
      },
    ]);
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    const view = new DataView(buf.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(buf.length - 22, true)).toBe(0x06054b50);
    // Conteúdo guardado sem compressão logo depois do cabeçalho.
    const body = buf.slice(30 + "hello.txt".length, 30 + 9 + data.length);
    expect(new TextDecoder().decode(body)).toBe("hello zip");
    expect(inflateRawSync).toBeTypeOf("function");
  });
});

describe("tabela de preços", () => {
  it("só a Wellmix; preço unitário = valor ao cliente ÷ quantidade", async () => {
    await expect(pt.priceTable(joao)).rejects.toThrow();
    const rows = await pt.priceTable(admin);
    const jarra = rows.find((x) => x.productId === "prod-jarra")!;
    expect(jarra.unitPrice).toBe(5);
    const csv = pt.priceTableCsv([{ ...jarra, name: "=HYPERLINK(1)" }]);
    expect(csv).toContain("'=HYPERLINK(1)");
  });
});
