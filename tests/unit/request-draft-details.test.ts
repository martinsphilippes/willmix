import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Detalhes do rascunho (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seção
 * 7): a mesma tela da solicitação enviada, só para consulta.
 * - Privacidade: só quem salvou, da Wellmix, da tela de onde veio (a regra de
 *   "Continuar"); o da Reposição fica de fora; o resto, nulo (404).
 * - Só leitura: abrir não grava nada (nem número, nem auditoria, nem aviso).
 * - Quantidade em branco não vira zero; zero digitado continua zero; totais
 *   parciais quando falta o dado.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { saveRequestDraft } = await import("@/lib/services/request-drafts");
const { draftDetailsModel, draftPieces, getDraftForDetails, loadDraftDetails } =
  await import("@/app/app/requests/_details/draft-details");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;
let customer: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  customer = users.find((u) => u.email === "joao@lojista.com")!;
});

/**
 * O formulário do rascunho: a boneca em 3 entregas de 720, um copo fora do
 * catálogo (100, a 2ª entrega em branco, 0 digitado na 3ª) e um prato fora do
 * catálogo sem quantidade.
 */
function form() {
  const f = new FormData();
  f.append("customerId", customer.partyId!);
  const plan = (p: string, qty: string[]) => {
    f.append(`${p}schedule.count`, "3");
    f.append(`${p}schedule.intervalDays`, "30");
    f.append(`${p}schedule.firstDate`, "2027-04-01");
    qty.forEach((q, i) => f.append(`${p}schedule.qty.${i + 1}`, q));
  };
  f.append("p0.productId", "prod-boneca");
  f.append("p0.productName", "");
  f.append("p0.description", "");
  f.append("p0.quantity", "2160");
  f.append("p0.unit", "un");
  plan("p0.", ["720", "720", "720"]);
  f.append("p1.productName", "Copo de vidro");
  f.append("p1.description", "Copo 300 ml");
  f.append("p1.sourcingDemand", "on");
  f.append("p1.quantity", "100");
  f.append("p1.unit", "un");
  plan("p1.", ["100", "", "0"]);
  f.append("p2.productName", "Prato raso");
  f.append("p2.description", "Prato 26 cm");
  f.append("p2.sourcingDemand", "on");
  f.append("p2.quantity", "");
  f.append("p2.unit", "un");
  return f;
}

/** O que está gravado (para conferir que abrir não muda nada). */
async function snapshot() {
  const store = getStore();
  const [drafts, requests, audit, notifications] = await Promise.all([
    store.list("request_drafts"),
    store.list("requests"),
    store.list("audit_log"),
    store.list("notifications"),
  ]);
  return JSON.stringify({ drafts, requests, audit, notifications });
}

