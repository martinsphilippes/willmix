import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Lote com divergência (mapa E21, E24 a E27; dono, 15/11/2026;
 * docs/RECEIVING.md): cada contagem com divergência nova abre um lote; o
 * sistema avisa Compras (E24); a Diretoria de compras abre com o fornecedor e
 * a Trading responde (E25); Compras/Logística juntam evidências e a Trading
 * aprova (E26); o Financeiro (ou o Agente de carga) registra a mitigação e a
 * Trading aprova o Acordo de Divergência, que fecha o lote (E27).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const rc = await import("@/lib/services/receiving");
const lots = await import("@/lib/services/divergence-lots");
const team = await import("@/lib/services/team");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;
type WellmixFunction = import("@/lib/db/schema").WellmixFunction;

let admin: User;
let quality: User;
let finance: User;
let director: User;
let supplierA: User;
let supplierB: User;
let agent: User;
let order: Order;

async function member(email: string, fn: WellmixFunction): Promise<User> {
  const u = await getStore().create("users", {
    email,
    name: email.split("@")[0],
    role: "operator",
    partyId: null,
    locale: "pt",
    passwordHash: null,
    active: true,
    importerId: null,
  });
  await team.setTeamMember(admin, u.id, {
    jobLevel: null,
    managerUserId: null,
    division: null,
    functions: [fn],
  });
  return (await getStore().get("users", u.id))!;
}

const pdf = async (who: User) => {
  const { uploadDocument } = await import("@/lib/services/documents");
  return (
    await uploadDocument(
      who,
      new File(["%PDF-1.4 evidencia"], "evidencia.pdf", {
        type: "application/pdf",
      }),
      { orderId: order.id, type: "attachment", visibility: "supplier" },
    )
  ).id;
};

const submit = (
  who: User,
  lotId: string,
  step: "supplier" | "evidence" | "finance",
  extra: Partial<{
    text: string | null;
    choice: string | null;
    amount: number | null;
    currency: string | null;
    documentIds: string[];
  }> = {},
) =>
  lots.submitLotStep(who, lotId, step, {
    text: "texto",
    choice: null,
    amount: null,
    currency: null,
    documentIds: [],
    ...extra,
  });

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  supplierA = by("supplier.a@china.com");
  supplierB = by("supplier.b@china.com");
  const joao = by("joao@lojista.com");
  quality = await member("qualidade.lot@wellmix.com", "quality");
  finance = await member("fin.lot@wellmix.com", "finance");
  director = await member("diretor.lot@wellmix.com", "purchasing_director");
  const store = getStore();
  const agentParty = await store.create("parties", {
    type: "logistics",
    name: "Agente Lote",
    active: true,
  } as never);
  agent = await store.create("users", {
    email: "agente.lot@carga.com",
    name: "Agente",
    role: "logistics",
    partyId: agentParty.id,
    locale: "pt",
    passwordHash: null,
    active: true,
    importerId: null,
  });
  const req = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: "Jarra lote",
    description: "Jarra lote",
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
    notes: null,
  });
  const o = await orderFromRequest(admin, req);
  order = await store.update("orders", o.id, {
    status: "DELIVERED",
    supplierId: supplierA.partyId!,
    logisticsId: agentParty.id,
  });
});

