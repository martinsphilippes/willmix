import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";
import { DAY_MS, towerScenario } from "./helpers/tower-fixture";

/*
 * Pendências da Wellmix pela lista pronta do resumo de cada pedido
 * (docs/RESUMOS.md, "Pendências"): produção, embarque e desembaraço,
 * certificação, artes e "Pagar fornecedor" saem de `order_summaries.tasks`,
 * com o encaminhamento decidido na leitura. A lista tem de ser a mesma do
 * caminho pelas tabelas (tipos, textos, links, prazos e donos), também
 * quando o tempo passa sem gravação e depois de gravações, e a leitura não
 * pode ler pedidos, passos, produção nem pagamentos.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const summary = await import("@/lib/services/order-summary");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { isWellmix } = await import("@/lib/auth/permissions");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

const NOW = new Date();
const iso = (offset: number) =>
  new Date(NOW.getTime() + offset * DAY_MS).toISOString();
let scenario: Awaited<ReturnType<typeof towerScenario>>;
let team: User[];
let held: Order;

/** O mesmo cálculo pelas tabelas (sem o marcador dos resumos). */
async function withoutSummaries<T>(fn: () => Promise<T>): Promise<T> {
  const store = getStore();
  const [marker] = await store.list("settings", {
    filter: { key: summary.SUMMARY_SETTING_KEY },
  });
  if (marker) await store.remove("settings", marker.id);
  try {
    return await fn();
  } finally {
    if (marker)
      await store.create("settings", {
        id: marker.id,
        key: marker.key,
        value: marker.value,
      });
  }
}

/** Os tipos que a lista pronta cobre (cada um tem de aparecer no teste). */
const KINDS = [
  "production_follow",
  "sku_inspection",
  "import_step",
  "import_validate",
  "cert_step",
  "cert_validate",
  "art_fix",
  "art_review",
  "supplier_payment",
];

/** Cada login da Wellmix (e o painel de SLA): a mesma lista pelos dois caminhos. */
async function expectSame() {
  const kinds = new Set<string>();
  for (const user of team)
    for (const options of [{}, { team: true }]) {
      const fromSummary = await pendingTasksFor(user, options);
      const fromTables = await withoutSummaries(() =>
        pendingTasksFor(user, options),
      );
      expect(fromSummary, `${user.email} ${JSON.stringify(options)}`).toEqual(
        fromTables,
      );
      for (const t of fromSummary) kinds.add(t.kind);
    }
  return kinds;
}

const create = (table: string, row: Record<string, unknown>) =>
  getStore().create(table as never, row as never);

function step(
  orderId: string,
  key: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  return create("import_steps", {
    orderId,
    key,
    status,
    value: null,
    amount: null,
    currency: null,
    documentId: null,
    submittedByUserId: null,
    submittedAt: status === "pending" ? null : iso(-1),
    validatedByUserId: null,
    validatedAt: null,
    rejectReason: null,
    ...extra,
  });
}