describe("detalhes do rascunho", () => {
  it("lê o que foi salvo, com a mesma conta da solicitação enviada, sem gravar nada", async () => {
    const draft = await saveRequestDraft(admin, form(), null, "ts");
    expect(typeof draft.number).toBe("number");
    const before = await snapshot();

    const details = (await loadDraftDetails(admin, draft.id))!;
    expect(details.number).toBe(draft.number);
    expect(details.resumeHref).toBe(`/app/new-request/ts?draft=${draft.id}`);
    expect(details.canResume).toBe(true);
    expect(details.customerName).toBe("Loja do João Ltda");
    const [doll, cup, plate] = details.products;
    expect(doll.productId).toBe("prod-boneca");
    expect(doll.productName).toBe("Boneca articulada 30 cm");
    expect(doll.quantityKnown).toBe(true);
    expect(doll.incomplete).toBe(false);
    // Em branco não é zero; zero digitado continua zero.
    expect(cup.scheduleTyped).toEqual([true, false, true]);
    expect(cup.schedule?.items.map((i) => i.quantity)).toEqual([100, 0, 0]);
    expect(draftPieces(cup)).toBe(100);
    expect(cup.outside).toBe(true);
    expect(plate.quantity).toBeNull();
    expect(plate.quantityKnown).toBe(false);
    expect(plate.incomplete).toBe(true);
    expect(draftPieces(plate)).toBeNull();

    const model = await draftDetailsModel(details, {
      nameOf: (p) => p.productName,
      capacityCbm: 76,
    });
    // A boneca: 48 por caixa, 3 × 15 caixas; o copo sem caixa; o prato sem nada.
    expect(model.rows[0].line).toMatchObject({
      pieces: 2160,
      boxes: 45,
      innerBoxes: 360,
    });
    expect(model.rows[1].line.pieces).toBe(100);
    expect(model.rows[1].line.boxes).toBeNull();
    expect(model.rows[2].line).toMatchObject({
      pieces: null,
      boxes: null,
      innerBoxes: null,
      cbm: null,
    });
    expect(model.totals.pieces).toEqual({
      value: 2260,
      missing: ["Prato raso"],
    });
    expect(model.totals.boxes.value).toBe(45);
    expect(model.totals.boxes.missing).toEqual(["Copo de vidro", "Prato raso"]);
    // Previsão de venda só no envio: nenhum preço.
    expect(model.totals.sale.amounts).toEqual([]);
    // Produto sem quantidade: os containers ficam "—" (a conta sairia menor).
    expect(model.rounds.rounds).toBe(3);
    expect(model.rounds.containers).toBeNull();
    expect(model.distinctProducts).toBe(3);

    // Só leitura: nada mudou no banco (rascunho, solicitações, auditoria, avisos).
    expect(await snapshot()).toBe(before);
  });

  it("zero digitado em todas as entregas é zero (não falta); tudo em branco é falta", async () => {
    const f = new FormData();
    f.append("customerId", customer.partyId!);
    for (const [p, qty] of [
      ["p0.", ["0", "0"]],
      ["p1.", ["", ""]],
    ] as const) {
      f.append(`${p}productName`, `Item ${p}`);
      f.append(`${p}description`, "x");
      f.append(`${p}sourcingDemand`, "on");
      f.append(`${p}quantity`, "");
      f.append(`${p}unit`, "un");
      f.append(`${p}schedule.count`, "2");
      f.append(`${p}schedule.intervalDays`, "30");
      f.append(`${p}schedule.firstDate`, "2027-04-01");
      qty.forEach((q, i) => f.append(`${p}schedule.qty.${i + 1}`, q));
    }
    const draft = await saveRequestDraft(admin, f, null, "ts");
    const details = (await loadDraftDetails(admin, draft.id))!;
    const model = await draftDetailsModel(details, {
      nameOf: (p) => p.productName,
      capacityCbm: 76,
    });
    expect(model.rows[0].line.pieces).toBe(0);
    expect(model.rows[1].line.pieces).toBeNull();
    expect(model.totals.pieces).toEqual({ value: 0, missing: ["Item p1."] });
  });

  it("privacidade: só quem salvou; o cliente, outro login e a Reposição não abrem", async () => {
    const draft = await saveRequestDraft(admin, form(), null, "ts");
    expect(await getDraftForDetails(admin, draft.id)).not.toBeNull();
    expect(await loadDraftDetails(operator, draft.id)).toBeNull();
    expect(await loadDraftDetails(customer, draft.id)).toBeNull();
    // Id inválido ou inexistente: nulo (404), sem dizer se existe.
    expect(await loadDraftDetails(admin, "../x")).toBeNull();
    expect(await loadDraftDetails(admin, "nao-existe")).toBeNull();
    // O rascunho da entrada da Reposição é da fila de Reposição.
    const repo = form();
    repo.append("from", "replenishment");
    const replenishment = await saveRequestDraft(admin, repo, null, "sale");
    expect(await loadDraftDetails(admin, replenishment.id)).toBeNull();
    // Sem a tela de onde o rascunho veio (TS), nem quem o salvou abre.
    await getStore().update("users", admin.id, {
      role: "operator",
      functions: ["sales"],
      screens: ["requests"],
    } as never);
    const demoted = (await getStore().get("users", admin.id))!;
    const tsOnly = await getStore().create("request_drafts", {
      userId: demoted.id,
      customerId: null,
      customerName: null,
      title: "TS",
      itemCount: 0,
      payload: [["requestScreen", "ts"]],
      number: 999,
    } as never);
    // A mesma regra de "Continuar" (canDraft da tela TS), nunca mais larga.
    const { canDraft } = await import("@/lib/services/request-drafts");
    const allowed = await getDraftForDetails(demoted, tsOnly.id);
    expect(allowed !== null).toBe(canDraft(demoted, "ts"));
    await getStore().update("users", admin.id, {
      role: "admin",
      functions: admin.functions,
      screens: admin.screens,
    } as never);
  });
});
