import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Aprovação do pré-custo, último nível (pedido do dono: "tem que aprovar na
 * hora que clico"): a aprovação fica registrada antes de a escolha do
 * fornecedor ser gravada; a gravação roda depois da resposta à tela. Enquanto
 * roda, a aprovação está "gravando a escolha": ninguém decide, cancela nem
 * substitui. Se parar no meio, dá para concluir de novo.
 */
withTempStore();

// O "depois da resposta" do Next: aqui a fila é esvaziada à mão.
const queue: Array<() => Promise<void>> = [];
vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => {
    queue.push(fn);
  },
}));
const drain = async () => {
  while (queue.length) await queue.shift()!();
};

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const ap = await import("@/lib/services/approvals");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
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

const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "ok";
};

describe("aprovação do último nível responde na hora", () => {
  it("registra a aprovação antes de gravar a escolha; a gravação conclui depois", async () => {
    const store = getStore();
    const { req, quote } = await quoted("Copo na hora");
    const approval = await ap.submitForApproval(admin, quote.id, brl(28_000));
    // Primeiro nível: segue para o próximo, nada fica para depois.
    const mid = await ap.decideApproval(admin, approval.id, "approved", null);
    expect(mid.currentLevel).toBe("purchasing_director");
    expect(queue).toHaveLength(0);

    // Último nível: volta na hora, com os dois níveis registrados.
    const applying = await ap.decideApproval(
      admin,
      approval.id,
      "approved",
      null,
    );
    expect(applying.status).toBe("pending");
    expect(applying.currentLevel).toBeNull();
    expect(applying.steps.map((s) => s.level)).toEqual([
      "planner",
      "purchasing_director",
    ]);
    expect(ap.isApplying(applying)).toBe(true);
    expect(ap.isApplyStale(applying)).toBe(false);
    // A escolha ainda não foi gravada (fica para depois da resposta).
    expect(queue).toHaveLength(1);
    expect((await store.get("requests", req.id))!.status).toBe(
      "QUOTATION_RECEIVED",
    );
    // Enquanto grava: ninguém decide de novo, cancela, substitui nem refaz.
    expect(ap.canDecide(admin, applying)).toBe(false);
    expect(ap.canRetryApproval(admin, applying, true)).toBe(false);
    expect(await code(() => ap.cancelApproval(admin, approval.id))).toBe(
      "approval_applying",
    );
    expect(
      await code(() => ap.submitForApproval(admin, quote.id, brl(29_000))),
    ).toBe("approval_applying");
    expect((await ap.approvalsToDecide(admin)).map((a) => a.id)).not.toContain(
      approval.id,
    );

    // Depois da resposta: a escolha é gravada e a aprovação conclui.
    await drain();
    const done = (await store.get("approvals", approval.id))!;
    expect(done.status).toBe("approved");
    expect(ap.isApplying(done)).toBe(false);
    const selected = (await store.get("requests", req.id))!;
    expect(selected.status).toBe("WAITING_DOWN_PAYMENT");
    expect(selected.selectedQuoteId).toBe(quote.id);
    // Chamar de novo depois de concluída não muda nada.
    expect((await ap.finishApproval(admin, approval.id)).status).toBe(
      "approved",
    );
    const audits = await store.list("audit_log", {
      filter: { entityId: req.id, action: "approval.approve" },
    });
    expect(audits.map((a) => a.summary).join(" | ")).toContain(
      "gravando a escolha do fornecedor",
    );
    expect(audits.map((a) => a.summary).join(" | ")).toContain(
      "escolha do fornecedor gravada",
    );
  });

  it("administrador aprova todos os níveis de uma vez; só ele pode", async () => {
    const store = getStore();
    const { req, quote } = await quoted("Copo de uma vez");
    const approval = await ap.submitForApproval(admin, quote.id, brl(28_000));
    expect(approval.levels.length).toBeGreaterThan(1);
    const operator = (await store.list("users")).find(
      (u) => u.role === "operator",
    )!;
    await expect(
      ap.decideApproval(operator, approval.id, "approved", null, {
        allLevels: true,
      }),
    ).rejects.toThrow();
    await ap.decideApproval(admin, approval.id, "approved", null, {
      allLevels: true,
    });
    await drain();
    const done = (await store.get("approvals", approval.id))!;
    expect(done.status).toBe("approved");
    // Cada nível fica registrado, todos no nome do administrador.
    expect(done.steps.map((step) => step.level)).toEqual(approval.levels);
    expect(done.steps.every((step) => step.userId === admin.id)).toBe(true);
    expect((await store.get("requests", req.id))!.selectedQuoteId).toBe(
      quote.id,
    );
  });

  it("a gravação falha: fica 'aprovada, mas não gravada' com o motivo", async () => {
    const store = getStore();
    const { quote } = await quoted("Copo que falha");
    const approval = await ap.submitForApproval(admin, quote.id, brl(28_000));
    await ap.decideApproval(admin, approval.id, "approved", null);
    await ap.decideApproval(admin, approval.id, "approved", null);
    // A cotação deixa de valer antes de a gravação rodar.
    await store.update("quotes", quote.id, { status: "rejected" });
    await drain();
    const failed = (await store.get("approvals", approval.id))!;
    expect(failed.status).toBe("failed");
    expect(failed.reason).toBeTruthy();
    expect(ap.canRetryApproval(admin, failed, true)).toBe(true);
  });

  it("a gravação parou no meio (passou do tempo): dá para concluir de novo e cancelar", async () => {
    const store = getStore();
    const { req, quote } = await quoted("Copo interrompido");
    const approval = await ap.submitForApproval(admin, quote.id, brl(28_000));
    await ap.decideApproval(admin, approval.id, "approved", null);
    await ap.decideApproval(admin, approval.id, "approved", null);
    // A função caiu antes de gravar: a fila se perde e o tempo passa.
    queue.length = 0;
    const stuck = await store.update("approvals", approval.id, {
      decidedAt: new Date(Date.now() - ap.APPLY_STALE_MS - 1000).toISOString(),
    });
    expect(ap.isApplying(stuck)).toBe(true);
    expect(ap.isApplyStale(stuck)).toBe(true);
    expect(ap.canRetryApproval(admin, stuck, true)).toBe(true);
    const done = await ap.retryApproval(admin, approval.id);
    expect(done.status).toBe("approved");
    expect((await store.get("requests", req.id))!.status).toBe(
      "WAITING_DOWN_PAYMENT",
    );
  });
});
