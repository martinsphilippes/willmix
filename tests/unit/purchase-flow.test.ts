import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Fluxo de compras, Fase B: dumping marcado na ficha da cotação segura a
 * escolha do fornecedor até o gerente de produto ou o comprador liberar;
 * marcar avisa os dois. Compra para estoque: sem sinal, o pedido nasce na
 * escolha do fornecedor.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const pf = await import("@/lib/services/purchase-flow");
const ap = await import("@/lib/services/approvals");
const team = await import("@/lib/services/team");
const { ADDABLE_SHEET_PHOTO_KINDS } =
  await import("@/lib/services/purchase-sheet");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;
let joao: User;
let supplierA: User;
let manager: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  manager = await getStore().create("users", {
    email: "gp@wellmix.com",
    name: "Gabi Gerente",
    role: "operator",
    partyId: null,
    locale: "pt",
    passwordHash: null,
    active: true,
    importerId: null,
  });
  await team.setTeamMember(admin, manager.id, {
    jobLevel: null,
    managerUserId: null,
    division: null,
    functions: ["product_manager"],
  });
  manager = (await getStore().get("users", manager.id))!;
  // Seleção direta (sem aprovação) para os testes de dumping e estoque.
  const { setSetting } = await import("@/lib/settings");
  await setSetting("approvalsEnabled", false);
});

async function quoted(customerId: string, name: string, by: User = joao) {
  const req = await r.createRequest(by, {
    customerId,
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
  const [quote] = await getStore().list("quotes", {
    filter: { requestId: req.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  return { req, quote };
}

const sell = { sellPrice: 10_000, sellCurrency: "BRL" };

describe("dumping na ficha da cotação", () => {
  it("segura a escolha até o gerente de produto liberar e avisa", async () => {
    const { req, quote } = await quoted("cliente-joao", "Copo com dumping");
    await qs.saveQuoteSheet(admin, quote.id, {
      dumping: "yes",
      dumpingNote: "Antidumping China",
    });
    expect(await pf.dumpingHold(quote.id)).toBe(true);
    // Aviso ao gerente de produto.
    const notes = await getStore().list("notifications", {
      filter: { userId: manager.id },
    });
    expect(notes.some((n) => n.link?.includes(quote.id))).toBe(true);

    await expect(r.selectQuote(admin, quote.id, sell)).rejects.toThrow(
      "dumping_release_required",
    );
    await expect(ap.submitForApproval(admin, quote.id, sell)).rejects.toThrow(
      "dumping_release_required",
    );
    // Operador sem a função não libera (o de demonstração é comprador, e o
    // comprador libera); o gerente de produto libera.
    await expect(
      pf.releaseDumping({ ...operator, functions: [] }, quote.id),
    ).rejects.toThrow();
    await pf.releaseDumping(manager, quote.id);
    expect(await pf.dumpingHold(quote.id)).toBe(false);

    await r.selectQuote(admin, quote.id, sell);
    expect((await getStore().get("requests", req.id))!.status).toBe(
      "WAITING_DOWN_PAYMENT",
    );
  });

  it("sem dumping marcado não há o que liberar", async () => {
    const { quote } = await quoted("cliente-joao", "Copo sem dumping");
    await qs.saveQuoteSheet(admin, quote.id, { dumping: "no" });
    expect(await pf.dumpingHold(quote.id)).toBe(false);
    await expect(pf.releaseDumping(manager, quote.id)).rejects.toThrow(
      "no_dumping",
    );
  });

  it("fotos HD e faca (die cut) podem ser enviadas na ficha", () => {
    expect(ADDABLE_SHEET_PHOTO_KINDS).toContain("hd");
    expect(ADDABLE_SHEET_PHOTO_KINDS).toContain("die_cut");
  });
});

describe("compra para estoque", () => {
  it("só a Wellmix cria a empresa interna", async () => {
    await expect(pf.ensureStockParty(joao)).rejects.toThrow();
    const party = await pf.ensureStockParty(admin);
    expect(party.id).toBe(pf.STOCK_PARTY_ID);
    // Idempotente.
    expect((await pf.ensureStockParty(operator)).id).toBe(party.id);
  });

  it("sem sinal: escolhido o fornecedor, o pedido nasce", async () => {
    await pf.ensureStockParty(admin);
    const { req, quote } = await quoted(
      pf.STOCK_PARTY_ID,
      "Panela para estoque",
      operator,
    );
    await r.selectQuote(admin, quote.id, sell);
    const after = (await getStore().get("requests", req.id))!;
    expect(after.status).toBe("ORDERED");
    expect(after.downPaymentAmount).toBe(0);
    const payments = await getStore().list("payments", {
      filter: { requestId: req.id },
    });
    expect(payments).toHaveLength(0);
    const [order] = await getStore().list("orders", {
      filter: { requestId: req.id },
    });
    expect(order.customerId).toBe(pf.STOCK_PARTY_ID);
  });
});
