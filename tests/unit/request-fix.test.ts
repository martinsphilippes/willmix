import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Resolver pelo balão "Quem pode agir" (dono, 20/11/2026;
 * docs/ORDER_LEVEL_LISTS.md, seção 10): o administrador cria, pela
 * encomenda, o login do cliente sem nenhum acesso (login, nome e senha
 * provisória sugeridos), e a encomenda passa a ter quem confirma. Só o
 * administrador; os outros avisos levam ao lugar que resolve.
 */
withTempStore();

const { getStore, PARTY_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createRequestBatch } = await import("@/lib/services/requests");
const { requestStepsFor, requestTurnContext, canConfirmAs } =
  await import("@/lib/services/request-turns");
const { peopleDirectory } = await import("@/lib/services/request-responsible");
const { createCustomerLoginForRequest, fixDirectory, taskFixes } =
  await import("@/lib/services/request-fix");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { responsibleOf, withFix } = await import("@/lib/request-responsible");
const { loginLabel } = await import("@/lib/auth/login-id");
const { verifyPassword } = await import("@/lib/auth/password");
type User = import("@/lib/db").User;
type Party = import("@/lib/db").Party;
type Request = import("@/lib/db").Request;

let admin: User;
let operator: User;
let shop: Party;

const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "ok";
};

const contact = (email = "") => ({ phone: "", email });

async function customer(name: string, buyerEmail: string | null) {
  return getStore().create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    type: "customer",
    name,
    country: "Brasil",
    email: null,
    phone: null,
    taxId: null,
    notes: null,
    city: "Joinville",
    address: null,
    contactName: null,
    wechat: null,
    storeNumber: null,
    active: true,
    customerContacts: buyerEmail
      ? {
          partner: contact(),
          buyer: contact(buyerEmail),
          finance: contact("financeiro@lojanova.com.br"),
          logistics: contact(),
        }
      : null,
  } as never) as Promise<Party>;
}

/** Venda pela Wellmix aguardando o cliente (confirmar o pedido). */
async function sale(
  customerId: string,
  requestedForUserId: string | null = null,
) {
  return createRequestBatch(
    admin,
    {
      customerId,
      deadline: null,
      notes: null,
      requestedForUserId,
      orderTerms: {
        operationType: "ts",
        carrierCaller: "wellmix",
        redispatchRequired: false,
      } as never,
    },
    [
      {
        productId: null,
        productName: "Copo do balão",
        description: "Copo do balão",
        specification: null,
        quantity: 100,
        unit: "un",
        sourcingDemand: false,
      },
    ],
  );
}

/** Quem pode agir na encomenda, como a lista de Encomendas monta. */
async function responsibleFor(viewer: User, request: Request) {
  const store = getStore();
  const fresh = (await store.get("requests", request.id))!;
  const users = await store.list("users");
  const ctx = await requestTurnContext([fresh]);
  const step = (await requestStepsFor(viewer, [fresh], [])).get(fresh.id)!;
  const people = await peopleDirectory(viewer, {
    users,
    requests: [fresh],
    ctx,
    partnerIds: [],
    customerName: () => shop.name,
    translate: (key) => key,
  });
  const dir = await fixDirectory(viewer, {
    users,
    customerIds: [fresh.customerId],
    people,
  });
  return {
    step,
    resp: withFix(
      responsibleOf(step, fresh, null, people),
      step,
      fresh,
      null,
      dir,
    ),
  };
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  shop = await customer("Loja Nova do Balão", "compras@lojanova.com.br");
});

