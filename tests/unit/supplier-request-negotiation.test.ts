import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Negociação da solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md,
 * "Negociação" e "SLA da negociação"): contraproposta da Wellmix, resposta
 * do fornecedor (aceitar, outra proposta, recusar), conversa com arquivos só
 * para os dois lados e SLA em minutos desde a abertura.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lots = await import("@/lib/services/booking-lots");
const svc = await import("@/lib/services/supplier-requests");
const neg = await import("@/lib/services/supplier-request-negotiation");
const lib = await import("@/lib/supplier-requests");
const { canAccessDocument } = await import("@/lib/services/documents");
const { setSetting } = await import("@/lib/settings");
type User = import("@/lib/db").User;

let admin: User;
let supplierA: User;
let supplierB: User;

const HEADER = [
  "SUPPLIER NAME",
  "DATE",
  "SKU",
  "DESCRIPTION",
  "FOB/EXW",
  "CONI US $/RMB",
  "PRICE",
  "QTY/BOX",
  "QTY/INNER",
  "N.W./PC",
  "G.W./PC",
  "CBM",
  "SIZE(CM) LENGTH",
  "SIZE(CM) WIDTH",
  "SIZE(CM) HEIGHT",
  "CAPACITY(ML)",
  "PACKAGE",
  "MATERIAL",
  "MOQ",
  "PURCHASE QTY IN PCS",
];
const sheet = (sku: string) =>
  new File(
    [
      xlsxBytes([
        {
          name: "BOOKING",
          cells: [
            HEADER,
            [
              "Shenzhen Supplier A",
              "2026.10.13",
              sku,
              `Negotiation cup ${sku}`,
              "FOB",
              "USD",
              "1.25",
              "48",
              "12",
              "0.3",
              "0.35",
              "0.12",
              "10",
              "8",
              "20",
              "350",
              "color box",
              "glass",
              "1000",
              "3000",
            ],
          ],
        },
      ]),
    ],
    "n.xlsx",
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );

/** Solicitação aberta e respondida "faz" a 1,40 US$ pelo fornecedor A. */
async function answeredRequest(sku: string) {
  const lot = await lots.createBookingLotFromSheet(admin, sheet(sku));
  const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
  const [item] = await getStore().list("booking_items", {
    filter: { lotId: lot.id },
  });
  await setBookingItemsNcm(admin, [item.id], "7013.37.00");
  await lots.closeBookingLot(admin, lot.id, null);
  const request = await svc.openSupplierRequest(admin, {
    itemId: item.id,
    alternativeIds: [],
    quantity: null,
    needs: null,
    searchQuery: null,
  });
  await svc.answerSupplierRequest(supplierA, request.id, {
    canDo: "yes",
    price: 1.4,
    currency: "USD",
    moq: 1000,
    leadTimeDays: 30,
    note: null,
  });
  return request;
}

const offer = (
  o: Partial<import("@/lib/services/supplier-request-negotiation").OfferInput>,
) => ({
  price: null,
  currency: null,
  moq: null,
  leadTimeDays: null,
  text: null,
  ...o,
});

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
});

