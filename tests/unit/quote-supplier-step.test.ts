import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Cotação nas Pendências do fornecedor (dono, 21/11/2026;
 * docs/PURCHASE_DEMAND.md, "Cotação nas Pendências do fornecedor"): a
 * cotação a responder fica na etapa "Responder a solicitação" (a barra de
 * etapas acende e, ao tocar, a lista mostra a cotação), com "Com você desde"
 * no convite e o título e o detalhe no idioma de quem lê, com a quantidade.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const requests = await import("@/lib/services/requests");
const strategy = await import("@/lib/services/purchase-strategy");
const { pendingTasksFor, supplierGroup } = await import("@/lib/services/tasks");
const { translator } = await import("@/i18n");
const { taskTextValues } = await import("@/lib/task-text");
type User = import("@/lib/db").User;

let buyer: User;
let director: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  // A encomenda não vira cotação sozinha aqui (dono, 22/11/2026): estes
  // testes exercitam a Estratégia manual ou outro assunto.
  await (await import("@/lib/settings")).setSetting(
    "autoQuoteOrders",
    false,
  );
  const by = (email: string) => users.find((u) => u.email === email)!;
  buyer = by("operador@wellmix.com");
  director = by("diretoria@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
});

/** Encomenda da jarra com a estratégia "cotar" aprovada; prazo de agora. */
async function openQuote() {
  const d = await requests.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Encomenda",
    quantity: 4800,
    unit: "un",
  });
  await strategy.sendToStrategy(buyer, [d.id]);
  const decision = await strategy.chooseStrategy(buyer, {
    demandIds: [d.id],
    choice: "quote",
    note: null,
  });
  await strategy.decideStrategy(director, decision.id, {
    approve: true,
    note: null,
  });
  const fresh = (await getStore().get("purchase_decisions", decision.id))!;
  const quote = (await getStore().get("purchase_quotes", fresh.quoteId!))!;
  // O prazo a partir de agora (as Pendências leem o relógio de verdade).
  const now = new Date();
  const invitedAt = new Date(now.getTime() - 60_000).toISOString();
  const responses = await getStore().list("purchase_quote_responses", {
    filter: { quoteId: quote.id },
  });
  for (const r of responses)
    await getStore().update("purchase_quote_responses", r.id, {
      invitedAt,
      dueAt: new Date(now.getTime() + quote.hours * 3_600_000).toISOString(),
    });
  return { quote, invitedAt };
}

describe("cotação nas Pendências do fornecedor", () => {
  it("fica na etapa Responder a solicitação, desde o convite, no idioma de quem lê", async () => {
    const { quote, invitedAt } = await openQuote();
    const tasks = await pendingTasksFor(supplierA);
    const task = tasks.find(
      (x) =>
        x.kind === "purchase_quote_answer" &&
        x.link === `/app/purchase-quotes/${quote.id}`,
    );
    expect(task).toBeTruthy();
    // A barra de etapas conta a cotação em "Responder a solicitação".
    expect(task!.supplierStep).toBe("request");
    expect(task!.group).toBe(supplierGroup("request"));
    expect(task!.overdue).toBe(false);
    // "Com você desde": o convite.
    expect(task!.sinceAt).toBe(invitedAt);
    // Título e detalhe traduzidos, com a quantidade no formato do idioma.
    const pt = translator("pt");
    const zh = translator("zh");
    expect(pt(task!.text!.title, taskTextValues(pt, task!.text!))).toBe(
      `Consulta de compra nº ${quote.number}`,
    );
    expect(zh(task!.text!.title, taskTextValues(zh, task!.text!))).toBe(
      `第 ${quote.number} 号采购询盘`,
    );
    expect(pt(task!.text!.detail, taskTextValues(pt, task!.text!))).toMatch(
      /^.+ · 4\.800 un$/,
    );
    expect(zh(task!.text!.detail, taskTextValues(zh, task!.text!))).toMatch(
      /^.+ · 4,800 un$/,
    );
  });
});