describe("criar o login do cliente pelo balão", () => {
  it("o administrador recebe o formulário com o e-mail do comprador; a equipe, não", async () => {
    const [request] = await sale(shop.id);
    const { step, resp } = await responsibleFor(admin, request);
    expect(step).toEqual({ key: "login", who: "unassigned" });
    expect(resp?.missing).toBe("login");
    expect(resp?.fix).toMatchObject({
      kind: "customer_login",
      requestId: request.id,
      customer: "Loja Nova do Balão",
      login: "compras@lojanova.com.br",
      name: "Loja Nova do Balão",
    });
    const fix = resp?.fix;
    expect(
      fix?.kind === "customer_login" ? fix.password.length : 0,
    ).toBeGreaterThanOrEqual(8);
    // Gerar login é só do administrador: a equipe vê o aviso, sem botão.
    const team = await responsibleFor(operator, request);
    expect(team.resp?.missing).toBe("login");
    expect(team.resp?.fix ?? null).toBeNull();
  });

  it("cria o login com senha provisória e a encomenda passa a ter quem confirma", async () => {
    const [request] = await sale(shop.id);
    const { user, reassigned } = await createCustomerLoginForRequest(
      admin,
      request.id,
      {
        login: " Compras@LojaNova.com.br ",
        name: "Comprador da Loja Nova",
        password: "provisoria-1",
      },
    );
    expect(user).toMatchObject({
      email: "compras@lojanova.com.br",
      name: "Comprador da Loja Nova",
      role: "customer",
      partyId: shop.id,
      active: true,
      mustChangePassword: true,
    });
    expect(verifyPassword("provisoria-1", user.passwordHash)).toBe(true);
    // A encomenda não tinha login com acesso: vale para todo login do
    // cliente, nada a trocar.
    expect(reassigned).toBe(0);
    const fresh = (await getStore().get("requests", request.id))!;
    expect(canConfirmAs(user, fresh)).toBe(true);
    const { step, resp } = await responsibleFor(admin, request);
    expect(step).toEqual({ key: "confirm", who: "customer" });
    expect(resp?.missing).toBeNull();
    expect(resp?.people.map((p) => p.id)).toEqual([user.id]);
    // A pendência "criar o acesso do cliente" do administrador some, e o
    // cliente recebe "Confirmar pedido".
    expect(
      (await pendingTasksFor(admin)).some(
        (t) => t.kind === "customer_login" && t.requestId === request.id,
      ),
    ).toBe(false);
    expect(
      (await pendingTasksFor(user)).some(
        (t) => t.kind === "customer_confirm" && t.requestId === request.id,
      ),
    ).toBe(true);
    // O registro diz de qual encomenda saiu o login (sem a senha).
    const logs = await getStore().list("audit_log", {
      filter: { entityId: request.id },
    });
    const log = logs.find((l) => l.action === "request.customer_login");
    expect(log?.summary).toContain(loginLabel(user.email));
    expect(log?.summary).not.toContain("provisoria-1");
  });

  it("com o login com acesso desativado: o lote passa para o login novo", async () => {
    const other = await customer("Loja Antiga do Balão", null);
    const old = (await getStore().create("users", {
      email: "antigo@lojaantiga.com.br",
      name: "Login Antigo",
      role: "customer",
      partyId: other.id,
      locale: "pt",
      passwordHash: "x",
      active: true,
      importerId: null,
      functions: [],
      screens: null,
      mustChangePassword: false,
    } as never)) as User;
    const batch = await sale(other.id, old.id);
    await getStore().update("users", old.id, { active: false });
    const before = await responsibleFor(admin, batch[0]);
    // Sem login ativo: o formulário, com um nome de usuário pela empresa.
    expect(before.resp?.fix).toMatchObject({
      kind: "customer_login",
      login: "loja.antiga.do.balao",
    });
    const { user, reassigned } = await createCustomerLoginForRequest(
      admin,
      batch[0].id,
      {
        login: "loja.antiga.do.balao",
        name: "Loja Antiga do Balão",
        password: "provisoria-2",
      },
    );
    expect(loginLabel(user.email)).toBe("loja.antiga.do.balao");
    expect(reassigned).toBe(batch.length);
    const fresh = (await getStore().get("requests", batch[0].id))!;
    expect(fresh.requestedForUserId).toBe(user.id);
    expect((await responsibleFor(admin, batch[0])).step).toEqual({
      key: "confirm",
      who: "customer",
    });
  });

  it("o cliente com login que não confirma: escolher o login na encomenda", async () => {
    const third = await customer("Loja Terceira do Balão", null);
    const make = (email: string) =>
      getStore().create("users", {
        email,
        name: email,
        role: "customer",
        partyId: third.id,
        locale: "pt",
        passwordHash: "x",
        active: true,
        importerId: null,
        functions: [],
        screens: null,
        mustChangePassword: false,
      } as never) as Promise<User>;
    const away = await make("saiu@lojaterceira.com.br");
    await make("ficou@lojaterceira.com.br");
    const [request] = await sale(third.id, away.id);
    await getStore().update("users", away.id, { active: false });
    const { resp } = await responsibleFor(admin, request);
    expect(resp?.fix).toEqual({
      kind: "choose_login",
      href: `/app/requests/${request.id}#requester`,
    });
    // A equipe também escolhe o login na encomenda.
    expect((await responsibleFor(operator, request)).resp?.fix).toEqual({
      kind: "choose_login",
      href: `/app/requests/${request.id}#requester`,
    });
  });

  it("só o administrador; login já usado ou inválido e senha curta são recusados", async () => {
    const [request] = await sale(shop.id);
    const input = {
      login: "outro@lojanova.com.br",
      name: "Outro",
      password: "provisoria-3",
    };
    expect(
      await code(() =>
        createCustomerLoginForRequest(operator, request.id, input),
      ),
    ).toBe("forbidden");
    expect(
      await code(() =>
        createCustomerLoginForRequest(admin, "nao-existe", input),
      ),
    ).toBe("not_found");
    expect(
      await code(() =>
        createCustomerLoginForRequest(admin, request.id, {
          ...input,
          login: "compras@lojanova.com.br",
        }),
      ),
    ).toBe("user_email_taken");
    expect(
      await code(() =>
        createCustomerLoginForRequest(admin, request.id, {
          ...input,
          login: "com espaço",
        }),
      ),
    ).toBe("user_login_invalid");
    expect(
      await code(() =>
        createCustomerLoginForRequest(admin, request.id, {
          ...input,
          password: "curta",
        }),
      ),
    ).toBe("user_password_short");
  });
});

