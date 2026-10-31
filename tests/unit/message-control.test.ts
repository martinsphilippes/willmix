import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Controladoria de mensagens: quem escreveu por último passa a bola ao outro
 * lado; prazo de 1 dia útil; operador vê os seus e os sem analista; admin vê
 * tudo; indicadores e visão por produto; o que a Wellmix deve vira pendência.
 */
withTempStore();

const { seedDemo } = await import("@/lib/seed");
const { createRequest, openRfq } = await import("@/lib/services/requests");
const msg = await import("@/lib/services/messages");
const ctl = await import("@/lib/services/message-control");
const { businessDeadline } = await import("@/lib/sla");
const { pendingTasksFor } = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;
let joao: User;
let supplierA: User;
let requestId: string;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  operator = by("operador@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
  const request = await createRequest(joao, {
    customerId: joao.partyId!,
    productId: "prod-jarra",
    productName: "Jarra de vidro 1,5 L",
    description: "Jarra da controladoria",
    quantity: 1000,
    unit: "un",
  });
  requestId = request.id;
  await openRfq(admin, request.id, ["fornecedor-a"]);
});

describe("prazo em dias úteis", () => {
  it("sexta 15h + 1 dia útil = segunda 15h (Brasília)", () => {
    // 2026-10-30 é sexta.
    expect(businessDeadline("2026-10-30T18:00:00.000Z", 1)).toBe(
      "2026-11-02T18:00:00.000Z",
    );
    expect(businessDeadline("2026-10-28T12:00:00.000Z", 1)).toBe(
      "2026-10-29T12:00:00.000Z",
    );
    expect(businessDeadline("data ruim", 1)).toBeNull();
  });
});

describe("controladoria", () => {
  it("bola, prazo, analista, produto e pendência", async () => {
    // Fornecedor escreve sobre a solicitação: bola na Wellmix, sem analista.
    const topic = await msg.openTopic(supplierA, { requestId });
    await msg.postMessage(supplierA, topic.topicId, "Qual a quantidade?");
    let view = await ctl.messageControlFor(admin);
    let row = view.rows.find((r) => r.topicId === topic.topicId)!;
    expect(row.ball).toBe("wellmix");
    expect(row.analystId).toBeNull();
    expect(row.overdue).toBe(false);
    expect(row.productIds).toEqual(["prod-jarra"]);
    expect(row.customerId).toBe(joao.partyId);
    expect(view.stats.withWellmix).toBeGreaterThanOrEqual(1);
    // Operador vê (ninguém assumiu); vira pendência "Responder".
    const forOperator = await ctl.messageControlFor(operator);
    expect(forOperator.scope).toBe("mine");
    expect(forOperator.rows.some((r) => r.topicId === topic.topicId)).toBe(
      true,
    );
    const tasks = await pendingTasksFor(operator);
    const task = tasks.find(
      (t) => t.kind === "message_reply" && t.link === row.href,
    )!;
    expect(task).toBeTruthy();
    expect(task.chat).toEqual({ orderId: null, requestId });
    expect(task.group).toBe("message_reply");

    // Passado o prazo: atrasada (e conta no indicador).
    const later = new Date(Date.parse(row.dueAt) + 3_600_000);
    view = await ctl.messageControlFor(admin, {}, later);
    row = view.rows.find((r) => r.topicId === topic.topicId)!;
    expect(row.overdue).toBe(true);
    expect(view.stats.overdue).toBeGreaterThanOrEqual(1);
    expect(
      (
        await ctl.messageControlFor(admin, { overdueOnly: true }, later)
      ).rows.some((r) => r.topicId === topic.topicId),
    ).toBe(true);

    // Operador responde: bola na empresa, analista = operador; resposta conta.
    await msg.postMessage(operator, topic.topicId, "1.000 peças.");
    view = await ctl.messageControlFor(admin);
    row = view.rows.find((r) => r.topicId === topic.topicId)!;
    expect(row.ball).toBe("party");
    expect(row.analystId).toBe(operator.id);
    expect(view.stats.answered30d).toBeGreaterThanOrEqual(1);
    expect(view.stats.avgResponseHours).not.toBeNull();
    expect(
      (await pendingTasksFor(operator)).some((t) => t.link === row.href),
    ).toBe(false);
    // Visão por produto e filtro por produto.
    const product = view.products.find((p) => p.productId === "prod-jarra")!;
    expect(product.topics).toBeGreaterThanOrEqual(1);
    expect(
      (
        await ctl.messageControlFor(admin, { productId: "prod-jarra" })
      ).rows.every((r) => r.productIds.includes("prod-jarra")),
    ).toBe(true);
    expect(
      (await ctl.messageControlFor(admin, { productId: "nao-existe" })).rows,
    ).toEqual([]);
  });

  it("operador só vê os seus e os sem analista; admin pode pedir só os seus", async () => {
    const topic = await msg.openTopic(admin, {
      partyId: supplierA.partyId!,
    });
    await msg.postMessage(admin, topic.topicId, "Mensagem do admin.");
    const forOperator = await ctl.messageControlFor(operator, { scope: "all" });
    expect(forOperator.scope).toBe("mine");
    expect(forOperator.rows.some((r) => r.topicId === topic.topicId)).toBe(
      false,
    );
    const mine = await ctl.messageControlFor(admin, { scope: "mine" });
    expect(mine.rows.some((r) => r.topicId === topic.topicId)).toBe(true);
  });

  it("quem é de fora não abre a controladoria", async () => {
    await expect(ctl.messageControlFor(joao)).rejects.toThrow();
  });

  it("CSV com cabeçalho e uma linha por assunto", async () => {
    const { rows } = await ctl.messageControlFor(admin);
    const csv = ctl.messageControlCsv(rows, {
      header: ["Empresa", "Tipo"],
      ball: { wellmix: "Wellmix", party: "Empresa" },
      kind: {
        general: "Geral",
        request: "Solicitação",
        order: "Pedido",
        item: "Item",
      },
      yes: "Sim",
      no: "Não",
    });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.slice(1).trim().split("\r\n");
    expect(lines[0]).toBe("Empresa;Tipo");
    expect(lines.length).toBe(rows.length + 1);
  });
});
