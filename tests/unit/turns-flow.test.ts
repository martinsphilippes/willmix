import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * De quem é a vez, de ponta a ponta (dono, 18/11/2026; docs/TURNS.md): a
 * venda pela Wellmix aguardando o cliente está "Em aberto", com a vez do
 * cliente, e vira "Confirmar pedido" só para o login dele que pode
 * confirmar; trocar o login com acesso muda quem recebe; sem login que
 * possa confirmar, o administrador recebe o caso; confirmada, a pendência
 * do cliente some e a próxima ação ("Enviar para cotação") vai para quem
 * pode fazê-la, nunca para quem não pode.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createRequestBatch, setRequester } =
  await import("@/lib/services/requests");
const confirmation = await import("@/lib/services/customer-confirmation");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { tasksForFunctions } = await import("@/lib/task-owner");
const { requestStepsFor } = await import("@/lib/services/request-turns");
const { inSituation, todayBrazil } =
  await import("@/lib/services/request-list");
type User = import("@/lib/db").User;
type Request = import("@/lib/db").Request;

let admin: User;
let joao: User;
let maria: User;
let buyer: User;
let comex: User;

const operator = (email: string, name: string, functions: string[]) =>
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
  } as never) as Promise<User>;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  // Outro login do mesmo cliente.
  maria = (await getStore().create("users", {
    email: "maria@lojista.com",
    name: "Maria Cliente",
    role: "customer",
    partyId: joao.partyId,
    locale: "pt",
    passwordHash: "x",
    active: true,
    importerId: null,
    functions: [],
    screens: null,
    mustChangePassword: false,
  } as never)) as User;
  buyer = await operator("comprador.fluxo@wellmix.com", "Bia Compras", [
    "buyer",
  ]);
  comex = await operator("comex.fluxo@wellmix.com", "Caio Comex", [
    "comex_internal",
  ]);
});

/** Venda pela Wellmix para o João, com o login dele com acesso. */
async function sale(products: string[], requestedForUserId = joao.id) {
  return createRequestBatch(
    admin,
    {
      customerId: joao.partyId!,
      deadline: null,
      notes: null,
      requestedForUserId,
      // A Wellmix chama o transportador e sem re-despacho: o cliente só
      // confirma o aviso "sem devoluções".
      orderTerms: {
        operationType: "ts",
        carrierCaller: "wellmix",
        redispatchRequired: false,
      } as never,
    },
    products.map((name) => ({
      productId: null,
      productName: name,
      description: name,
      specification: null,
      quantity: 100,
      unit: "un",
      sourcingDemand: false,
    })),
  );
}

const confirmTasks = async (user: User, requests: Request[]) =>
  (await pendingTasksFor(user)).filter(
    (t) =>
      t.kind === "customer_confirm" &&
      requests.some((r) => t.requestId === r.id),
  );
const loginTasks = async (requests: Request[]) =>
  (await pendingTasksFor(admin)).filter(
    (t) =>
      t.kind === "customer_login" && requests.some((r) => t.requestId === r.id),
  );
const steps = async (requests: Request[]) => {
  const fresh = await getStore().list("requests", {
    filter: { id: requests.map((r) => r.id) },
  });
  const map = await requestStepsFor(admin, fresh, []);
  return fresh.map((r) => map.get(r.id)!);
};