describe("o mesmo formulário nas Pendências", () => {
  it("a pendência Login do cliente a definir traz o formulário (sem login) ou o caminho para escolher (com login), só para o administrador", async () => {
    const fresh = await customer(
      "Loja das Pendências",
      "compras@pendencias.com.br",
    );
    const [request] = await sale(fresh.id);
    const tasks = await pendingTasksFor(admin);
    const task = tasks.find(
      (t) => t.kind === "customer_login" && t.requestId === request.id,
    );
    expect(task).toBeDefined();
    const fixes = await taskFixes(admin, tasks);
    expect(fixes.get(request.id)).toMatchObject({
      kind: "customer_login",
      requestId: request.id,
      customer: "Loja das Pendências",
      login: "compras@pendencias.com.br",
    });
    // Outros tipos de pendência não ganham botão.
    expect(
      [...fixes.keys()].every((id) =>
        tasks.some((t) => t.kind === "customer_login" && t.requestId === id),
      ),
    ).toBe(true);
    // Só o administrador.
    expect((await taskFixes(operator, tasks)).size).toBe(0);
    // Criado o login, a pendência some (e o botão com ela).
    await createCustomerLoginForRequest(admin, request.id, {
      login: "compras@pendencias.com.br",
      name: "Loja das Pendências",
      password: "provisoria-4",
    });
    const after = await pendingTasksFor(admin);
    expect(
      after.some(
        (t) => t.kind === "customer_login" && t.requestId === request.id,
      ),
    ).toBe(false);
    expect((await taskFixes(admin, after)).has(request.id)).toBe(false);
  });

  it("cliente com login ativo que não confirma: escolher o login na encomenda", async () => {
    const shop2 = await customer("Loja Escolha Pendências", null);
    const make = (email: string) =>
      getStore().create("users", {
        email,
        name: email,
        role: "customer",
        partyId: shop2.id,
        locale: "pt",
        passwordHash: "x",
        active: true,
        importerId: null,
        functions: [],
        screens: null,
        mustChangePassword: false,
      } as never) as Promise<User>;
    const away = await make("saiu@escolha.com.br");
    await make("ficou@escolha.com.br");
    const [request] = await sale(shop2.id, away.id);
    await getStore().update("users", away.id, { active: false });
    const fixes = await taskFixes(admin, await pendingTasksFor(admin));
    expect(fixes.get(request.id)).toEqual({
      kind: "choose_login",
      href: `/app/requests/${request.id}#requester`,
    });
  });
});
