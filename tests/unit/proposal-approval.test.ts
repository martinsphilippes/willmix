import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Etapa "Proposta ao cliente": depois da escolha, o cliente aprova a proposta
 * e só então paga o sinal. Só o cliente da solicitação (ou a Wellmix,
 * registrando a aprovação dada fora do portal) aprova; o comprovante e o
 * sinal confirmado também contam. As etapas da solicitação e as pendências
 * seguem a mesma regra.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const pa = await import("@/lib/services/proposal-approval");
const { loadRequestStages } = await import("@/lib/services/request-stages");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { submitDownPaymentProof } = await import("@/lib/services/down-payment");
const { ForbiddenError } = await import("@/lib/auth/permissions");
type User = import("@/lib/db").User;
type Request = import("@/lib/db").Request;

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
  supplierB = by("supplier.b@china.com");
});

async function proposalSent(): Promise<Request> {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra da proposta",
    description: "Proposta com aprovação do cliente",
    specification: null,
    quantity: 500,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, request.id, ["fornecedor-a", "fornecedor-b"]);
  const [qa] = await getStore().list("quotes", {
    filter: { requestId: request.id, supplierId: "fornecedor-a" },
  });
  await r.answerQuote(supplierA, qa.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  await r.selectQuote(admin, qa.id, {
    sellPrice: 1000,
    sellCurrency: "BRL",
    downPaymentAmount: 300,
  });
  return (await getStore().get("requests", request.id))!;
}

const stateOf = async (request: Request, key: string) =>
  (await loadRequestStages(request)).rows.find((row) => row.key === key)!;

describe("aprovação da proposta pelo cliente", () => {
  it("o cliente aprova; antes disso a pendência dele é aprovar, depois pagar o sinal", async () => {
    const request = await proposalSent();
    expect(request.status).toBe("WAITING_DOWN_PAYMENT");
    expect(request.proposalApprovedAt ?? null).toBeNull();
    expect(pa.proposalApproved(request)).toBe(false);

    // Pendência do cliente: aprovar a proposta (não pagar ainda).
    let tasks = await pendingTasksFor(joao);
    const mine = tasks.filter((t) =>
      t.link.startsWith(`/app/requests/${request.id}`),
    );
    expect(mine.map((t) => t.kind)).toEqual(["approve_proposal"]);
    expect(mine[0].link).toBe(`/app/requests/${request.id}#proposal`);
    // Etapas: a proposta está com o cliente.
    expect((await stateOf(request, "proposal")).state).toBe("active");
    expect((await stateOf(request, "down")).state).toBe("pending");

    const approved = await pa.approveProposal(joao, request.id);
    expect(approved.proposalApprovedAt).toBeTruthy();
    expect(approved.proposalApprovedByUserId).toBe(joao.id);
    // Avisa a Wellmix.
    const notices = await getStore().list("notifications", {
      filter: { userId: admin.id, channel: "inapp" },
    });
    expect(
      notices.some(
        (n) =>
          n.link === `/app/requests/${request.id}` &&
          /Proposta aprovada/.test(n.subject ?? ""),
      ),
    ).toBe(true);
    // Agora a pendência é o sinal.
    tasks = await pendingTasksFor(joao);
    expect(
      tasks
        .filter((t) => t.link.startsWith(`/app/requests/${request.id}`))
        .map((t) => t.kind),
    ).toEqual(["pay"]);
    expect((await stateOf(approved, "proposal")).state).toBe("done");
    expect((await stateOf(approved, "down")).state).toBe("active");
    // Aprovar de novo não muda nada.
    const again = await pa.approveProposal(joao, request.id);
    expect(again.proposalApprovedAt).toBe(approved.proposalApprovedAt);
  });

  it("só o cliente da solicitação ou a Wellmix: fornecedor e outro login não aprovam", async () => {
    const request = await proposalSent();
    await expect(pa.approveProposal(supplierA, request.id)).rejects.toThrow();
    await expect(pa.approveProposal(supplierB, request.id)).rejects.toThrow();
    const stranger = await getStore().create("users", {
      email: "outra@loja.com",
      name: "Outra Loja",
      role: "customer",
      partyId: "cliente-outro",
      locale: "pt",
      passwordHash: null,
      active: true,
      importerId: null,
    });
    await expect(pa.approveProposal(stranger, request.id)).rejects.toThrow(
      /not_found/,
    );
    expect(
      (await getStore().get("requests", request.id))?.proposalApprovedAt ??
        null,
    ).toBeNull();
    // A Wellmix registra a aprovação recebida fora do portal.
    const recorded = await pa.approveProposal(admin, request.id);
    expect(recorded.proposalApprovedByUserId).toBe(admin.id);
  });

  it("antes da proposta não há o que aprovar", async () => {
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Sem proposta",
      description: "Ainda em cotação",
      specification: null,
      quantity: 10,
      unit: "un",
      deadline: null,
      notes: null,
    });
    await expect(pa.approveProposal(joao, request.id)).rejects.toThrow(
      /invalid_status/,
    );
    expect(ForbiddenError).toBeTruthy();
  });

  it("comprovante do sinal e sinal confirmado contam como aprovação", async () => {
    const withProof = await proposalSent();
    await submitDownPaymentProof(
      joao,
      withProof.id,
      new File([new Uint8Array([37, 80, 68, 70])], "pix.pdf", {
        type: "application/pdf",
      }),
    );
    expect(
      (await getStore().get("requests", withProof.id))?.proposalApprovedAt,
    ).toBeTruthy();

    const confirmed = await proposalSent();
    await r.confirmDownPayment(admin, confirmed.id);
    const after = (await getStore().get("requests", confirmed.id))!;
    expect(after.status).toBe("ORDERED");
    expect(after.proposalApprovedAt).toBeTruthy();
    const rows = (await loadRequestStages(after)).rows;
    // Virou pedido: só a faca (que corre ao lado) pode seguir pendente.
    expect(
      rows.filter((row) => row.state === "active").map((row) => row.key),
    ).toEqual(["dieline"]);
    expect(rows.find((row) => row.key === "down")?.state).toBe("done");
    expect(rows.find((row) => row.key === "proposal")?.state).toBe("done");
  });
});
