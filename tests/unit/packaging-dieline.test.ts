import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Faca (die-cut) com o fornecedor escolhido: depois da comparação das
 * cotações, só o fornecedor escolhido (ou a Wellmix no lugar dele) envia a
 * faca; a agência só recebe (aviso na hora) e é cobrada só da arte. O
 * fornecedor tem a pendência, o cartão na cotação/no pedido e abre o próprio
 * arquivo antes do pedido; outro fornecedor, nunca.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const pb = await import("@/lib/services/packaging-brief");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { canAccessDocument } = await import("@/lib/services/documents");
const { runReminders } = await import("@/lib/services/reminders");
const { saveQuoteSheet } = await import("@/lib/services/quote-sheet");
type User = import("@/lib/db").User;
type Request = import("@/lib/db").Request;

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;
let agency: User;

const hdPhoto = () =>
  new File([new Uint8Array([255, 216, 255, 224, 0, 16])], "alta.jpg", {
    type: "image/jpeg",
  });
const pdf = (name = "faca.pdf") =>
  new File([new Uint8Array([37, 80, 68, 70, 45, 49])], name, {
    type: "application/pdf",
  });

async function notificationsOf(user: User) {
  return getStore().list("notifications", {
    filter: { userId: user.id, channel: "inapp" },
  });
}

async function newRequest() {
  return r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra da faca",
    description: "Faca do fornecedor escolhido",
    specification: null,
    quantity: 500,
    unit: "un",
    deadline: null,
    notes: null,
  });
}

async function quoteOf(request: Request, supplierId: string) {
  const [quote] = await getStore().list("quotes", {
    filter: { requestId: request.id, supplierId },
  });
  return quote;
}

async function answer(request: Request, user: User, supplierId: string) {
  const quote = await quoteOf(request, supplierId);
  await r.answerQuote(user, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  return quote;
}

/** RFQ para A e B, os dois respondem e a Wellmix escolhe A. */
async function chooseA() {
  const request = await newRequest();
  await r.openRfq(admin, request.id, ["fornecedor-a", "fornecedor-b"]);
  const qa = await answer(request, supplierA, "fornecedor-a");
  await answer(request, supplierB, "fornecedor-b");
  await r.selectQuote(admin, qa.id, {
    sellPrice: 1000,
    sellCurrency: "BRL",
    downPaymentAmount: 300,
  });
  const brief = (await pb.briefForRequest(request.id))!;
  return { request, qa, brief };
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.role === "admin")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
  agency = users.find((u) => u.email === "agencia@design.com")!;
});

