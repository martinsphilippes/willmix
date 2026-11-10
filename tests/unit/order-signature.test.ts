import { beforeAll, describe, expect, it } from "vitest";
import { signOrderAs, withTempStore } from "./setup";

/*
 * Documento do pedido com duas assinaturas (docs/ORDER_SIGNATURE.md): a
 * Wellmix assina primeiro, o fornecedor em seguida; o pedido só passa da
 * Preparação com as duas. A assinatura grava nome, quem, quando e a versão
 * do documento. O documento (preço de compra) só abre para a Wellmix e o
 * fornecedor do pedido.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const sig = await import("@/lib/services/order-signature");
const { submitRequirement } = await import("@/lib/workflow/engine");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;
let joao: User;
let supplierA: User;
let supplierB: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = {
    ...supplierA,
    id: "outro-fornecedor",
    email: "supplier.b@china.test",
    partyId: "fornecedor-b",
  };
  const { setSetting } = await import("@/lib/settings");
  await setSetting("approvalsEnabled", false);
});

async function newOrder(name: string) {
  const store = getStore();
  const req = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: name,
    description: name,
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, req.id, ["fornecedor-a"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: req.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 3.6,
    currency: "USD",
    leadTimeDays: 45,
    conditions: null,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 10_000,
    sellCurrency: "BRL",
    downPaymentAmount: 3000,
  });
  const order = await r.confirmDownPayment(admin, req.id);
  return order;
}

const reqOf = async (orderId: string, key: string) =>
  (await getStore().list("requirements", { filter: { orderId, key } }))[0];
const stageOf = async (orderId: string, key: string) =>
  (await getStore().list("stages", { filter: { orderId, key } }))[0];

describe("documento do pedido com duas assinaturas", () => {
  it("o pedido nasce com os dois itens de assinatura; o 'Confirmar' comum não os conclui", async () => {
    const order = await newOrder("Quadro assinado");
    const wellmix = await reqOf(order.id, "order_signed_wellmix");
    const supplier = await reqOf(order.id, "order_signed_supplier");
    expect([wellmix.status, wellmix.required, wellmix.role]).toEqual([
      "pending",
      true,
      "operator",
    ]);
    expect([supplier.status, supplier.required, supplier.role]).toEqual([
      "pending",
      true,
      "supplier",
    ]);
    await expect(
      submitRequirement(admin, wellmix.id, { value: "confirmed" }),
    ).rejects.toThrow("signature_required");
  });

  it("quem vê o documento: a Wellmix e o fornecedor do pedido; cliente e outro fornecedor não", async () => {
    const order = await newOrder("Quadro visível");
    const view = (await sig.getOrderSignatureView(admin, order.id))!;
    expect(view.document).toMatchObject({
      orderNumber: order.number,
      currency: "USD",
      leadTimeDays: 45,
      total: 3600,
      items: [
        { name: "Quadro visível", quantity: 1000, unitPrice: 3.6, total: 3600 },
      ],
    });
    expect(view.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(view.canSign).toBe("wellmix");
    const forSupplier = (await sig.getOrderSignatureView(supplierA, order.id))!;
    expect([forSupplier.canSign, forSupplier.waitingWellmix]).toEqual([
      null,
      true,
    ]);
    expect(await sig.getOrderSignatureView(joao, order.id)).toBeNull();
    expect(await sig.getOrderSignatureView(supplierB, order.id)).toBeNull();
    await expect(
      sig.signOrderDocument(joao, order.id, {
        name: "João",
        agree: true,
        hash: view.hash,
      }),
    ).rejects.toThrow();
    await expect(
      sig.signOrderDocument(supplierB, order.id, {
        name: "Outro",
        agree: true,
        hash: view.hash,
      }),
    ).rejects.toThrow();
  });

  it("a Wellmix assina primeiro (nome, aceite e a versão vista); depois o fornecedor; só então a Preparação anda", async () => {
    const order = await newOrder("Quadro em duas assinaturas");
    const { hash } = (await sig.getOrderSignatureView(admin, order.id))!;
    // O fornecedor não assina antes da Wellmix.
    await expect(
      sig.signOrderDocument(supplierA, order.id, {
        name: "Li Wei",
        agree: true,
        hash,
      }),
    ).rejects.toThrow("signature_wellmix_first");
    // Nome, aceite e versão são obrigatórios.
    await expect(
      sig.signOrderDocument(admin, order.id, { name: "A", agree: true, hash }),
    ).rejects.toThrow("signature_name_required");
    await expect(
      sig.signOrderDocument(admin, order.id, {
        name: "Ana Admin",
        agree: false,
        hash,
      }),
    ).rejects.toThrow("signature_agree_required");
    await expect(
      sig.signOrderDocument(admin, order.id, {
        name: "Ana Admin",
        agree: true,
        hash: "0".repeat(64),
      }),
    ).rejects.toThrow("signature_document_changed");

    const signed = await sig.signOrderDocument(admin, order.id, {
      name: "  Ana   Admin ",
      agree: true,
      hash,
    });
    expect(signed).toMatchObject({ side: "wellmix", name: "Ana Admin", hash });
    await expect(signOrderAs(admin, order.id)).rejects.toThrow(
      "signature_already_done",
    );
    // O fornecedor é avisado com o link do documento.
    const notes = await getStore().list("notifications", {
      filter: { userId: supplierA.id },
    });
    expect(
      notes.some((n) => n.link === `/app/orders/${order.id}/purchase-order`),
    ).toBe(true);
    // A etapa "Pedido criado" ainda pede a conferência da Wellmix.
    const confirm = await reqOf(order.id, "order_confirmed");
    await submitRequirement(admin, confirm.id, { value: "confirmed" });
    expect((await stageOf(order.id, "ORDER_CREATED")).status).toBe("done");
    expect((await stageOf(order.id, "PREPARATION")).status).toBe("active");

    const view = (await sig.getOrderSignatureView(supplierA, order.id))!;
    expect([view.canSign, view.wellmix?.name, view.supplier]).toEqual([
      "supplier",
      "Ana Admin",
      null,
    ]);
    await sig.signOrderDocument(supplierA, order.id, {
      name: "Li Wei",
      agree: true,
      hash: view.hash,
    });
    const after = (await sig.getOrderSignatureView(admin, order.id))!;
    expect([after.wellmix?.name, after.supplier?.name, after.canSign]).toEqual([
      "Ana Admin",
      "Li Wei",
      null,
    ]);
    expect((await reqOf(order.id, "order_signed_supplier")).status).toBe(
      "done",
    );
    const audits = await getStore().list("audit_log", {
      filter: { entityId: order.id, action: "order.signed" },
    });
    expect(audits).toHaveLength(2);
  });

  it("sem a assinatura do fornecedor a Preparação não conclui; o administrador registra a que veio por fora", async () => {
    const order = await newOrder("Quadro por fora");
    await signOrderAs(admin, order.id);
    await submitRequirement(
      admin,
      (await reqOf(order.id, "order_confirmed")).id,
      { value: "confirmed" },
    );
    const prep = await stageOf(order.id, "PREPARATION");
    // A Wellmix conclui tudo o que é dela e do fornecedor, menos a assinatura.
    for (const req of await getStore().list("requirements", {
      filter: { stageId: prep.id, status: "pending" },
    }))
      if (req.key !== "order_signed_supplier")
        await submitRequirement(admin, req.id, { value: "ok" });
    expect((await stageOf(order.id, "PREPARATION")).status).toBe("active");
    const { hash, canRegisterSupplier } = (await sig.getOrderSignatureView(
      admin,
      order.id,
    ))!;
    expect(canRegisterSupplier).toBe(true);
    // Só o administrador registra a assinatura recebida por fora.
    await expect(
      sig.signOrderDocument(operator, order.id, {
        name: "Li Wei",
        agree: true,
        hash,
        onBehalfOfSupplier: true,
      }),
    ).rejects.toThrow();
    await sig.signOrderDocument(admin, order.id, {
      name: "Li Wei",
      agree: true,
      hash,
      onBehalfOfSupplier: true,
    });
    const view = (await sig.getOrderSignatureView(admin, order.id))!;
    expect(view.supplier).toMatchObject({
      side: "supplier",
      name: "Li Wei",
      onBehalf: true,
      userName: admin.name,
    });
    expect((await stageOf(order.id, "PREPARATION")).status).toBe("done");
  });

  it("PDF para baixar; o fornecedor anexa o arquivo assinado; só então o pedido vai ao Sankhya; o administrador devolve arquivo errado", async () => {
    const order = await newOrder("Quadro em PDF");
    await signOrderAs(admin, order.id);
    await submitRequirement(
      admin,
      (await reqOf(order.id, "order_confirmed")).id,
      { value: "confirmed" },
    );
    // O pedido nasce sem ir ao Sankhya: espera a assinatura do fornecedor.
    expect((await getStore().get("orders", order.id))!.erpSyncStatus).toBe(
      "pending",
    );
    const view = (await sig.getOrderSignatureView(supplierA, order.id))!;
    expect(view.status).toBe("sent_to_supplier");
    // O PDF (no modelo de pedido da Wellmix) traz o pedido, o fornecedor, o
    // total, a versão do documento e os procedimentos.
    const pdf = Buffer.from(
      await sig.renderOrderDocumentPdf(view, { printedBy: supplierA.name }),
    ).toString("latin1");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("WELLMIX Number:");
    expect(pdf).toContain(`(${order.number})`);
    expect(pdf).toContain("Quadro em PDF");
    // Números como no modelo: vírgula decimal e ponto de milhar.
    expect(pdf).toContain("(3.600,0000)");
    expect(pdf).toContain("Total Value - US$");
    expect(pdf).toContain(view.hash);
    expect(pdf).toContain("Ana Admin");
    expect(pdf).toContain("WELLMIX PROCEDURES");
    // Folha deitada (A4 em paisagem).
    expect(pdf).toContain("/MediaBox [0 0 841.89 595.28]");
    // Arquivo que não é PDF nem foto é recusado.
    await expect(
      sig.signOrderDocument(supplierA, order.id, {
        name: "Li Wei",
        agree: true,
        hash: view.hash,
        signedFile: new File(["x"], "doc.exe", {
          type: "application/x-msdownload",
        }),
      }),
    ).rejects.toThrow("signature_file_invalid");
    const signed = await sig.signOrderDocument(supplierA, order.id, {
      name: "Li Wei",
      agree: true,
      hash: view.hash,
      signedFile: new File(["%PDF-1.4 assinado"], "po-assinado.pdf", {
        type: "application/pdf",
      }),
    });
    expect(signed.method).toBe("file");
    const doc = (await getStore().get("documents", signed.documentId!))!;
    expect([doc.orderId, doc.visibility]).toEqual([order.id, "internal"]);
    // O arquivo assinado tem o preço: a Wellmix e quem enviou; mais ninguém.
    const { canAccessDocument } = await import("@/lib/services/documents");
    expect(await canAccessDocument(admin, doc)).toBe(true);
    expect(await canAccessDocument(supplierA, doc)).toBe(true);
    expect(await canAccessDocument(supplierB, doc)).toBe(false);
    expect(await canAccessDocument(joao, doc)).toBe(false);
    const after = (await sig.getOrderSignatureView(admin, order.id))!;
    // Sem integração ligada: autorizado, esperando o número do Sankhya.
    expect([after.status, after.supplier?.method]).toEqual(["signed", "file"]);
    // Arquivo errado: o administrador devolve e o fornecedor assina de novo.
    await expect(
      sig.reopenSupplierSignature(operator, order.id, "Arquivo ilegível"),
    ).rejects.toThrow();
    expect(after.canReopenSupplier).toBe(true);
    await sig.reopenSupplierSignature(admin, order.id, "Arquivo ilegível");
    const reopened = (await sig.getOrderSignatureView(supplierA, order.id))!;
    expect([reopened.supplier, reopened.canSign, reopened.status]).toEqual([
      null,
      "supplier",
      "sent_to_supplier",
    ]);
    // Arquivo grande (foto de celular): o navegador sobe direto ao
    // armazenamento e a assinatura leva só o id; tipo errado é recusado.
    const bytes = new TextEncoder().encode("foto assinada");
    const wrong = await getStore().putFile(bytes, "x.exe", "application/zip");
    await expect(
      sig.signOrderDocument(supplierA, order.id, {
        name: "Li Wei",
        agree: true,
        hash: view.hash,
        signedUploadId: wrong.key,
      }),
    ).rejects.toThrow("signature_file_invalid");
    expect(await getStore().statFile(wrong.key)).toBeNull();
    const photo = await getStore().putFile(bytes, "po.jpg", "image/jpeg");
    const direct = await sig.signOrderDocument(supplierA, order.id, {
      name: "Li Wei",
      agree: true,
      hash: view.hash,
      signedUploadId: photo.key,
    });
    expect(direct.method).toBe("file");
    const directDoc = (await getStore().get("documents", direct.documentId!))!;
    expect([directDoc.orderId, directDoc.storageKey]).toEqual([
      order.id,
      photo.key,
    ]);
    await sig.reopenSupplierSignature(admin, order.id, "Conferir de novo");
    // Sem arquivo, vale o aceite no portal (a opção continua).
    const accepted = await signOrderAs(supplierA, order.id);
    expect(accepted.method).toBe("accept");
  });

  it("o pedido mudou depois da assinatura: a tela mostra que a versão assinada é outra", async () => {
    const order = await newOrder("Quadro alterado");
    const signed = await signOrderAs(admin, order.id);
    const [item] = await getStore().list("order_items", {
      filter: { orderId: order.id },
    });
    await getStore().update("order_items", item.id, { quantity: 1200 });
    const view = (await sig.getOrderSignatureView(admin, order.id))!;
    expect(view.hash).not.toBe(signed.hash);
    expect(view.wellmix?.hash).toBe(signed.hash);
    expect(view.document.items[0].quantity).toBe(1200);
  });
});
