import { describe, expect, it } from "vitest";
import {
  computeCommissions,
  paidStatus,
  publicationConflicts,
  tierValue,
  type AgreementDef,
  type CommissionComponent,
  type Operation,
} from "@/lib/commission";

/*
 * Motor de comissões (docs/COMMISSIONS.md): os cenários de aceite do dono.
 * Linha A R$ 10.000 a 2% e linha B R$ 5.000 a 4% = R$ 400; a exceção de um
 * parceiro (linha A a 3%) leva o dele a R$ 500; o bônus de R$ 250 por sucesso
 * leva a R$ 750 depois da entrega.
 */

const comp = (patch: Partial<CommissionComponent>): CommissionComponent => ({
  id: "c",
  name: "Regra",
  kind: "percent",
  base: "items",
  rate: null,
  amount: null,
  lineIds: [],
  tiers: null,
  tierMode: "progressive",
  accumulate: false,
  successEvent: null,
  floor: null,
  cap: null,
  ...patch,
});

const agreement = (patch: Partial<AgreementDef>): AgreementDef => ({
  id: "a",
  rootId: "a",
  version: 1,
  name: "Acordo",
  category: "comissao",
  priority: 0,
  beneficiaryPartyId: null,
  beneficiaryType: null,
  scope: { customerIds: [], supplierIds: [], lineIds: [] },
  validFrom: null,
  validTo: null,
  currency: "BRL",
  generateOn: "order_created",
  releaseOn: "delivered",
  releaseMode: "proportional",
  dueDays: 30,
  components: [],
  ...patch,
});

const order = (patch: Partial<Operation> = {}): Operation => ({
  orderId: "o1",
  refDate: "2026-11-11T12:00:00.000Z",
  currency: "BRL",
  customerId: "cliente",
  supplierId: "fornecedor",
  items: [
    { id: "i1", name: "Jarra", lineId: "ud", quantity: 1000, amount: 10000 },
    { id: "i2", name: "Caixa", lineId: "org", quantity: 500, amount: 5000 },
  ],
  sellTotal: 15000,
  fobTotal: 9000,
  received: 0,
  events: ["order_created"],
  partiesByType: { carrier: "transp-x" },
  cancelled: false,
  ...patch,
});

const padrao = agreement({
  id: "padrao",
  rootId: "padrao",
  name: "Padrão transportadores",
  beneficiaryType: "carrier",
  components: [
    comp({ id: "ud", name: "UD 2%", rate: 2, lineIds: ["ud"] }),
    comp({ id: "org", name: "Organização 4%", rate: 4, lineIds: ["org"] }),
  ],
});
const excecao = agreement({
  id: "excecao",
  rootId: "excecao",
  name: "Negociado com a Transp X",
  beneficiaryPartyId: "transp-x",
  components: [
    comp({ id: "ud3", name: "UD 3%", rate: 3, lineIds: ["ud"] }),
    comp({
      id: "bonus",
      name: "Bônus por entrega",
      kind: "fixed",
      amount: 250,
      accumulate: true,
      successEvent: "delivered",
    }),
  ],
});
const total = (r: ReturnType<typeof computeCommissions>, who: string) =>
  Math.round(
    r.entries
      .filter((e) => e.beneficiaryPartyId === who)
      .reduce((s, e) => s + e.amount, 0) * 100,
  ) / 100;

