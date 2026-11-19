import { describe, expect, it } from "vitest";
import {
  entryLate,
  listCards,
  type CardEntry,
  type CardRow,
} from "@/lib/services/request-list-cards";

/*
 * Cards de Encomendas (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md, seção
 * 6): cada solicitação conta uma vez, os rascunhos entram no Total e em
 * Rascunhos, Atrasadas é um subconjunto de Abertas pelo prazo da etapa, e o
 * card escolhido filtra a lista sem mudar a contagem dos outros.
 */

const today = "2026-11-19";
const now = new Date("2026-11-19T15:00:00Z");

const row = (over: Partial<CardRow> = {}): CardRow => ({
  number: 4,
  productName: "Boneca",
  description: "Boneca",
  kind: "order",
  step: { key: "confirm", who: "customer" },
  due: { at: "2026-11-24", day: true },
  ...over,
});
const entry = (rows: CardRow[], customerName = "FC DISTRIBUIDORA") => ({
  rows,
  customerName,
});
const draft = (number: number, title = "Sem produto") => ({
  number,
  title,
  customerName: "LOJA G",
});

/** O exemplo de produção: #4 (1 produto), #6 (2 produtos) e 2 rascunhos. */
const production = () => ({
  entries: [
    entry([row({ number: 4 })]),
    entry([
      row({
        number: 6,
        productName: "Lousa",
        due: { at: "2026-11-25", day: true },
      }),
      row({
        number: 6,
        productName: "Barco",
        due: { at: "2026-11-25", day: true },
      }),
    ]),
  ] as CardEntry[],
  drafts: [draft(7, "BONECA LIULY"), draft(8)],
});

const base = {
  situation: "all" as const,
  q: "",
  kind: null,
  turn: null,
  now,
  today,
};

describe("cards por solicitação", () => {
  it("2 enviadas e 2 rascunhos: Total 4, Abertas 2, Rascunhos 2 (a #6 de 2 produtos conta uma vez)", () => {
    const { entries, drafts } = production();
    const out = listCards(entries, drafts, base);
    expect(out.counts).toEqual({ all: 4, open: 2, draft: 2, late: 0 });
    expect(out.entries).toHaveLength(2);
    expect(out.drafts).toHaveLength(2);
  });

  it("o card escolhido filtra a lista sem mudar a contagem dos outros", () => {
    const { entries, drafts } = production();
    const onlyDrafts = listCards(entries, drafts, {
      ...base,
      situation: "draft",
    });
    expect(onlyDrafts.counts).toEqual({ all: 4, open: 2, draft: 2, late: 0 });
    expect(onlyDrafts.entries).toEqual([]);
    expect(onlyDrafts.drafts.map((d) => d.number)).toEqual([7, 8]);
    const open = listCards(entries, drafts, { ...base, situation: "open" });
    expect(open.counts).toEqual(onlyDrafts.counts);
    expect(open.entries).toHaveLength(2);
    expect(open.drafts).toEqual([]);
  });

  it("Atrasadas: abertas com o prazo da etapa vencido (por dia ou por instante), subconjunto de Abertas", () => {
    const entries: CardEntry[] = [
      // Prazo do dia de ontem: vencido.
      entry([row({ number: 10, due: { at: "2026-11-18", day: true } })]),
      // Prazo de hoje: vence só amanhã.
      entry([row({ number: 11, due: { at: "2026-11-19", day: true } })]),
      // SLA de uma hora atrás: vencido.
      entry([
        row({
          number: 12,
          step: { key: "supplier_decide", who: "wellmix" },
          due: { at: "2026-11-19T14:00:00Z", day: false },
        }),
      ]),
      // SLA daqui a uma hora: no prazo.
      entry([
        row({
          number: 13,
          step: { key: "supplier_answer", who: "supplier" },
          due: { at: "2026-11-19T16:00:00Z", day: false },
        }),
      ]),
    ];
    const out = listCards(entries, [], base);
    expect(out.counts).toMatchObject({ all: 4, open: 4, late: 2 });
    const late = listCards(entries, [], { ...base, situation: "late" });
    expect(late.entries.map((e) => e.rows[0].number)).toEqual([10, 12]);
    // Sem etapa pendente não é aberta nem atrasada.
    const done = entry([
      row({
        step: { key: "none", who: null },
        due: { at: "2026-01-01", day: true },
      }),
    ]);
    expect(entryLate(done, now, today)).toBe(false);
    expect(listCards([done], [], base).counts).toMatchObject({
      open: 0,
      late: 0,
    });
  });

  it("a busca vale para os cards (número com ou sem #, produto, cliente) e acha rascunho pelo número", () => {
    const { entries, drafts } = production();
    expect(listCards(entries, drafts, { ...base, q: "#6" }).counts).toEqual({
      all: 1,
      open: 1,
      draft: 0,
      late: 0,
    });
    // Produto de outro item do lote: a solicitação inteira entra.
    const barco = listCards(entries, drafts, { ...base, q: "barco" });
    expect(barco.entries).toHaveLength(1);
    expect(barco.entries[0].rows).toHaveLength(2);
    expect(
      listCards(entries, drafts, { ...base, q: "7" }).drafts.map(
        (d) => d.number,
      ),
    ).toEqual([7]);
    expect(
      listCards(entries, drafts, { ...base, q: "liuly" }).counts.draft,
    ).toBe(1);
  });

  it("Com quem está: a solicitação entra se alguma ação é da parte; rascunho é da Wellmix; cada parte conta uma vez", () => {
    // Ações paralelas: um produto com o fornecedor, outro com a Wellmix.
    const parallel = entry([
      row({ number: 20, step: { key: "supplier_answer", who: "supplier" } }),
      row({ number: 20, step: { key: "supplier_decide", who: "wellmix" } }),
      row({ number: 20, step: { key: "supplier_decide", who: "wellmix" } }),
    ]);
    const customerOnly = entry([row({ number: 21 })]);
    const drafts = [draft(22)];
    const all = listCards([parallel, customerOnly], drafts, base);
    expect(all.chips).toEqual([
      { party: "wellmix", count: 2 },
      { party: "customer", count: 1 },
      { party: "supplier", count: 1 },
    ]);
    const supplier = listCards([parallel, customerOnly], drafts, {
      ...base,
      turn: "supplier",
    });
    expect(supplier.counts).toEqual({ all: 1, open: 1, draft: 0, late: 0 });
    expect(supplier.entries[0].rows).toHaveLength(3);
    const wellmix = listCards([parallel, customerOnly], drafts, {
      ...base,
      turn: "wellmix",
    });
    expect(wellmix.counts).toEqual({ all: 2, open: 1, draft: 1, late: 0 });
  });

  it("Reposição pelo tipo: sem rascunhos (são encomendas)", () => {
    const repo = entry([row({ number: 30, kind: "replenishment" })]);
    const out = listCards([repo, entry([row({ number: 31 })])], [draft(32)], {
      ...base,
      kind: "replenishment",
    });
    expect(out.counts).toEqual({ all: 1, open: 1, draft: 0, late: 0 });
  });
});
