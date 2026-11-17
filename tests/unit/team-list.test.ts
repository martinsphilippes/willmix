import { describe, expect, it } from "vitest";
import {
  TEAM_NONE,
  activeTeamFilterCount,
  applyTeamFilters,
  legacyTeamHash,
  parseTeamFilters,
  teamFilterOptions,
  teamListHref,
  type TeamRow,
} from "@/lib/team-list";
import {
  directReports,
  levelInversions,
  managerChain,
} from "@/lib/team-hierarchy";

/*
 * Equipe Interna (docs/EQUIPE_ACESSOS.md, etapa 5): filtros por coluna, busca,
 * endereço com o painel aberto, os "#" antigos e a hierarquia pelo
 * "Responde a" (cadeia, subordinados e o aviso de nível).
 */

const row = (over: Partial<TeamRow>): TeamRow => ({
  id: "x",
  name: "X",
  login: "x@wellmix.com",
  positionId: null,
  positionName: "",
  areaId: null,
  areaName: "",
  functions: [],
  managerId: null,
  managerName: "",
  screens: 5,
  review: null,
  ...over,
});

const rows: TeamRow[] = [
  row({
    id: "camila",
    name: "Camila Rocha",
    login: "camila@wellmix.com",
    positionId: "p-analista",
    positionName: "Analista de Compras",
    areaId: "a-compras",
    areaName: "Compras",
    functions: [{ key: "buyer", label: "Comprador" }],
    managerId: "marcos",
    managerName: "Marcos Lima",
  }),
  row({
    id: "paula",
    name: "Paula Dias",
    login: "paula",
    positionId: "p-designer",
    positionName: "Designer",
    areaId: "a-marketing",
    areaName: "Marketing",
    functions: [
      { key: "designer", label: "Designer" },
      { key: "buyer", label: "Comprador" },
    ],
    managerId: "marcos",
    managerName: "Marcos Lima",
    review: "Cargo a conferir",
  }),
  row({ id: "marcos", name: "Marcos Lima", login: "marcos@wellmix.com" }),
];