describe("cenários de aceite", () => {
  it("1. percentuais por linha: 10.000 a 2% + 5.000 a 4% = 400", () => {
    const r = computeCommissions([padrao], order());
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]).toMatchObject({
      beneficiaryPartyId: "transp-x",
      amount: 400,
      released: 0,
    });
    expect(
      r.entries[0].lines.map((l) => [l.itemName, l.rate, l.value]),
    ).toEqual([
      ["Jarra", 2, 200],
      ["Caixa", 4, 200],
    ]);
  });

  it("2. exceção individual: a linha UD passa a 3% só para o parceiro (500); os demais seguem em 400", () => {
    const r = computeCommissions([padrao, excecao], order());
    expect(total(r, "transp-x")).toBe(500);
    // A memória diz o que foi substituído, por quem e por quê.
    expect(r.replaced).toEqual([
      {
        agreementName: "Padrão transportadores",
        componentName: "UD 2%",
        itemName: "Jarra",
        byAgreementName: "Negociado com a Transp X",
        reason: "individual",
      },
    ]);
    // Outro transportador, mesmo pedido: a regra padrão.
    const other = computeCommissions(
      [padrao, excecao],
      order({ partiesByType: { carrier: "transp-y" } }),
    );
    expect(total(other, "transp-y")).toBe(400);
    expect(total(other, "transp-x")).toBe(0);
  });

  it("3. bônus acumulável de 250: só depois da condição de sucesso (750)", () => {
    const before = computeCommissions([padrao, excecao], order());
    expect(total(before, "transp-x")).toBe(500);
    const after = computeCommissions(
      [padrao, excecao],
      order({ events: ["order_created", "delivered"] }),
    );
    expect(total(after, "transp-x")).toBe(750);
    // Entregue: tudo liberado.
    expect(after.entries.every((e) => e.released === e.amount)).toBe(true);
  });

  it("4. recebimento parcial: liberação proporcional ou só com tudo recebido", () => {
    const prop = { ...padrao, releaseOn: "received" as const };
    const half = computeCommissions([prop], order({ received: 7500 }));
    expect(half.entries[0]).toMatchObject({ amount: 400, released: 200 });
    const full = { ...prop, releaseMode: "full" as const };
    expect(
      computeCommissions([full], order({ received: 7500 })).entries[0].released,
    ).toBe(0);
    expect(
      computeCommissions([full], order({ received: 15000 })).entries[0]
        .released,
    ).toBe(400);
    // Repetir a conta dá o mesmo resultado.
    expect(computeCommissions([prop], order({ received: 7500 }))).toEqual(half);
  });

  it("5. vigência: a versão da data de referência é a que vale", () => {
    const v1 = { ...padrao, validTo: "2026-11-30" };
    const v2 = {
      ...padrao,
      id: "padrao-v2",
      version: 2,
      validFrom: "2026-12-01",
      components: [comp({ id: "all", name: "Tudo 5%", rate: 5 })],
    };
    expect(computeCommissions([v1, v2], order()).entries[0].amount).toBe(400);
    const dec = computeCommissions(
      [v1, v2],
      order({ refDate: "2026-12-05T00:00:00.000Z" }),
    );
    expect(dec.entries).toHaveLength(1);
    expect(dec.entries[0]).toMatchObject({ version: 2, amount: 750 });
    // Pedido cancelado não gera comissão.
    expect(
      computeCommissions([v1], order({ cancelled: true })).entries,
    ).toEqual([]);
  });

  it("6. beneficiário sem vínculo com o pedido: o acordo individual precisa dizer de quem vale", () => {
    const rep = agreement({
      id: "rep",
      rootId: "rep",
      name: "Representante",
      beneficiaryPartyId: "pessoa-sem-login",
      components: [
        comp({ id: "v", name: "1% da venda", base: "order_sell", rate: 1 }),
      ],
    });
    expect(computeCommissions([rep], order()).entries).toEqual([]);
    const scoped = {
      ...rep,
      scope: { customerIds: ["cliente"], supplierIds: [], lineIds: [] },
    };
    expect(computeCommissions([scoped], order()).entries[0]).toMatchObject({
      beneficiaryPartyId: "pessoa-sem-login",
      amount: 150,
    });
    expect(
      computeCommissions([scoped], order({ customerId: "outro" })).entries,
    ).toEqual([]);
  });
});

