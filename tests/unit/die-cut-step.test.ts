import { describe, expect, it } from "vitest";
import {
  dieCutHref,
  dieCutItemOf,
  dieCutProducts,
  formatTermsNumber,
  parseLeadTime,
  parseMoq,
} from "@/lib/die-cut-step";
import { translator } from "@/i18n";
import { errorTextFor } from "@/i18n/error-text";
import {
  baseKeyOf,
  isLeadTimeKey,
  laneRequirements,
  supplierSeesLaneRequirement,
} from "@/lib/purchase-lanes";

/*
 * Quadro Die Cut do pedido de compra: os quatro itens do fornecedor, produto
 * a produto (regras puras).
 */
const req = (key: string, label: string, status = "pending") => ({
  key,
  label,
  status: status as "pending" | "done" | "rejected",
});

describe("die cut", () => {
  it("reconhece os quatro itens e ignora os outros requisitos", () => {
    expect(dieCutItemOf("die_cut__a")).toBe("dieline");
    expect(dieCutItemOf("hd_photo__a")).toBe("hd");
    expect(dieCutItemOf("moq_confirmed__a")).toBe("moq");
    expect(dieCutItemOf("lead_time_confirmed__a")).toBe("leadTime");
    expect(dieCutItemOf("art__a")).toBeNull();
    expect(dieCutItemOf("die_cut")).toBeNull();
    expect(dieCutItemOf("purchase_sheet")).toBeNull();
  });

  it("junta por produto e diz o que falta, na ordem do quadro", () => {
    const products = dieCutProducts([
      req("die_cut__a", "Faca (die cut) · Copo · azul", "done"),
      req("hd_photo__a", "Foto em alta resolução · Copo · azul"),
      req("moq_confirmed__a", "MOQ confirmado (peças) · Copo · azul", "done"),
      req("lead_time_confirmed__a", "Prazo · Copo · azul"),
      req("art__a", "Arte · Copo · azul"),
      req("die_cut__b", "Faca (die cut) · Jarra", "done"),
      req("hd_photo__b", "Foto em alta resolução · Jarra", "done"),
      req("moq_confirmed__b", "MOQ · Jarra", "done"),
      req("lead_time_confirmed__b", "Prazo · Jarra", "done"),
    ]);
    expect(products.map((p) => p.itemId)).toEqual(["a", "b"]);
    expect(products[0]).toMatchObject({
      name: "Copo · azul",
      missing: ["hd", "leadTime"],
      complete: false,
    });
    expect(products[1]).toMatchObject({ name: "Jarra", complete: true });
    expect(dieCutProducts([req("art__a", "Arte · Copo")])).toEqual([]);
  });

  it("monta o endereço do quadro e valida os números", () => {
    expect(dieCutHref("o1")).toBe("/app/orders/o1/die-cut");
    expect(dieCutHref("o1", "i1")).toBe("/app/orders/o1/die-cut#item-i1");
    expect(parseMoq(" 1000 ")).toBe(1000);
    expect(parseMoq("0")).toBeNull();
    expect(parseMoq("1.5")).toBeNull();
    expect(parseMoq("abc")).toBeNull();
    expect(parseLeadTime("45")).toBe(45);
    expect(parseLeadTime("0")).toBeNull();
    expect(parseLeadTime("721")).toBeNull();
  });
});

/*
 * Visão do fornecedor na etapa "Preparação, arte e certificação" (pedido do
 * dono, 13/11/2026): só a faca, a foto em alta e o prazo de cada produto. O
 * resto continua existindo e valendo (a Wellmix vê tudo).
 */
