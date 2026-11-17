import { describe, expect, it } from "vitest";
import {
  NO_COUNTRY,
  activeFilterCount,
  applyPartnerFilters,
  parsePartnerFilters,
  partnerFilterOptions,
  partnerListHref,
  type PartnerRow,
} from "@/lib/partners-list";

/*
 * Equipe Externa (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md): filtro em cada
 * coluna (Nome | Tipo | Situação | Login de Acesso | País | E-mail), opções
 * tiradas dos dados e o endereço que guarda os filtros.
 */
const row = (over: Partial<PartnerRow<null>>): PartnerRow<null> => ({
  party: null,
  id: over.id ?? "p1",
  name: "Shenzhen Supplier A",
  typeValue: "supplier",
  typeLabel: "Fornecedor",
  active: true,
  logins: 1,
  inactiveLogins: 0,
  country: "China",
  email: "sales@shenzhen.com",
  loginIds: [],
  ...over,
});

const rows = [
  row({ id: "a" }),
  row({
    id: "b",
    name: "Trading Ningbo",
    typeValue: "trading",
    typeLabel: "Trading",
    logins: 3,
    email: "",
  }),
  row({
    id: "c",
    name: "Agência Criativa",
    typeValue: "agency",
    typeLabel: "Agência",
    active: false,
    logins: 0,
    country: "",
    email: "arte@criativa.com.br",
  }),
  row({
    id: "d",
    name: "Despachante Santos",
    typeValue: "broker",
    typeLabel: "Despachante",
    logins: 0,
    country: "Brasil",
    email: "op@santos.com",
  }),
];

const filtersOf = (sp: Record<string, string>) => parsePartnerFilters(sp);
const ids = (list: PartnerRow<null>[]) => list.map((r) => r.id);

describe("Equipe Externa: filtros por coluna", () => {
  it("lê os filtros do endereço e ignora valores inválidos", () => {
    const f = filtersOf({
      q: "  ningbo ",
      name: "trad",
      status: "talvez",
      logins: "abc",
      country: "China",
    });
    expect(f.q).toBe("ningbo");
    expect(f.name).toBe("trad");
    expect(f.status).toBe("");
    expect(f.logins).toBe("");
    expect(f.country).toBe("China");
    expect(filtersOf({ logins: "02" }).logins).toBe("2");
    expect(filtersOf({ status: "inactive" }).status).toBe("inactive");
    expect(filtersOf({ q: "x".repeat(300) }).q).toHaveLength(120);
  });

  it("cada coluna filtra sozinha", () => {
    expect(
      ids(applyPartnerFilters(rows, filtersOf({ name: "ningbo" }))),
    ).toEqual(["b"]);
    // Sem acento nem caixa, como a busca do portal.
    expect(
      ids(applyPartnerFilters(rows, filtersOf({ name: "AGENCIA" }))),
    ).toEqual(["c"]);
    expect(
      ids(applyPartnerFilters(rows, filtersOf({ type: "broker" }))),
    ).toEqual(["d"]);
    expect(
      ids(applyPartnerFilters(rows, filtersOf({ status: "inactive" }))),
    ).toEqual(["c"]);
    expect(
      ids(applyPartnerFilters(rows, filtersOf({ status: "active" }))),
    ).toEqual(["a", "b", "d"]);
    expect(ids(applyPartnerFilters(rows, filtersOf({ logins: "0" })))).toEqual([
      "c",
      "d",
    ]);
    expect(ids(applyPartnerFilters(rows, filtersOf({ logins: "3" })))).toEqual([
      "b",
    ]);
    expect(
      ids(applyPartnerFilters(rows, filtersOf({ country: "Brasil" }))),
    ).toEqual(["d"]);
    expect(
      ids(applyPartnerFilters(rows, filtersOf({ country: NO_COUNTRY }))),
    ).toEqual(["c"]);
    expect(
      ids(applyPartnerFilters(rows, filtersOf({ email: "santos" }))),
    ).toEqual(["d"]);
  });

  it("filtros combinados valem juntos", () => {
    expect(
      ids(
        applyPartnerFilters(rows, filtersOf({ status: "active", logins: "0" })),
      ),
    ).toEqual(["d"]);
    expect(
      ids(
        applyPartnerFilters(rows, filtersOf({ country: "China", logins: "1" })),
      ),
    ).toEqual(["a"]);
    expect(
      applyPartnerFilters(
        rows,
        filtersOf({ country: "China", type: "broker" }),
      ),
    ).toEqual([]);
  });

  it("as opções vêm dos dados: situações, logins e países existentes", () => {
    const options = partnerFilterOptions(rows);
    expect(options.statuses).toEqual(["active", "inactive"]);
    expect(options.logins).toEqual([0, 1, 3]);
    expect(options.countries).toEqual(["Brasil", "China"]);
    expect(options.noCountry).toBe(true);
    const onlyActive = partnerFilterOptions(rows.filter((r) => r.active));
    expect(onlyActive.statuses).toEqual(["active"]);
    expect(onlyActive.noCountry).toBe(false);
  });

  it("conta os filtros em uso (para mostrar Limpar filtros)", () => {
    expect(activeFilterCount(filtersOf({}))).toBe(0);
    expect(activeFilterCount(filtersOf({ q: "x", type: "trading" }))).toBe(2);
  });

  it("o endereço guarda a busca, os filtros, a ordem, a página e o painel", () => {
    const f = filtersOf({ q: "ningbo", type: "trading", country: "China" });
    expect(partnerListHref(f)).toBe(
      "/app/parties?q=ningbo&type=trading&country=China",
    );
    expect(
      partnerListHref(f, {
        sort: "-name",
        page: "2",
        panel: "logins",
        party: "b",
      }),
    ).toBe(
      "/app/parties?q=ningbo&type=trading&country=China&sort=-name&page=2&panel=logins&party=b",
    );
    // Valor vazio sai do endereço.
    expect(partnerListHref(filtersOf({}), { sort: null, page: "" })).toBe(
      "/app/parties",
    );
  });
});