describe("regras do motor", () => {
  it("espera o fato que gera; base indisponível fica pendente, sem trocar de base", () => {
    const late = { ...padrao, generateOn: "delivered" as const };
    const r = computeCommissions([late], order());
    expect(r.entries).toEqual([]);
    expect(r.waiting).toEqual([
      { agreementName: "Padrão transportadores", event: "delivered" },
    ]);
    const onSell = agreement({
      beneficiaryType: "carrier",
      components: [comp({ base: "order_sell", rate: 3 })],
    });
    const pending = computeCommissions([onSell], order({ sellTotal: null }));
    expect(pending.entries[0]).toMatchObject({ amount: 0 });
    expect(pending.entries[0].pending).toContain("base:order_sell");
    // Moeda diferente do pedido: pendente (não converte por conta própria).
    const usd = agreement({
      beneficiaryType: "carrier",
      currency: "USD",
      components: [comp({ kind: "fixed", amount: 100 })],
    });
    expect(computeCommissions([usd], order()).entries[0].pending).toContain(
      "currency:USD",
    );
  });

  it("por unidade, valor fixo, piso e teto", () => {
    const a = agreement({
      beneficiaryType: "carrier",
      components: [
        comp({
          id: "u",
          name: "R$ 2 por peça UD",
          kind: "per_unit",
          amount: 2,
          lineIds: ["ud"],
          cap: 1500,
        }),
        comp({
          id: "f",
          name: "Fixo",
          kind: "fixed",
          amount: 100,
          accumulate: true,
          floor: 300,
        }),
      ],
    });
    const e = computeCommissions([a], order()).entries[0];
    // 1000 peças × 2 = 2000, teto 1500; fixo 100, piso 300.
    expect(e.amount).toBe(1800);
    expect(e.lines.filter((l) => l.note).map((l) => [l.note, l.value])).toEqual(
      [
        ["cap", -500],
        ["floor", 200],
      ],
    );
  });

  it("faixas: progressivo e taxa da faixa atingida na base inteira", () => {
    const tiers = [
      { upTo: 10000, rate: 2 },
      { upTo: null, rate: 4 },
    ];
    // 15.000: progressivo = 10.000×2% + 5.000×4% = 400; inteira = 15.000×4% = 600.
    expect(tierValue(1500000, tiers, "progressive").valueCents).toBe(40000);
    expect(tierValue(1500000, tiers, "whole")).toEqual({
      valueCents: 60000,
      rate: 4,
    });
    const a = agreement({
      beneficiaryType: "carrier",
      components: [comp({ base: "order_sell", tiers, tierMode: "whole" })],
    });
    expect(computeCommissions([a], order()).entries[0].amount).toBe(600);
  });

  it("arredondamento em centavos, meio para cima, por linha", () => {
    const a = agreement({
      beneficiaryType: "carrier",
      components: [comp({ rate: 2.5 })],
    });
    const r = computeCommissions(
      [a],
      order({
        items: [
          { id: "x", name: "X", lineId: "ud", quantity: 1, amount: 0.2 },
          { id: "y", name: "Y", lineId: "ud", quantity: 1, amount: 33.33 },
        ],
      }),
    );
    // 0,20×2,5% = 0,005 → 0,01; 33,33×2,5% = 0,83325 → 0,83.
    expect(r.entries[0].lines.map((l) => l.value)).toEqual([0.01, 0.83]);
    expect(r.entries[0].amount).toBe(0.84);
  });

  it("conflito: duas regras exclusivas de mesma precedência; a publicação bloqueia", () => {
    const twin = { ...padrao, id: "gemeo", rootId: "gemeo", name: "Gêmeo" };
    const r = computeCommissions([padrao, twin], order());
    expect(r.conflicts.length).toBeGreaterThan(0);
    expect(publicationConflicts(twin, [padrao]).map((a) => a.id)).toEqual([
      "padrao",
    ]);
    // Prioridade diferente, ou regra que acumula: sem conflito.
    expect(publicationConflicts({ ...twin, priority: 1 }, [padrao])).toEqual(
      [],
    );
    expect(publicationConflicts(excecao, [padrao])).toEqual([]);
    // Nova versão do mesmo acordo não conflita com a anterior.
    expect(
      publicationConflicts({ ...padrao, id: "v2", version: 2 }, [padrao]),
    ).toEqual([]);
  });

  it("situação pelo pago", () => {
    expect(paidStatus(400, 0)).toBe("approved");
    expect(paidStatus(400, 150)).toBe("partially_paid");
    expect(paidStatus(400, 400)).toBe("paid");
  });
});