describe("venda aguardando o cliente", () => {
  it("em aberto, a vez do cliente e uma pendência por encomenda só para quem confirma", async () => {
    const batch = await sale(["Copo de teste", "Prato de teste"]);
    expect(batch.map((r) => r.status)).toEqual([
      "AWAITING_CUSTOMER",
      "AWAITING_CUSTOMER",
    ]);
    // Situação e Próximo passo pela mesma regra (lista, CSV e detalhe).
    for (const n of await steps(batch))
      expect(n).toEqual({ key: "confirm", who: "customer" });
    for (const r of batch)
      expect(inSituation(r, r.status, "open", todayBrazil())).toBe(true);
    // Uma pendência para o lote, levando ao cartão de confirmação.
    const [task, ...rest] = await confirmTasks(joao, batch);
    expect(rest).toEqual([]);
    expect(task).toMatchObject({
      group: "customer_confirm",
      link: `/app/requests/${batch[0].id}`,
      text: {
        title: "turn.task.confirm.title",
        values: { n: batch[0].number, count: 2 },
      },
    });
    // O outro login do cliente e a Wellmix não recebem; ninguém sem login.
    expect(await confirmTasks(maria, batch)).toEqual([]);
    expect(await confirmTasks(admin, batch)).toEqual([]);
    expect(await loginTasks(batch)).toEqual([]);
    // Enquanto espera o cliente, a Wellmix não tem o que enviar.
    expect(
      (await pendingTasksFor(admin)).some((t) =>
        batch.some(
          (r) => t.link === `/app/requests/${r.id}` && t.kind === "new_request",
        ),
      ),
    ).toBe(false);
  });

  it("troca do login com acesso: a pendência muda de dono; sem login que confirme, o administrador resolve", async () => {
    const [request] = await sale(["Jarra de teste"]);
    expect(await confirmTasks(joao, [request])).toHaveLength(1);
    // Troca de responsável: a Maria passa a confirmar.
    await setRequester(admin, request.id, maria.id);
    expect(await confirmTasks(joao, [request])).toEqual([]);
    expect(await confirmTasks(maria, [request])).toHaveLength(1);
    // A Maria sai (login inativo): ninguém pode confirmar.
    const away = await getStore().update("users", maria.id, { active: false });
    expect(await confirmTasks(away, [request])).toEqual([]);
    const [flag] = await steps([request]);
    expect(flag).toEqual({ key: "login", who: "unassigned" });
    const [admTask, ...more] = await loginTasks([request]);
    expect(more).toEqual([]);
    // O cliente tem outro login ativo: o caso abre a encomenda (escolher o
    // login com acesso lá).
    expect(admTask).toMatchObject({
      group: "customer_login",
      link: `/app/requests/${request.id}`,
    });
    // Só o administrador recebe (quem cria o acesso do cliente).
    expect(
      tasksForFunctions(buyer, await pendingTasksFor(buyer)).some(
        (t) => t.kind === "customer_login",
      ),
    ).toBe(false);
    // Resolvido (o login volta): o caso some e a vez volta ao cliente.
    await getStore().update("users", maria.id, { active: true });
    expect(await loginTasks([request])).toEqual([]);
    expect((await steps([request]))[0]).toEqual({
      key: "confirm",
      who: "customer",
    });
  });

  it("confirmada: a pendência do cliente some e a próxima vai para quem envia para cotação", async () => {
    const [request] = await sale(["Garrafa de teste"]);
    await confirmation.confirmCustomerOrder(joao, request.id, {
      accept: true,
      cnpj: "",
      carrierName: "",
    });
    expect(await confirmTasks(joao, [request])).toEqual([]);
    expect((await steps([request]))[0]).toEqual({
      key: "send",
      who: "wellmix",
    });
    const sendTask = (tasks: Awaited<ReturnType<typeof pendingTasksFor>>) =>
      tasks.filter(
        (t) =>
          t.kind === "new_request" && t.link === `/app/requests/${request.id}`,
      );
    // Quem abre Encomendas recebe "Enviar para cotação" (uma vez só).
    expect(
      sendTask(tasksForFunctions(buyer, await pendingTasksFor(buyer))),
    ).toHaveLength(1);
    expect(sendTask(await pendingTasksFor(admin))).toHaveLength(1);
    // Quem não pode enviar (Comex interno) não recebe.
    expect(
      sendTask(tasksForFunctions(comex, await pendingTasksFor(comex))),
    ).toEqual([]);
    // O cliente acompanha: a vez é da Wellmix.
    const confirmed = (await getStore().get("requests", request.id))!;
    const mine = await requestStepsFor(joao, [confirmed], []);
    expect(mine.get(request.id)?.who).toBe("wellmix");
  });
});