describe("filtros da Equipe Interna", () => {
  it("lê o endereço e conta os filtros em uso", () => {
    const f = parseTeamFilters({
      q: " rocha ",
      position: "p-analista",
      review: "1",
      area: ["a", "b"],
    });
    expect(f).toMatchObject({
      q: "rocha",
      position: "p-analista",
      area: "",
      review: true,
    });
    expect(activeTeamFilterCount(f)).toBe(3);
    expect(activeTeamFilterCount(parseTeamFilters({}))).toBe(0);
  });

  it("cada coluna filtra, com a opção vazia (—)", () => {
    const base = parseTeamFilters({});
    const names = (patch: Record<string, string>) =>
      applyTeamFilters(rows, { ...base, ...patch }).map((r) => r.id);
    expect(names({ name: "paula" })).toEqual(["paula"]);
    // O nome acha também pelo login.
    expect(names({ name: "camila@" })).toEqual(["camila"]);
    expect(names({ position: "p-designer" })).toEqual(["paula"]);
    expect(names({ position: TEAM_NONE })).toEqual(["marcos"]);
    expect(names({ area: "a-compras" })).toEqual(["camila"]);
    expect(names({ area: TEAM_NONE })).toEqual(["marcos"]);
    // Várias funções: qualquer uma delas.
    expect(names({ function: "buyer" })).toEqual(["camila", "paula"]);
    expect(names({ function: TEAM_NONE })).toEqual(["marcos"]);
    expect(names({ manager: "marcos" })).toEqual(["camila", "paula"]);
    expect(names({ manager: TEAM_NONE })).toEqual(["marcos"]);
    // Filtros juntos.
    expect(names({ function: "buyer", area: "a-marketing" })).toEqual([
      "paula",
    ]);
    expect(
      applyTeamFilters(rows, { ...base, review: true }).map((r) => r.id),
    ).toEqual(["paula"]);
  });

  it("opções tiradas dos dados, por nome, e se há campo vazio", () => {
    const o = teamFilterOptions(rows);
    expect(o.positions.map((p) => p.label)).toEqual([
      "Analista de Compras",
      "Designer",
    ]);
    expect(o.functions.map((p) => p.value)).toEqual(["buyer", "designer"]);
    expect(o.managers).toEqual([{ value: "marcos", label: "Marcos Lima" }]);
    expect([o.noPosition, o.noArea, o.noFunction, o.noManager]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(teamFilterOptions(rows.slice(0, 2)).noManager).toBe(false);
  });

  it("o endereço guarda os filtros e o painel aberto", () => {
    const f = parseTeamFilters({ q: "ana", area: "a-compras", review: "1" });
    expect(teamListHref(f)).toBe("/app/team?q=ana&area=a-compras&review=1");
    expect(
      teamListHref(f, { sort: "-name", panel: "person", id: "camila" }),
    ).toBe(
      "/app/team?q=ana&area=a-compras&review=1&sort=-name&panel=person&id=camila",
    );
    expect(teamListHref(parseTeamFilters({}), { panel: null })).toBe(
      "/app/team",
    );
  });
});

describe("endereços antigos com #", () => {
  it("#u-<id> abre o painel da pessoa; #distribute vai para Linhas e divisões", () => {
    expect(legacyTeamHash("#u-camila", "?q=ana")).toBe(
      "/app/team?q=ana&panel=person&id=camila",
    );
    // Depois de salvar: só rola até a linha (o aviso aparece), sem reabrir.
    expect(legacyTeamHash("#u-camila", "?saved=member")).toBeNull();
    expect(legacyTeamHash("#distribute", "")).toBe(
      "/app/team?tab=lines#distribute",
    );
    // Na aba de linhas, a âncora já rola até a distribuição.
    expect(legacyTeamHash("#distribute", "?tab=lines")).toBeNull();
    // As âncoras das abas (área, cargo, linha) continuam rolando.
    expect(legacyTeamHash("#a-compras", "?tab=areas")).toBeNull();
    expect(legacyTeamHash("#u-camila", "?tab=areas")).toBeNull();
    expect(legacyTeamHash("#u-<script>", "")).toBeNull();
  });
});

describe("hierarquia pelo Responde a", () => {
  const team = [
    { id: "ana", name: "Ana", managerUserId: "bia", jobLevel: "coordinator" },
    { id: "bia", name: "Bia", managerUserId: "caio", jobLevel: "analyst" },
    { id: "caio", name: "Caio", managerUserId: null, jobLevel: "director" },
    { id: "dani", name: "Dani", managerUserId: "bia", jobLevel: null },
    { id: "eva", name: "Eva", managerUserId: "fora", jobLevel: null },
  ];

  it("cadeia de reporte até o topo e os subordinados diretos", () => {
    expect(managerChain("ana", team).chain.map((n) => n.id)).toEqual([
      "bia",
      "caio",
    ]);
    expect(managerChain("caio", team).chain).toEqual([]);
    expect(managerChain("eva", team)).toMatchObject({
      chain: [],
      missing: "fora",
    });
    expect(directReports("bia", team).map((n) => n.id)).toEqual([
      "ana",
      "dani",
    ]);
  });

  it("ciclo não trava a cadeia", () => {
    const loop = [
      { id: "a", name: "A", managerUserId: "b" },
      { id: "b", name: "B", managerUserId: "a" },
    ];
    expect(managerChain("a", loop)).toMatchObject({ cycle: true });
    expect(managerChain("a", loop).chain.map((n) => n.id)).toEqual(["b"]);
  });

  it("gestor com nível menor que o do subordinado: aviso", () => {
    expect(
      levelInversions(team).map((p) => `${p.manager.id}>${p.member.id}`),
    ).toEqual(["bia>ana"]);
  });
});