describe("contraproposta", () => {
  it("bloqueia a aprovação até o fornecedor responder; aceitar vira a resposta", async () => {
    const store = getStore();
    const request = await answeredRequest("NEG-1");
    // Comentário obrigatório e ao menos um valor; o fornecedor não propõe.
    await expect(
      neg.proposeCounter(admin, request.id, offer({ price: 1.2 })),
    ).rejects.toThrow("supplier_request_comment_required");
    await expect(
      neg.proposeCounter(admin, request.id, offer({ text: "Melhore" })),
    ).rejects.toThrow("supplier_request_offer_empty");
    await expect(
      neg.proposeCounter(
        supplierA,
        request.id,
        offer({ price: 1.2, text: "x" }),
      ),
    ).rejects.toThrow("not_found");

    await neg.proposeCounter(
      admin,
      request.id,
      offer({
        price: 1.2,
        moq: 2000,
        leadTimeDays: 25,
        text: "Fechamos assim?",
      }),
    );
    // O fornecedor recebe o aviso; a Wellmix não aprova e não propõe outra.
    const notes = await store.list("notifications", {
      filter: { userId: supplierA.id, channel: "inapp" },
    });
    expect(
      notes.some((n) => n.link === `/app/supplier-requests/${request.id}`),
    ).toBe(true);
    await expect(
      svc.decideSupplierRequest(admin, request.id, "approved", null),
    ).rejects.toThrow("supplier_request_decision_invalid");
    await expect(
      neg.proposeCounter(admin, request.id, offer({ price: 1.1, text: "y" })),
    ).rejects.toThrow("supplier_request_proposal_pending");
    // Com contraproposta esperando, o fornecedor não muda a resposta por fora.
    await expect(
      svc.answerSupplierRequest(supplierA, request.id, {
        canDo: "yes",
        price: 1.3,
        currency: "USD",
        moq: null,
        leadTimeDays: null,
        note: null,
      }),
    ).rejects.toThrow("supplier_request_proposal_pending");
    expect(
      lib.negotiationTurn((await store.get("supplier_requests", request.id))!),
    ).toBe("supplier");
    // A Wellmix não responde à própria contraproposta pelo fornecedor.
    await expect(
      neg.respondToProposal(admin, request.id, "accept", offer({})),
    ).rejects.toThrow("supplier_request_supplier_only");

    await neg.respondToProposal(supplierA, request.id, "accept", offer({}));
    const accepted = (await store.get("supplier_requests", request.id))!;
    expect(accepted).toMatchObject({
      supplierPrice: 1.2,
      supplierMoq: 2000,
      supplierLeadTimeDays: 25,
    });
    expect(lib.negotiationTurn(accepted)).toBe("wellmix");
    // A primeira resposta também fica no histórico (linha do tempo).
    expect(accepted.negotiation!.map((e) => e.kind)).toEqual([
      "answer",
      "proposal",
      "accept",
    ]);
    await svc.decideSupplierRequest(admin, request.id, "approved", null);
  });

  it("outra proposta troca os valores; recusar mantém a resposta anterior; rodadas sem limite", async () => {
    const store = getStore();
    const request = await answeredRequest("NEG-2");
    await neg.proposeCounter(
      admin,
      request.id,
      offer({ price: 1.0, text: "Precisamos de 1,00" }),
    );
    await expect(
      neg.respondToProposal(supplierA, request.id, "counter", offer({})),
    ).rejects.toThrow("supplier_request_price_required");
    await neg.respondToProposal(
      supplierA,
      request.id,
      "counter",
      offer({ price: 1.3, leadTimeDays: 20, text: "1,30 é o mínimo" }),
    );
    let r = (await store.get("supplier_requests", request.id))!;
    expect(r).toMatchObject({
      supplierPrice: 1.3,
      supplierMoq: 1000,
      supplierLeadTimeDays: 20,
    });
    // A Wellmix (que abriu) é avisada da nova proposta.
    const notes = await store.list("notifications", {
      filter: { userId: admin.id, channel: "inapp" },
    });
    expect(notes.some((n) => n.subject?.includes(String(request.number)))).toBe(
      true,
    );
    await neg.proposeCounter(
      admin,
      request.id,
      offer({ price: 1.15, text: "Meio a meio" }),
    );
    await neg.respondToProposal(
      supplierA,
      request.id,
      "reject",
      offer({ text: "Não dá" }),
    );
    r = (await store.get("supplier_requests", request.id))!;
    expect(r.supplierPrice).toBe(1.3);
    expect(r.negotiation!.map((e) => e.kind)).toEqual([
      "answer",
      "proposal",
      "counter",
      "proposal",
      "reject",
    ]);
    expect(lib.pendingProposal(r.negotiation)).toBeNull();
    // Sem contraproposta esperando, responder a ela recusa.
    await expect(
      neg.respondToProposal(supplierA, request.id, "accept", offer({})),
    ).rejects.toThrow("supplier_request_no_proposal");
  });
});

describe("conversa e arquivos", () => {
  it("os dois lados mandam mensagem e foto, PDF ou Excel; só a Wellmix e o fornecedor abrem", async () => {
    const store = getStore();
    const request = await answeredRequest("NEG-3");
    await expect(
      neg.postRequestMessage(supplierA, request.id, { text: " ", file: null }),
    ).rejects.toThrow("supplier_request_message_empty");
    await expect(
      neg.postRequestMessage(supplierB, request.id, { text: "oi", file: null }),
    ).rejects.toThrow("not_found");
    await expect(
      neg.postRequestMessage(admin, request.id, {
        text: null,
        file: new File(["x"], "a.txt", { type: "text/plain" }),
      }),
    ).rejects.toThrow("supplier_request_file_type");

    await neg.postRequestMessage(admin, request.id, {
      text: "Pode mandar a foto da caixa?",
      file: null,
    });
    await neg.postRequestMessage(supplierA, request.id, {
      text: "Segue",
      file: new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "caixa.pdf", {
        type: "application/pdf",
      }),
    });
    const r = (await store.get("supplier_requests", request.id))!;
    const withFile = r.negotiation!.find((e) => e.documentId)!;
    expect(withFile).toMatchObject({ side: "supplier", fileName: "caixa.pdf" });
    const doc = (await store.get("documents", withFile.documentId!))!;
    expect(doc.supplierRequestId).toBe(request.id);
    expect(await canAccessDocument(admin, doc)).toBe(true);
    expect(await canAccessDocument(supplierA, doc)).toBe(true);
    expect(await canAccessDocument(supplierB, doc)).toBe(false);
    // Arquivo da Wellmix: o fornecedor dela abre, outro não.
    await neg.postRequestMessage(admin, request.id, {
      text: null,
      file: new File([new Uint8Array([1, 2, 3])], "arte.png", {
        type: "image/png",
      }),
    });
    const mine = (await store.get("supplier_requests", request.id))!
      .negotiation!.filter((e) => e.documentId)
      .at(-1)!;
    const png = (await store.get("documents", mine.documentId!))!;
    expect(await canAccessDocument(supplierA, png)).toBe(true);
    expect(await canAccessDocument(supplierB, png)).toBe(false);
  });
});