describe("visão do fornecedor na Preparação", () => {
  const items = [
    { id: "a", name: "Copo" },
    { id: "b", name: "Jarra" },
  ];

  it("mostra por produto só a faca, a foto em alta e o prazo", () => {
    const all = laneRequirements(items, { art: "agency", ocp: "ocp" });
    expect(all.filter(supplierSeesLaneRequirement).map((r) => r.key)).toEqual([
      "die_cut__a",
      "hd_photo__a",
      "lead_time_confirmed__a",
      "die_cut__b",
      "hd_photo__b",
      "lead_time_confirmed__b",
    ]);
    // O que ele não vê: o cadastro (NCM e ficha, da Wellmix), MOQ, arte,
    // validação, certificado e arte final, que continuam obrigatórios (nada
    // some do pedido).
    const hidden = all.filter((r) => !supplierSeesLaneRequirement(r));
    expect([...new Set(hidden.map((r) => baseKeyOf(r.key)))]).toEqual([
      "ncm_validated",
      "sheet_complete",
      "moq_confirmed",
      "art",
      "art_review",
      "certificate",
      "art_final",
    ]);
    expect(hidden.every((r) => r.required)).toBe(true);
    // Arte feita pela Wellmix e pedido sem certificadora: a mesma visão.
    const internal = laneRequirements(items, {
      art: "operator",
      ocp: "operator",
    });
    expect(internal.filter(supplierSeesLaneRequirement)).toHaveLength(6);
  });

  it("item a mais da linha do produto (ex.: NCM) não aparece para ele", () => {
    const all = laneRequirements(
      [
        {
          id: "a",
          name: "Copo",
          lineRequirements: [
            {
              key: "ncm",
              label: "NCM",
              type: "text",
              required: true,
              role: "supplier",
            },
            {
              key: "pantone",
              label: "Pantone",
              type: "text",
              required: true,
              role: "supplier",
            },
          ],
        },
      ],
      { art: "agency", ocp: "ocp" },
    );
    // Continuam na etapa; só saem da visão dele.
    expect(all.map((r) => r.key)).toContain("ncm__a");
    expect(all.filter(supplierSeesLaneRequirement).map((r) => r.key)).toEqual([
      "die_cut__a",
      "hd_photo__a",
      "lead_time_confirmed__a",
    ]);
    // Requisito sem item do pedido (fluxo antigo) também não entra.
    expect(supplierSeesLaneRequirement({ key: "lead_time_confirmed" })).toBe(
      false,
    );
  });

  it("reconhece o prazo de produção de um item", () => {
    expect(isLeadTimeKey("lead_time_confirmed__a")).toBe(true);
    expect(isLeadTimeKey("lead_time_confirmed")).toBe(false);
    expect(isLeadTimeKey("moq_confirmed__a")).toBe(false);
  });
});

describe("resumo do pedido mínimo e do prazo (confirmado)", () => {
  it("mostra os números no formato do idioma", () => {
    expect(formatTermsNumber("132000", "pt-BR")).toBe("132.000");
    expect(formatTermsNumber(132000, "en-US")).toBe("132,000");
    expect(formatTermsNumber("15", "pt-BR")).toBe("15");
    // O exemplo do dono, com o texto do resumo.
    const t = translator("pt");
    expect(
      t("dieCut.terms.values", {
        moq: formatTermsNumber("132000", t.intl),
        days: formatTermsNumber("15", t.intl),
      }),
    ).toBe("132.000 peças · 15 dias");
  });

  it("sem valor, um traço", () => {
    expect(formatTermsNumber(null, "pt-BR")).toBe("—");
    expect(formatTermsNumber(undefined, "pt-BR")).toBe("—");
    expect(formatTermsNumber("", "pt-BR")).toBe("—");
  });

  it("o erro vem do quadro, depois do pedido, senão o texto padrão", () => {
    const t = translator("pt");
    const prefixes = ["dieCut.error", "orders.error"];
    expect(errorTextFor(t, "invalid_moq", prefixes)).toBe(
      t("dieCut.error.invalid_moq"),
    );
    expect(errorTextFor(t, "date_invalid", prefixes)).toBe(
      t("orders.error.date_invalid"),
    );
    expect(errorTextFor(t, "codigo_novo", prefixes)).toBe(
      `${t("common.error")} (codigo_novo)`,
    );
    expect(errorTextFor(t, "unexpected", prefixes)).toBe(
      t("common.unexpected"),
    );
  });
});
