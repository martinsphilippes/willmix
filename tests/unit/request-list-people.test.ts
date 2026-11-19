import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Encomendas (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seção 6):
 * - o rascunho reserva o número da solicitação no primeiro salvamento (a
 *   mesma sequência das enviadas) e a solicitação enviada o repete;
 * - quem pode agir sai da mesma porta das Pendências: a equipe pela função,
 *   sem administradores (à parte), sem login suspenso e sem quem saiu da
 *   equipe; os logins do cliente que confirmam; os logins do parceiro. O
 *   login (e-mail) só para o administrador.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createRequestBatch } = await import("@/lib/services/requests");
const { saveRequestDraft } = await import("@/lib/services/request-drafts");
const { peopleDirectory } = await import("@/lib/services/request-responsible");
const { requestTurnContext } = await import("@/lib/services/request-turns");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierLogin: User;
let buyer: User;

const operator = (
  email: string,
  name: string,
  functions: string[],
  extra: Partial<User> = {},
) =>
  getStore().create("users", {
    email,
    name,
    role: "operator",
    partyId: null,
    locale: "pt",
    passwordHash: "x",
    active: true,
    importerId: null,
    functions,
    screens: null,
    mustChangePassword: false,
    ...extra,
  } as never) as Promise<User>;

const item = (name: string) => ({
  productId: null,
  productName: name,
  description: name,
  specification: null,
  quantity: 100,
  unit: "un",
  sourcingDemand: false,
});

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierLogin = users.find((u) => u.role === "supplier" && u.partyId)!;
  buyer = await operator("bia.resp@wellmix.com", "Bia Compras", ["buyer"]);
  await operator("dora.resp@wellmix.com", "Dora Diretoria", [
    "purchasing_director",
  ]);
  await operator("sueli.resp@wellmix.com", "Sueli Suspensa", ["buyer"], {
    loginSuspended: true,
  });
  await operator("otto.resp@wellmix.com", "Otto Saiu", ["buyer"], {
    active: false,
  });
});

const draftForm = (name: string) => {
  const f = new FormData();
  f.append("customerId", joao.partyId!);
  f.append("p0.productName", name);
  f.append("p0.quantity", "100");
  f.append("p0.unit", "un");
  return f;
};

describe("número desde o rascunho", () => {
  it("reserva no 1º salvamento, mantém ao salvar de novo e a solicitação enviada repete", async () => {
    const d1 = await saveRequestDraft(admin, draftForm("Copo"), null, "ts");
    const d2 = await saveRequestDraft(admin, draftForm("Prato"), null, "ts");
    expect(typeof d1.number).toBe("number");
    expect(d2.number).toBe(d1.number! + 1);
    const again = await saveRequestDraft(admin, draftForm("Copo"), d1.id, "ts");
    expect(again.number).toBe(d1.number);
    // Rascunho de antes da numeração: ganha o número no próximo salvamento.
    await getStore().update("request_drafts", d2.id, { number: null });
    const renumbered = await saveRequestDraft(
      admin,
      draftForm("Prato"),
      d2.id,
      "ts",
    );
    expect(renumbered.number).toBeGreaterThan(d2.number!);
    // Enviado: todos os produtos com o número do rascunho.
    const sent = await createRequestBatch(
      admin,
      {
        customerId: joao.partyId!,
        deadline: null,
        notes: null,
        requestedForUserId: null,
      },
      [item("Copo"), item("Pires")],
      { number: d1.number! },
    );
    expect(sent.map((r) => r.number)).toEqual([d1.number, d1.number]);
    // Sem rascunho, a solicitação pega o próximo da sequência.
    const [fresh] = await createRequestBatch(
      admin,
      {
        customerId: joao.partyId!,
        deadline: null,
        notes: null,
        requestedForUserId: null,
      },
      [item("Jarra")],
    );
    expect(fresh.number).toBeGreaterThan(renumbered.number!);
  });
});

describe("quem pode agir", () => {
  const dirFor = async (viewer: User, requests = [] as never[]) =>
    peopleDirectory(viewer, {
      users: await getStore().list("users"),
      requests,
      ctx: requests.length ? await requestTurnContext(requests) : null,
      partnerIds: supplierLogin ? [supplierLogin.partyId!] : [],
      customerName: () => "Cliente",
      translate: (k) => k,
    });

  it("a equipe pela função, sem administradores, suspensos ou quem saiu; o login só para o administrador", async () => {
    const dir = await dirFor(admin);
    const choose = dir.team({ action: "purchaseStrategy.choose" });
    const names = choose.people.map((p) => p.name);
    expect(names).toContain("Bia Compras");
    expect(names).not.toContain("Sueli Suspensa");
    expect(names).not.toContain("Otto Saiu");
    expect(names).not.toContain(admin.name);
    expect(choose.functions).toContain("function.buyer");
    expect(choose.people.find((p) => p.name === "Bia Compras")?.login).toBe(
      "bia.resp@wellmix.com",
    );
    expect(dir.admins().map((a) => a.id)).toContain(admin.id);
    const approve = dir.team({ action: "purchaseStrategy.approve" });
    expect(approve.people.map((p) => p.name)).toContain("Dora Diretoria");
    expect(approve.people.map((p) => p.name)).not.toContain("Bia Compras");
    // "Encomenda nova": quem abre Encomendas, menos quem escolhe a estratégia.
    const fresh = dir.team({ screen: "requests" }, "purchaseStrategy.choose");
    expect(fresh.people.map((p) => p.name)).not.toContain("Bia Compras");
    // O operador vê os nomes, sem o login.
    const seen = (await dirFor(buyer)).team({
      action: "purchaseStrategy.choose",
    });
    expect(seen.people.length).toBe(choose.people.length);
    expect(seen.people.every((p) => p.login === null)).toBe(true);
  });

  it("cliente: o login escolhido que confirma; parceiro: os logins ativos dele", async () => {
    const batch = await createRequestBatch(
      admin,
      {
        customerId: joao.partyId!,
        deadline: null,
        notes: null,
        requestedForUserId: joao.id,
        orderTerms: {
          operationType: "ts",
          carrierCaller: "wellmix",
          redispatchRequired: false,
        } as never,
      },
      [item("Copo de confirmar")],
    );
    const dir = await dirFor(admin, batch as never[]);
    expect(dir.confirmers(batch[0].id).map((p) => p.id)).toEqual([joao.id]);
    expect(dir.confirmers(batch[0].id)[0].login).toBe(joao.email);
    if (supplierLogin) {
      const partner = dir.partner(supplierLogin.partyId!);
      expect(partner.people.map((p) => p.id)).toContain(supplierLogin.id);
    }
  });
});