describe("SLA da negociação", () => {
  it("conta da abertura; estourado marca atrasada e avisa uma vez os dois lados", async () => {
    const store = getStore();
    await setSetting("supplierRequestSlaMinutes", 30);
    const request = await answeredRequest("NEG-4");
    const opened = new Date(request.createdAt);
    expect(
      lib.supplierRequestLate(
        request,
        30,
        new Date(opened.getTime() + 29 * 60_000),
      ),
    ).toBe(false);
    const later = new Date(opened.getTime() + 31 * 60_000);
    expect(lib.supplierRequestLate(request, 30, later)).toBe(true);
    expect(lib.supplierRequestSlaDue(request, 30)).toBe(
      new Date(opened.getTime() + 30 * 60_000).toISOString(),
    );

    const count = async (userId: string) =>
      (
        await store.list("notifications", {
          filter: { userId, channel: "inapp" },
        })
      ).filter((n) => n.subject?.includes("SLA")).length;
    const beforeA = await count(supplierA.id);
    const beforeAdmin = await count(admin.id);
    expect(await neg.notifyLateSupplierRequests(later)).toBeGreaterThanOrEqual(
      1,
    );
    expect(await count(supplierA.id)).toBeGreaterThan(beforeA);
    expect(await count(admin.id)).toBeGreaterThan(beforeAdmin);
    expect(
      (await store.get("supplier_requests", request.id))!.slaNotifiedAt,
    ).toBeTruthy();
    // Uma vez só.
    const again = await count(admin.id);
    await neg.notifyLateSupplierRequests(later);
    expect(await count(admin.id)).toBe(again);
    // Decidida, deixa de contar.
    await svc.decideSupplierRequest(admin, request.id, "approved", null);
    const decided = (await store.get("supplier_requests", request.id))!;
    expect(neg.slaOf(decided, 30, later)).toBeNull();
  });

  it("regras puras: de quem é a vez e o que se decide", () => {
    const at = "2026-11-11T00:00:00.000Z";
    const proposal = {
      id: "1",
      at,
      kind: "proposal" as const,
      side: "wellmix" as const,
      byUserId: "u",
    };
    expect(lib.negotiationTurn({ status: "open", negotiation: null })).toBe(
      "supplier",
    );
    expect(
      lib.negotiationTurn({ status: "answered", negotiation: [proposal] }),
    ).toBe("supplier");
    expect(
      lib.negotiationTurn({
        status: "answered",
        negotiation: [
          proposal,
          { ...proposal, id: "2", kind: "message", side: "supplier" },
        ],
      }),
    ).toBe("supplier");
    expect(lib.negotiationTurn({ status: "approved", negotiation: null })).toBe(
      null,
    );
    expect(lib.supplierRequestDecisions("answered", "yes", true)).toEqual([
      "declined",
    ]);
    expect(lib.supplierRequestDecisions("answered", "yes")).toEqual([
      "approved",
      "declined",
    ]);
  });
});

describe("pendências do fornecedor", () => {
  it("a solicitação fica na etapa Responder a solicitação enquanto a vez é dele", async () => {
    const { pendingTasksFor, supplierGroup } =
      await import("@/lib/services/tasks");
    const mine = async (user: User, id: string) =>
      (await pendingTasksFor(user)).filter(
        (t) => t.link === `/app/supplier-requests/${id}`,
      );
    const request = await answeredRequest("TASK-1");
    // Respondida: a vez é da Wellmix, nada com o fornecedor.
    expect(await mine(supplierA, request.id)).toEqual([]);

    // Contraproposta da Wellmix: volta para ele, desde a contraproposta.
    await neg.proposeCounter(
      admin,
      request.id,
      offer({ price: 1.2, text: "Fechamos assim?" }),
    );
    const [counter] = await mine(supplierA, request.id);
    expect(counter).toMatchObject({
      kind: "supplier_request",
      group: supplierGroup("request"),
      supplierStep: "request",
    });
    expect(counter.text?.detail).toBe("supplierTasks.request.counter");
    expect(counter.dueAt).toBeTruthy();
    expect(counter.sinceAt).not.toBe(counter.loadedAt);
    // Outro fornecedor não recebe a pendência.
    expect(await mine(supplierB, request.id)).toEqual([]);

    await neg.respondToProposal(supplierA, request.id, "accept", offer({}));
    expect(await mine(supplierA, request.id)).toEqual([]);

    // Aberta (ainda sem resposta): com ele desde a abertura.
    const store = getStore();
    await store.update("supplier_requests", request.id, {
      status: "open",
      supplierCanDo: null,
      negotiation: [],
    });
    const [open] = await mine(supplierA, request.id);
    expect(open.text?.detail).toBe("supplierTasks.request.detail");
    expect(open.sinceAt).toBe(open.loadedAt);

    // Cancelada (a aberta só cancela): sai das pendências.
    await svc.decideSupplierRequest(admin, request.id, "cancelled", null);
    expect(await mine(supplierA, request.id)).toEqual([]);
  });
});