beforeAll(async () => {
  scenario = await towerScenario(NOW);
  const store = getStore();
  team = (await store.list("users")).filter(
    (u) => isWellmix(u) && u.active !== false,
  );
  const operator = team.find((u) => u.role === "operator")!;
  const { a, b, c } = scenario.orders;
  // c: sem certificadora (OCP). O memorial e o selo são só dela (dono,
  // 14/11/2026): a Wellmix recebe uma pendência só, a de vincular.
  await store.update("orders", c.id, { ocpId: null });
  // b: em embarque, com produção (follows de 5 e 15 dias vencidos, o de 25
  // ainda não), numerário a validar e booking enviado pelo operador.
  await store.update("orders", b.id, { status: "SHIPPING" });
  await step(b.id, "booking", "submitted", {
    submittedByUserId: operator.id,
  });
  await step(b.id, "cert_seal", "submitted", { documentId: null });
  await step(b.id, "cert_seal_art", "submitted", {
    submittedByUserId: operator.id,
  });
  await create("sku_inspections", {
    orderId: b.id,
    orderItemId: "sku-1",
    round: 1,
    result: "rejected",
    note: "cor",
    inspectedAt: iso(-3),
    inspectedByUserId: scenario.admin.id,
    supplierRespondedAt: iso(-1),
  });
  // a (pedido de compra) em embarque: rastreio do container registrado há dois dias.
  await store.update("orders", a.id, { status: "SHIPPING" });
  await step(a.id, "container_at_factory", "submitted");
  await step(a.id, "container_tracking", "submitted", {
    submittedAt: iso(-2),
  });
  // c: arte corrigida a conferir e condição de pagamento com parcelas (uma
  // vence hoje, a outra em 20 dias).
  const [item] = await store.list("order_items", {
    filter: { orderId: c.id },
    limit: 1,
  });
  await create("art_issues", {
    orderId: c.id,
    orderItemId: item?.id ?? null,
    status: "fixed",
    note: "texto",
    reason: "texto",
    reportedByUserId: scenario.admin.id,
    fixedByUserId: operator.id,
    fixedAt: iso(-1),
  });
  await store.update("orders", c.id, {
    fobTotal: 1000,
    fobCurrency: "USD",
    supplierPaymentTerms: [
      { percent: 30, base: "order_created", days: 0 },
      { percent: 70, base: "order_created", days: 20 },
    ],
  });
  // Pedido do histórico em espera, com tudo o que daria pendência: nada.
  held = await scenario.placeOrder("Histórico F");
  // Como na carga do histórico: etapas e itens também em espera.
  for (const s of await store.list("stages", { filter: { orderId: held.id } }))
    await store.update("stages", s.id, { held: true });
  for (const q of await store.list("requirements", {
    filter: { orderId: held.id },
  }))
    await store.update("requirements", q.id, { held: true });
  await store.update("orders", held.id, {
    held: true,
    status: "SHIPPING",
    fobTotal: 1000,
    fobCurrency: "USD",
    supplierPaymentTerms: [{ percent: 100, base: "order_created", days: 0 }],
  });
  await create("production_tracks", {
    orderId: held.id,
    mode: null,
    factoryName: null,
    factoryAddress: null,
    productionStartAt: iso(-30),
    etd: null,
    etdOriginal: null,
    etdHistory: [],
    followups: [],
    inspectionScheduledAt: null,
    inspectionNote: null,
    updatedByUserId: null,
  });
  await step(held.id, "booking", "submitted");
  await summary.rebuildOrderSummaries(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pendências da Wellmix pela lista pronta do resumo", () => {
  it("é a mesma lista do caminho pelas tabelas, de cada login e do painel de SLA", async () => {
    expect(await summary.summariesReady()).toBe(true);
    const kinds = await expectSame();
    // O teste não compara listas vazias: cada tipo aparece.
    // (A arte aberta do pedido b é da agência dele: vira da Wellmix abaixo,
    // com a arte feita pela Wellmix.)
    for (const kind of KINDS.filter((k) => k !== "art_fix"))
      expect(kinds, kind).toContain(kind);
    // Rastreio do container de dois dias atrás: volta hoje.
    const tasks = await pendingTasksFor(scenario.admin);
    expect(
      tasks.some(
        (t) => t.kind === "import_step" && t.stepKey === "container_tracking",
      ),
    ).toBe(true);
    // Pedido em espera: nenhuma pendência, nem guardada no resumo.
    expect(tasks.some((t) => t.orderId === held.id)).toBe(false);
    expect(tasks.some((t) => t.orderNumber === held.number)).toBe(false);
    const row = await getStore().get("order_summaries", held.id);
    expect(row?.hasTasks ?? false).toBe(false);
    expect(row?.tasks ?? null).toBeNull();
  });

  it("não lê pedidos, passos, produção, artes nem pagamentos", async () => {
    const store = getStore();
    const reads: { table: string; filter: object }[] = [];
    const list = store.list.bind(store);
    const spyList = vi.spyOn(store, "list").mockImplementation(((
      table: string,
      options?: { filter?: object },
    ) => {
      reads.push({ table, filter: options?.filter ?? {} });
      return list(table as never, options as never);
    }) as never);
    const original = store.listColumns?.bind(store);
    const spyColumns = original
      ? vi.spyOn(store, "listColumns").mockImplementation(((
          table: string,
          columns: string[],
          options?: { filter?: object },
        ) => {
          reads.push({ table, filter: options?.filter ?? {} });
          return original(table as never, columns as never, options as never);
        }) as never)
      : null;
    try {
      for (const user of team) {
        await pendingTasksFor(user);
        await pendingTasksFor(user, { team: true });
      }
    } finally {
      spyList.mockRestore();
      spyColumns?.mockRestore();
    }
    // A lista pronta: só as linhas de resumo com pendência.
    expect(
      reads.some(
        (r) =>
          r.table === "order_summaries" &&
          (r.filter as { hasTasks?: boolean }).hasTasks === true,
      ),
    ).toBe(true);
    // Fora da lista pronta (docs/RESUMOS.md, "O que ainda pesa"): os
    // documentos do embarque do pedido de compra (shippingDocTasks) leem os
    // pedidos de compra em inspeção ou embarque e o container vazio de cada um.
    const shippingDocs = (r: { table: string; filter: object }) =>
      (r.table === "orders" &&
        (r.filter as { flow?: string }).flow === "supplier_request") ||
      (r.table === "import_steps" &&
        (r.filter as { key?: string }).key === "container_empty") ||
      // Show room (showroomTasks, docs/SAMPLE_FLOW.md): o envio das
      // amostras ao Brasil, pela chave do passo.
      (r.table === "import_steps" &&
        (r.filter as { key?: string }).key === "samples_brazil");
    const rest = reads.filter((r) => !shippingDocs(r));
    for (const table of [
      "import_steps",
      "production_tracks",
      "sku_inspections",
      "art_issues",
      "payments",
    ])
      expect(
        rest.filter((r) => r.table === table),
        table,
      ).toEqual([]);
    // Pedidos: só os já escolhidos por id (revisão, programação de compra),
    // nunca a lista por situação ou fora de espera.
    expect(
      rest.filter((r) => r.table === "orders" && !("id" in r.filter)),
    ).toEqual([]);
  });

  it("continua certa quando o tempo passa sem gravação (follow, rastreio, parcela)", async () => {
    for (const days of [1, 6, 15, 22]) {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(NOW.getTime() + days * DAY_MS));
      const kinds = await expectSame();
      expect(kinds, `+${days}`).toContain("supplier_payment");
      vi.useRealTimers();
    }
    // 6 dias depois: o follow de 25 dias venceu.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW.getTime() + 6 * DAY_MS));
    const later = await pendingTasksFor(scenario.admin);
    expect(later.some((t) => t.title.startsWith("Follow de 25 dias"))).toBe(
      true,
    );
    // 15 dias depois: a 2ª parcela (em 20 dias) entra como "vencendo".
    vi.setSystemTime(new Date(NOW.getTime() + 15 * DAY_MS));
    const due = await pendingTasksFor(scenario.admin);
    expect(
      due.filter(
        (t) =>
          t.kind === "supplier_payment" &&
          t.orderNumber === scenario.orders.c.number,
      ).length,
    ).toBe(2);
  });

  it("depois de gravações e de mudanças no encaminhamento, segue igual", async () => {
    const store = getStore();
    const { b, c } = scenario.orders;
    const operator = team.find((u) => u.role === "operator")!;
    // Follow registrado, analista e despachante do pedido, designer da arte.
    const [track] = await store.list("production_tracks", {
      filter: { orderId: b.id },
    });
    await store.update("production_tracks", track.id, {
      followups: [
        {
          day: 5,
          status: "on_track",
          note: null,
          at: iso(0),
          byUserId: scenario.admin.id,
        },
      ],
    });
    await store.update("orders", b.id, {
      ownerUserId: operator.id,
      brokerId: "despachante-1",
    });
    await store.update("orders", c.id, { designerUserId: operator.id });
    await expectSame();
    // Pagamento da parcela e arte aceita.
    await create("payments", {
      orderId: c.id,
      direction: "supplier_out",
      amount: 300,
      currency: "USD",
      status: "confirmed",
      note: "Parcela 1/2",
    });
    const [issue] = await store.list("art_issues", {
      filter: { orderId: c.id, status: "fixed" },
    });
    await store.update("art_issues", issue.id, { status: "accepted" });
    await expectSame();
    // Encaminhamento sem gravar no pedido: arte feita pela agência e o
    // operador fora da equipe ativa.
    const { getSettings, setSetting } = await import("@/lib/settings");
    const settings = await getSettings();
    await setSetting(
      "agencyValidationEnabled",
      !settings.agencyValidationEnabled,
    );
    await store.update("users", operator.id, { active: false });
    try {
      team = team.filter((u) => u.id !== operator.id);
      const kinds = await expectSame();
      if (settings.agencyValidationEnabled) expect(kinds).toContain("art_fix");
    } finally {
      await store.update("users", operator.id, { active: true });
      team.push(operator);
    }
  });
});