describe("lote com divergência (E21, E24 a E27)", () => {
  it("a contagem abre um lote com os itens; Compras avisada; nova avaria do mesmo item não abre outro", async () => {
    const [item] = await getStore().list("order_items", {
      filter: { orderId: order.id },
    });
    await rc.saveCounts(quality, order.id, [
      { orderItemId: item.id, received: 90, damaged: 0, note: "faltam 10" },
    ]);
    let list = await lots.lotsOfOrder(order.id);
    expect(list).toHaveLength(1);
    const [lot] = list;
    expect(lot).toMatchObject({ status: "open", number: expect.any(Number) });
    expect(lot.items).toEqual([
      expect.objectContaining({
        orderItemId: item.id,
        expected: 100,
        received: 90,
        kinds: ["shortage"],
      }),
    ]);
    // E24 automático: a Diretoria de compras foi avisada.
    expect(lot.purchasingNotifiedAt).toBeTruthy();
    expect(lot.purchasingUserIds).toContain(director.id);
    // Os passos antigos por pedido não nascem mais.
    const steps = await getStore().list("import_steps", {
      filter: { orderId: order.id },
    });
    expect(steps.filter((s) => s.key.startsWith("divergence_"))).toEqual([]);
    await rc.saveCounts(quality, order.id, [
      { orderItemId: item.id, received: 90, damaged: 2, note: "avaria" },
    ]);
    list = await lots.lotsOfOrder(order.id);
    expect(list).toHaveLength(1);
    // Fora do pedido: outro fornecedor não vê o lote.
    expect(await lots.lotView(supplierB, lot.id)).toBeNull();
    expect(await lots.listLots(supplierB)).toEqual([]);
  });

  it("E25: a Diretoria de compras abre e a Trading responde", async () => {
    const [lot] = await lots.lotsOfOrder(order.id);
    // E27 espera E25 e E26.
    await expect(submit(finance, lot.id, "finance")).rejects.toThrow(
      "lot_step_waiting",
    );
    // Tarefas: a Diretoria de compras tem o E25 a fazer.
    expect(
      (await lots.lotTasks(director)).map((x) => `${x.step}:${x.kind}`),
    ).toContain("supplier:do");
    await expect(submit(quality, lot.id, "supplier")).rejects.toThrow();
    await expect(
      submit(director, lot.id, "supplier", { text: " " }),
    ).rejects.toThrow("lot_text_required");
    await submit(director, lot.id, "supplier", {
      text: "Faltaram 10 jarras no container",
    });
    expect(
      (await lots.lotTasks(supplierA)).map((x) => `${x.step}:${x.kind}`),
    ).toContain("supplier:decide");
    await expect(
      lots.decideLotStep(supplierB, lot.id, "supplier", {
        approve: true,
        choice: "accepts",
        text: "ok",
      }),
    ).rejects.toThrow();
    await expect(
      lots.decideLotStep(supplierA, lot.id, "supplier", {
        approve: true,
        choice: null,
        text: "ok",
      }),
    ).rejects.toThrow("lot_choice_required");
    const after = await lots.decideLotStep(supplierA, lot.id, "supplier", {
      approve: true,
      choice: "replaces",
      text: "Mandamos 10 no próximo embarque",
    });
    expect(after.supplierStep).toMatchObject({
      status: "approved",
      choice: "replaces",
    });
  });

  it("E26: evidências obrigatórias; a Trading devolve com motivo e depois aprova", async () => {
    const [lot] = await lots.lotsOfOrder(order.id);
    await expect(submit(quality, lot.id, "evidence")).rejects.toThrow(
      "lot_evidence_required",
    );
    await submit(quality, lot.id, "evidence", {
      text: "Fotos do palete aberto",
      documentIds: [await pdf(quality)],
    });
    await expect(
      lots.decideLotStep(supplierA, lot.id, "evidence", {
        approve: false,
        choice: null,
        text: null,
      }),
    ).rejects.toThrow("lot_reason_required");
    await lots.decideLotStep(supplierA, lot.id, "evidence", {
      approve: false,
      choice: null,
      text: "Falta o vídeo da contagem",
    });
    expect(
      (await getStore().get("divergence_lots", lot.id))!.evidenceStep.status,
    ).toBe("rejected");
    // Reenvia: os arquivos anteriores ficam.
    await submit(quality, lot.id, "evidence", {
      text: "Com o vídeo",
      documentIds: [await pdf(quality)],
    });
    const after = await lots.decideLotStep(supplierA, lot.id, "evidence", {
      approve: true,
      choice: null,
      text: null,
    });
    expect(after.evidenceStep.status).toBe("approved");
    expect(after.evidenceStep.documentIds).toHaveLength(2);
  });

  it("E27: Financeiro ou Agente de carga registra; a Trading aprova e o lote fecha", async () => {
    const [lot] = await lots.lotsOfOrder(order.id);
    expect((await lots.lotView(agent, lot.id))!.can.finance.submit).toBe(true);
    await expect(submit(director, lot.id, "finance")).rejects.toThrow();
    await expect(
      submit(finance, lot.id, "finance", { choice: "discount" }),
    ).rejects.toThrow("lot_amount_required");
    await submit(finance, lot.id, "finance", {
      text: "Desconto na próxima fatura",
      choice: "discount",
      amount: 500,
      currency: "USD",
    });
    const closed = await lots.decideLotStep(supplierA, lot.id, "finance", {
      approve: true,
      choice: null,
      text: "De acordo",
    });
    expect(closed).toMatchObject({ status: "closed" });
    expect(closed.financeStep).toMatchObject({
      status: "approved",
      choice: "discount",
      amount: 500,
    });
    await expect(submit(finance, lot.id, "finance")).rejects.toThrow(
      "lot_closed",
    );
    expect(await lots.lotTasks(supplierA)).toEqual([]);
  });
});
