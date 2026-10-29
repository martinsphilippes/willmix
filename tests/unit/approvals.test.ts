import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Aprovação do pré-custo: a escolha do fornecedor só vale depois do planner e
 * da diretoria de compras (e da executiva a partir do limite). Quem envia não
 * aprova; ninguém decide dois níveis; reprovar exige motivo e não muda a
 * solicitação; aprovado no fim grava a seleção (aguardando sinal).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const ap = await import("@/lib/services/approvals");
const team = await import("@/lib/services/team");
const { pendingTasksFor } = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;
let buyer: User;
let planner: User;
let director: User;
let executive: User;

async function wellmixUser(email: string, name: string) {
  return getStore().create("users", {
    email,
    name,
    role: "operator",
    partyId: null,
    locale: "pt",
    passwordHash: null,
    active: true,
    importerId: null,
  });
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  buyer = await wellmixUser("comprador@wellmix.com", "Carla Compradora");
  planner = await wellmixUser("planner@wellmix.com", "Pedro Planner");
  director = await wellmixUser("dircompras@wellmix.com", "Dora Diretora");
  executive = await wellmixUser("direxec@wellmix.com", "Eduardo Executivo");
  const set = (u: User, functions: string[]) =>
    team.setTeamMember(admin, u.id, {
      jobLevel: null,
      managerUserId: null,
      division: null,
      functions: functions as never,
    });
  await set(buyer, ["buyer"]);
  await set(planner, ["planner"]);
  await set(director, ["purchasing_director"]);
  await set(executive, ["executive_director"]);
  const reload = async (u: User) => (await getStore().get("users", u.id))!;
  [buyer, planner, director, executive] = await Promise.all(
    [buyer, planner, director, executive].map(reload),
  );
});

async function quoted(name: string) {
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

const brl = (sellPrice: number) => ({
  sellPrice,
  sellCurrency: "BRL",
  downPaymentAmount: Math.round(sellPrice * 0.3),
});

describe("aprovação do pré-custo", () => {
  it("níveis: executiva só a partir do limite ou sem câmbio", () => {
    expect(ap.levelsFor(50_000, 100_000)).toEqual([
      "planner",
      "purchasing_director",
    ]);
    expect(ap.levelsFor(100_000, 100_000)).toContain("executive_director");
    expect(ap.levelsFor(null, 100_000)).toContain("executive_director");
  });

  it("enviar não muda a solicitação; planner e diretoria aprovam e a seleção é gravada", async () => {
    const { req, quote } = await quoted("Copo aprovado");
    const approval = await ap.submitForApproval(buyer, quote.id, brl(28_000));
    expect(approval.levels).toEqual(["planner", "purchasing_director"]);
    expect(approval.currentLevel).toBe("planner");
    const still = (await getStore().get("requests", req.id))!;
    expect(still.status).toBe("QUOTATION_RECEIVED");
    expect(still.selectedQuoteId).toBeNull();

    // Pendências: o planner vê "Aprovar"; ninguém vê "Escolher fornecedor".
    const plannerTasks = await pendingTasksFor(planner);
    expect(
      plannerTasks.some(
        (t) => t.kind === "approval" && t.link.includes(req.id),
      ),
    ).toBe(true);
    expect(
      plannerTasks.some(
        (t) => t.kind === "select_supplier" && t.link.includes(req.id),
      ),
    ).toBe(false);
    // A diretoria ainda não pode (nível do planner).
    expect(ap.canDecide(director, approval)).toBe(false);
    // Quem enviou não aprova a própria escolha.
    expect(ap.canDecide(buyer, approval)).toBe(false);

    const afterPlanner = await ap.decideApproval(
      planner,
      approval.id,
      "approved",
      null,
    );
    expect(afterPlanner.currentLevel).toBe("purchasing_director");
    // O planner não decide o nível seguinte.
    expect(ap.canDecide(planner, afterPlanner)).toBe(false);
    const done = await ap.decideApproval(
      director,
      approval.id,
      "approved",
      null,
    );
    expect(done.status).toBe("approved");
    const selected = (await getStore().get("requests", req.id))!;
    expect(selected.status).toBe("WAITING_DOWN_PAYMENT");
    expect(selected.selectedQuoteId).toBe(quote.id);
    expect(selected.sellPrice).toBe(28_000);
  });

  it("acima do limite passa pela diretoria executiva", async () => {
    const { quote } = await quoted("Mesa grande");
    const a = await ap.submitForApproval(buyer, quote.id, brl(250_000));
    expect(a.levels).toEqual([
      "planner",
      "purchasing_director",
      "executive_director",
    ]);
    await ap.decideApproval(planner, a.id, "approved", null);
    const mid = await ap.decideApproval(director, a.id, "approved", null);
    expect(mid.currentLevel).toBe("executive_director");
    expect(ap.canDecide(executive, mid)).toBe(true);
    const done = await ap.decideApproval(executive, a.id, "approved", null);
    expect(done.status).toBe("approved");
  });

  it("reprovar exige motivo, termina a aprovação e não muda a solicitação", async () => {
    const { req, quote } = await quoted("Prato reprovado");
    const a = await ap.submitForApproval(buyer, quote.id, brl(10_000));
    await expect(
      ap.decideApproval(planner, a.id, "rejected", "  "),
    ).rejects.toThrow("reason_required");
    const rejected = await ap.decideApproval(
      planner,
      a.id,
      "rejected",
      "Margem abaixo da meta",
    );
    expect(rejected.status).toBe("rejected");
    expect(rejected.reason).toBe("Margem abaixo da meta");
    expect((await getStore().get("requests", req.id))!.status).toBe(
      "QUOTATION_RECEIVED",
    );
    // O comprador é avisado.
    const notes = await getStore().list("notifications", {
      filter: { userId: buyer.id, channel: "inapp" },
    });
    expect(notes.some((n) => /reprovado/i.test(n.subject))).toBe(true);
  });

  it("nova escolha substitui a em aberto; quem não é da Wellmix não envia nem decide", async () => {
    const { quote } = await quoted("Jarra trocada");
    const first = await ap.submitForApproval(buyer, quote.id, brl(5_000));
    const second = await ap.submitForApproval(buyer, quote.id, brl(6_000));
    expect((await getStore().get("approvals", first.id))!.status).toBe(
      "cancelled",
    );
    expect(second.status).toBe("pending");
    await expect(
      ap.submitForApproval(joao, quote.id, brl(1)),
    ).rejects.toThrow();
    expect(ap.canDecide(joao, second)).toBe(false);
    // Admin decide qualquer nível.
    expect(ap.canDecide(admin, second)).toBe(true);
  });
});