describe("faca (die-cut) com o fornecedor escolhido", () => {
  it("escolha: o fornecedor escolhido recebe o pedido da faca; o outro não", async () => {
    const beforeA = (await notificationsOf(supplierA)).length;
    const beforeB = (await notificationsOf(supplierB)).length;
    const { qa, brief } = await chooseA();
    expect(brief.requiredKeys).toContain("dieline");
    expect(await pb.briefSupplierId(brief)).toBe("fornecedor-a");
    const toA = (await notificationsOf(supplierA)).slice(beforeA);
    const ask = toA.find((n) => n.link === `/app/quotes/${qa.id}#die-cut`);
    expect(ask).toBeTruthy();
    expect(ask!.kind).toBe("action");
    const toB = (await notificationsOf(supplierB)).slice(beforeB);
    expect(toB.some((n) => n.link?.includes("#die-cut"))).toBe(false);
  });

  it("quem envia: fornecedor escolhido e Wellmix; agência e outro fornecedor não", async () => {
    const { brief } = await chooseA();
    await expect(
      pb.uploadPackagingItem(agency, brief.id, "dieline", pdf()),
    ).rejects.toThrow();
    await expect(
      pb.uploadPackagingItem(supplierB, brief.id, "dieline", pdf()),
    ).rejects.toThrow();
    // O fornecedor não envia a arte (é da agência).
    await expect(
      pb.uploadPackagingItem(supplierA, brief.id, "art", pdf("arte.pdf")),
    ).rejects.toThrow();
    // A agência continua enviando a arte.
    await pb.uploadPackagingItem(agency, brief.id, "art", pdf("arte.pdf"));
    expect(await pb.canSendDieline(admin, brief)).toBe(true);
    expect(await pb.canSendDieline(agency, brief)).toBe(false);
  });

  it("fornecedor envia: a agência é avisada, abre o arquivo; o outro fornecedor não", async () => {
    const { request, qa, brief } = await chooseA();
    // Antes: pendência do fornecedor (na cotação escolhida) e cartão.
    let tasks = await pendingTasksFor(supplierA);
    expect(tasks.some((t) => t.link === `/app/quotes/${qa.id}#die-cut`)).toBe(
      true,
    );
    // Título e detalhe no idioma do fornecedor (a tela traduz pela chave).
    const dielineTask = tasks.find(
      (t) => t.link === `/app/quotes/${qa.id}#die-cut`,
    )!;
    const { translator } = await import("@/i18n");
    // Fornecedor: o filtro é a etapa dele ("Die Cut").
    expect(dielineTask.group).toBe("supplier.dieline");
    expect(translator("pt")("tasks.group.supplier.dieline")).toBe("Die Cut");
    expect(translator("zh")("tasks.group.supplier.dieline")).toBe(
      "刀模 (Die Cut)",
    );
    expect(translator("zh")("tasks.group.packaging_brief")).toBe(
      "包装（刀模与设计稿）",
    );
    expect(
      translator("zh")(dielineTask.text!.title, dielineTask.text!.values),
    ).toBe(`刀模 (Die Cut)：${request.productName}`);
    const view = await pb.supplierDielineView(supplierA, { quoteId: qa.id });
    expect(view?.briefId).toBe(brief.id);
    expect(view?.document).toBeNull();
    expect(
      await pb.supplierDielineView(supplierB, {
        quoteId: (await quoteOf(request, "fornecedor-b")).id,
      }),
    ).toBeNull();
    // A agência não é cobrada da faca (é do fornecedor).
    const agencyTask = (await pendingTasksFor(agency)).find((t) =>
      t.link.includes(brief.id),
    );
    expect(agencyTask?.detail).toMatch(/com o fornecedor escolhido/);
    expect(agencyTask?.detail.split(" · ")[0]).toBe("Faltam: arte");

    const beforeAgency = (await notificationsOf(agency)).length;
    const { document } = await pb.uploadPackagingItem(
      supplierA,
      brief.id,
      "dieline",
      pdf(),
    );
    const toAgency = (await notificationsOf(agency)).slice(beforeAgency);
    expect(
      toAgency.some((n) => /Faca \(die-cut\) recebida/.test(n.subject)),
    ).toBe(true);
    // Arquivo: o próprio fornecedor (outro login da empresa também), a
    // agência dona e a Wellmix abrem; o outro fornecedor e o cliente não.
    const doc = (await getStore().get("documents", document.id))!;
    expect(await canAccessDocument(supplierA, doc)).toBe(true);
    expect(
      await canAccessDocument({ ...supplierA, id: "outro-login-a" }, doc),
    ).toBe(true);
    expect(await canAccessDocument(agency, doc)).toBe(true);
    expect(await canAccessDocument(supplierB, doc)).toBe(false);
    expect(await canAccessDocument(joao, doc)).toBe(false);
    // Depois: o cartão mostra o arquivo. A etapa "Die Cut" segue aberta
    // pelos outros itens (foto em alta e pedido mínimo) e some com os quatro.
    tasks = await pendingTasksFor(supplierA);
    const still = tasks.find((t) => t.link === `/app/quotes/${qa.id}#die-cut`);
    expect(still?.detail).toMatch(/falta: foto em alta, pedido mínimo$/);
    const { sendDieCutStep } = await import("@/lib/services/die-cut-step");
    await sendDieCutStep(
      supplierA,
      { quoteId: qa.id },
      {
        moq: 500,
        leadTimeDays: null,
        hdPhotos: [hdPhoto()],
      },
    );
    tasks = await pendingTasksFor(supplierA);
    expect(tasks.some((t) => t.link === `/app/quotes/${qa.id}#die-cut`)).toBe(
      false,
    );
    expect(
      (await pb.supplierDielineView(supplierA, { quoteId: qa.id }))?.document
        ?.id,
    ).toBe(document.id);
  });

  it("medidas da escolhida diferentes das usadas: pede a faca de novo", async () => {
    const request = await newRequest();
    await r.openRfq(admin, request.id, ["fornecedor-a", "fornecedor-b"]);
    const qa = await quoteOf(request, "fornecedor-a");
    const qb = await quoteOf(request, "fornecedor-b");
    await saveQuoteSheet(supplierA, qa.id, {
      lengthCm: 60,
      widthCm: 40,
      heightCm: 30,
      masterCartonQty: 12,
    } as never);
    await saveQuoteSheet(supplierB, qb.id, {
      lengthCm: 80,
      widthCm: 50,
      heightCm: 40,
      masterCartonQty: 24,
    } as never);
    const brief = (await pb.briefForRequest(request.id))!;
    // Wellmix já tinha uma faca com as medidas provisórias (de A).
    await pb.uploadPackagingItem(admin, brief.id, "dieline", pdf());
    await answer(request, supplierA, "fornecedor-a");
    await answer(request, supplierB, "fornecedor-b");
    const before = (await notificationsOf(supplierB)).length;
    await r.selectQuote(admin, qb.id, {
      sellPrice: 1000,
      sellCurrency: "BRL",
      downPaymentAmount: 300,
    });
    const notes = (await notificationsOf(supplierB)).slice(before);
    // (No idioma do fornecedor.)
    expect(
      notes.some(
        (n) =>
          n.link === `/app/quotes/${qb.id}#die-cut` &&
          /medidas mudaram|measurements changed|尺寸已变更/.test(n.subject),
      ),
    ).toBe(true);
  });

  it("lembrete: faca vencida vai ao fornecedor; a agência é lembrada só da arte", async () => {
    const store = getStore();
    const { brief } = await chooseA();
    await store.update("packaging_briefs", brief.id, {
      dueAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    });
    const beforeA = (await notificationsOf(supplierA)).length;
    const beforeAgency = (await notificationsOf(agency)).length;
    await runReminders();
    const toA = (await notificationsOf(supplierA)).slice(beforeA);
    expect(
      toA.some(
        (n) => n.kind === "alert" && /刀模|faca|dieline/i.test(n.subject),
      ),
    ).toBe(true);
    const toAgency = (await notificationsOf(agency))
      .slice(beforeAgency)
      .filter((n) => n.link === `/app/packaging/${brief.id}`);
    expect(toAgency).toHaveLength(1);
    expect(toAgency[0].body).not.toMatch(/faca/);
  });
});
