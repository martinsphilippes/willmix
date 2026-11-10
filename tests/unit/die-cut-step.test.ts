import { beforeAll, describe, expect, it } from "vitest";
import { reachSignature, withTempStore } from "./setup";

/*
 * Etapa "Die Cut" do fornecedor escolhido (pedido do dono, 10/11/2026): na
 * cotação escolhida e no pedido ele envia o die-cut e a foto em alta e
 * informa ou valida o pedido mínimo e o prazo de entrega. A pendência fica
 * aberta enquanto faltar algum dos quatro; a Wellmix é avisada quando fica
 * completo e quando o MOQ ou o prazo mudam. Outro fornecedor não vê nada.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const pb = await import("@/lib/services/packaging-brief");
const step = await import("@/lib/services/die-cut-step");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { canAccessDocument } = await import("@/lib/services/documents");
const { translator } = await import("@/i18n");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;

const pdf = () =>
  new File([new Uint8Array([37, 80, 68, 70, 45, 49])], "die-cut.pdf", {
    type: "application/pdf",
  });
const hdPhoto = (name = "alta.jpg") =>
  new File([new Uint8Array([255, 216, 255, 224, 0, 16])], name, {
    type: "image/jpeg",
  });

const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    return error instanceof Error
      ? error.message || error.constructor.name
      : String(error);
  }
  return "ok";
};

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.role === "admin")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
  const { setSetting } = await import("@/lib/settings");
  await setSetting("approvalsEnabled", false);
});

/** RFQ para A e B, os dois respondem e a Wellmix escolhe A. */
async function chooseA(name: string) {
  const store = getStore();
  const request = await r.createRequest(joao, {
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
  await r.openRfq(admin, request.id, ["fornecedor-a", "fornecedor-b"]);
  const quotes = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  const qa = quotes.find((q) => q.supplierId === "fornecedor-a")!;
  const qb = quotes.find((q) => q.supplierId === "fornecedor-b")!;
  for (const [user, quote] of [
    [supplierA, qa],
    [supplierB, qb],
  ] as const)
    await r.answerQuote(user, quote.id, {
      price: 2,
      currency: "USD",
      leadTimeDays: 30,
      conditions: null,
    });
  await r.selectQuote(admin, qa.id, {
    sellPrice: 1000,
    sellCurrency: "BRL",
    downPaymentAmount: 300,
  });
  const brief = (await pb.briefForRequest(request.id))!;
  return { request, qa, qb, brief };
}

// Avisos do portal ao administrador (o mesmo aviso sai também por e-mail e
// WhatsApp, em modo de teste: aqui conta só o do portal).
const wellmixNotes = async () =>
  getStore().list("notifications", {
    filter: { userId: admin.id, channel: "inapp" },
  });

describe("etapa Die Cut do fornecedor escolhido", () => {
  it("a etapa se chama Die Cut e explica os quatro itens", () => {
    const t = translator("pt");
    expect(t("tasks.group.supplier.dieline")).toBe("Die Cut");
    expect(t("dieCut.title")).toBe("Die Cut");
    expect(t("supplierTasks.help.dieline")).toBe(
      "Envie o die-cut e a foto em alta e confirme o pedido mínimo e o prazo de entrega.",
    );
    for (const item of ["dieline", "hd", "moq", "leadTime"])
      for (const locale of ["pt", "en", "zh"] as const)
        expect(translator(locale)(`dieCut.item.${item}` as never)).not.toBe(
          `dieCut.item.${item}`,
        );
  });

  it("na cotação escolhida: quatro itens, cada um com a sua situação; outro fornecedor não vê", async () => {
    const { request, qa, qb } = await chooseA("Copo Die Cut");
    const view = (await step.dieCutStepView(supplierA, { quoteId: qa.id }))!;
    expect(view.quoteId).toBe(qa.id);
    // O prazo já veio da cotação; die-cut, foto em alta e MOQ faltam.
    expect(view.leadTimeDays).toBe(30);
    expect(view.moq).toBeNull();
    expect(view.missing).toEqual(["dieline", "moq", "hd"]);
    // Isolamento: o outro fornecedor não vê nem envia (nem pela cotação dele,
    // nem pela do escolhido); o cliente também não.
    expect(await step.dieCutStepView(supplierB, { quoteId: qa.id })).toBeNull();
    expect(await step.dieCutStepView(supplierB, { quoteId: qb.id })).toBeNull();
    expect(await step.dieCutStepView(joao, { quoteId: qa.id })).toBeNull();
    expect(
      await code(() =>
        step.sendDieCutStep(
          supplierB,
          { quoteId: qa.id },
          { moq: 100, leadTimeDays: 10, hdPhotos: [] },
        ),
      ),
    ).not.toBe("ok");
    expect((await getStore().get("quotes", qa.id))!.moq ?? null).toBeNull();

    // Pendência: a etapa Die Cut, dizendo o que falta.
    const task = (await pendingTasksFor(supplierA)).find(
      (t) => t.link === `/app/quotes/${qa.id}#die-cut`,
    )!;
    expect(task.group).toBe("supplier.dieline");
    expect(task.title).toBe(`Die Cut: ${request.productName}`);
    expect(task.detail).toMatch(/falta: die-cut, foto em alta, pedido mínimo$/);
  });

  it("valores inválidos são recusados e nada é gravado", async () => {
    const { qa } = await chooseA("Copo inválido");
    const from = { quoteId: qa.id };
    for (const [input, error] of [
      [{ moq: 0, leadTimeDays: 30, hdPhotos: [] }, "invalid_moq"],
      [{ moq: 1.5, leadTimeDays: 30, hdPhotos: [] }, "invalid_moq"],
      [{ moq: 100, leadTimeDays: 0, hdPhotos: [] }, "invalid_lead_time"],
      [{ moq: 100, leadTimeDays: 721, hdPhotos: [] }, "invalid_lead_time"],
    ] as const)
      expect(
        await code(() => step.sendDieCutStep(supplierA, from, input as never)),
      ).toBe(error);
    const quote = (await getStore().get("quotes", qa.id))!;
    expect(quote.moq ?? null).toBeNull();
    expect(quote.leadTimeDays).toBe(30);
  });

  it("envia aos poucos; com os quatro a pendência some e a Wellmix é avisada", async () => {
    const store = getStore();
    const { qa, brief, request } = await chooseA("Copo completo");
    const from = { quoteId: qa.id };
    const link = `/app/quotes/${qa.id}#die-cut`;
    const pending = async () =>
      (await pendingTasksFor(supplierA)).find((t) => t.link === link);
    const before = (await wellmixNotes()).length;

    // 1) Die-cut (pelo briefing da embalagem, como sempre).
    await pb.uploadPackagingItem(supplierA, brief.id, "dieline", pdf());
    expect((await step.dieCutStepView(supplierA, from))!.missing).toEqual([
      "moq",
      "hd",
    ]);
    expect((await pending())!.detail).toMatch(
      /falta: foto em alta, pedido mínimo$/,
    );

    // 2) Foto em alta: fica na ficha da cotação escolhida.
    const one = await step.sendDieCutStep(supplierA, from, {
      moq: null,
      leadTimeDays: null,
      hdPhotos: [hdPhoto()],
    });
    expect(one.missing).toEqual(["moq"]);
    const [photo] = await store.list("product_photos", {
      filter: { orderId: qa.id, kind: "hd" },
    });
    const doc = (await store.get("documents", photo.documentId))!;
    expect(await canAccessDocument(supplierA, doc)).toBe(true);
    expect(await canAccessDocument(admin, doc)).toBe(true);
    expect(await canAccessDocument(supplierB, doc)).toBe(false);
    expect(await canAccessDocument(joao, doc)).toBe(false);
    // Ainda não está completo: a Wellmix não foi avisada do Die Cut.
    const midNotes = (await wellmixNotes()).slice(before);
    expect(midNotes.some((n) => /Die Cut completo/.test(n.subject))).toBe(
      false,
    );

    // 3) Pedido mínimo informado e prazo validado (o mesmo da cotação).
    const done = await step.sendDieCutStep(supplierA, from, {
      moq: 500,
      leadTimeDays: 30,
      hdPhotos: [],
    });
    expect(done.missing).toEqual([]);
    const quote = (await store.get("quotes", qa.id))!;
    expect(quote.moq).toBe(500);
    expect(quote.leadTimeDays).toBe(30);
    expect(await pending()).toBeUndefined();
    const note = (await wellmixNotes())
      .slice(before)
      .find((n) => /Die Cut completo/.test(n.subject))!;
    expect(note.subject).toContain(request.productName);
    expect(note.body).toContain("500");
    expect(note.body).toContain("30");

    // 4) Depois de completo, mudar o prazo avisa a Wellmix com o antes.
    const beforeChange = (await wellmixNotes()).length;
    await step.sendDieCutStep(supplierA, from, {
      moq: 500,
      leadTimeDays: 45,
      hdPhotos: [],
    });
    expect((await store.get("quotes", qa.id))!.leadTimeDays).toBe(45);
    const changed = (await wellmixNotes()).slice(beforeChange);
    expect(changed).toHaveLength(1);
    expect(changed[0].subject).toMatch(/mudou pedido mínimo ou prazo/);
    expect(changed[0].body).toContain("45");
    expect(changed[0].body).toContain("30");
    // Confirmar de novo sem mudar nada não avisa ninguém.
    await step.sendDieCutStep(supplierA, from, {
      moq: 500,
      leadTimeDays: 45,
      hdPhotos: [],
    });
    expect((await wellmixNotes()).length).toBe(beforeChange + 1);
    const audits = await store.list("audit_log", {
      filter: { entityId: qa.id, action: "diecut.items" },
    });
    expect(audits.length).toBe(4);
  });

  it("pelo pedido: a mesma etapa; pedido que já passou da arte não volta a cobrar foto, MOQ e prazo", async () => {
    const store = getStore();
    const { request, qa, brief } = await chooseA("Copo no pedido");
    const order = await r.confirmDownPayment(admin, request.id);
    const from = { orderId: order.id };
    const view = (await step.dieCutStepView(supplierA, from))!;
    expect(view.quoteId).toBe(qa.id);
    expect(view.orderId).toBe(order.id);
    expect(view.missing).toEqual(["dieline", "moq", "hd"]);
    expect(await step.dieCutStepView(supplierB, from)).toBeNull();
    const link = `/app/orders/${order.id}#die-cut`;
    const pending = async () =>
      (await pendingTasksFor(supplierA)).find((t) => t.link === link);
    expect((await pending())!.title).toBe(`Die Cut: ${request.productName}`);

    // Die-cut enviado; o pedido avança até a arte (etapa aberta): a etapa
    // Die Cut ainda cobra a foto em alta e o pedido mínimo.
    await pb.uploadPackagingItem(supplierA, brief.id, "dieline", pdf());
    await reachSignature(admin, order.id, "packaging");
    expect((await pending())!.detail).toMatch(
      /falta: foto em alta, pedido mínimo$/,
    );
    // Pedido já em produção: não cobra mais os três itens novos.
    await store.update("orders", order.id, { status: "INSPECTION" });
    expect(await pending()).toBeUndefined();
    // Mas a etapa continua aberta na tela para ele enviar ou corrigir.
    await step.sendDieCutStep(supplierA, from, {
      moq: 600,
      leadTimeDays: 30,
      hdPhotos: [hdPhoto()],
    });
    expect((await step.dieCutStepView(supplierA, from))!.missing).toEqual([]);
  });
});
