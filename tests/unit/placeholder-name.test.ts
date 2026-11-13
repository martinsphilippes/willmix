import { describe, expect, it } from "vitest";
import {
  assertRealProductName,
  isPlaceholderName,
  nameOfLabel,
  realName,
  titleOfLabel,
  titleWithName,
  withoutPlaceholder,
} from "@/lib/placeholder-name";
import { laneRequirements } from "@/lib/purchase-lanes";
import { requirementLabel, translator } from "@/i18n";

/*
 * "XPTO" e "Produto novo XPTO" são marcador de exemplo, não nome
 * (docs/PURCHASE_ORDER.md, "Nome de exemplo"): valem como nome ausente, e o
 * rótulo da tarefa fica só com o título, sem separador sobrando.
 */
describe("marcador de exemplo", () => {
  it("reconhece o marcador e não confunde nome real", () => {
    for (const v of [
      "XPTO",
      "xpto",
      " Produto novo XPTO ",
      "PRODUTO NOVO XPTO",
      "Produto XPTO",
      "Novo produto xpto",
    ])
      expect(isPlaceholderName(v)).toBe(true);
    for (const v of [
      "",
      null,
      undefined,
      "Produto novo",
      "Xpto Cargo",
      "Jarra XPTO 500 ml",
      "Produto genérico XPTO",
      "GRECIE",
    ])
      expect(isPlaceholderName(v)).toBe(false);
  });

  it("nome real, ou nulo quando falta ou é o marcador", () => {
    expect(realName("  Jarra de vidro ")).toBe("Jarra de vidro");
    expect(realName("Produto novo XPTO")).toBeNull();
    expect(realName("")).toBeNull();
    expect(realName(null)).toBeNull();
  });

  it("título com o nome real; só o título quando o nome falta", () => {
    expect(titleWithName("Arte", "Jarra de vidro")).toBe(
      "Arte · Jarra de vidro",
    );
    expect(titleWithName("Arte", "Produto novo XPTO")).toBe("Arte");
    expect(titleWithName("Faca (die cut)", null)).toBe("Faca (die cut)");
    expect(titleWithName("Faca (die cut)", "  ")).toBe("Faca (die cut)");
  });

  it("tira o marcador de textos montados, sem separador sobrando", () => {
    expect(withoutPlaceholder("Faca (die cut) · Produto novo XPTO")).toBe(
      "Faca (die cut)",
    );
    expect(
      withoutPlaceholder(
        "Faca (die cut) · Produto novo XPTO, Arte · Produto novo XPTO, Certificado (Inmetro) · Jarra",
      ),
    ).toBe("Faca (die cut), Arte, Certificado (Inmetro) · Jarra");
    expect(
      withoutPlaceholder(
        "Pedido de compra das solicitações ao fornecedor nº 3 (Produto novo XPTO)",
      ),
    ).toBe("Pedido de compra das solicitações ao fornecedor nº 3");
    expect(withoutPlaceholder("#16281 · Arte · XPTO")).toBe("#16281 · Arte");
    // Texto real fica como está, mesmo com a palavra no meio.
    expect(withoutPlaceholder("Arte · Jarra XPTO 500 ml")).toBe(
      "Arte · Jarra XPTO 500 ml",
    );
    expect(withoutPlaceholder("Faca (die cut) · Jarra")).toBe(
      "Faca (die cut) · Jarra",
    );
  });

  it("com o nome real, o marcador dá lugar a ele", () => {
    expect(
      withoutPlaceholder("Faca (die cut) · Produto novo XPTO", "Jarra"),
    ).toBe("Faca (die cut) · Jarra");
    expect(withoutPlaceholder("nº 3 (Produto novo XPTO)", "Jarra")).toBe(
      "nº 3 (Jarra)",
    );
  });

  it("título e produto de um rótulo gravado", () => {
    expect(titleOfLabel("Faca (die cut) · Produto novo XPTO")).toBe(
      "Faca (die cut)",
    );
    expect(nameOfLabel("Faca (die cut) · Produto novo XPTO")).toBe("");
    expect(nameOfLabel("Faca (die cut) · Jarra · azul")).toBe("Jarra · azul");
    expect(nameOfLabel("Faca (die cut)")).toBe("");
  });
});

describe("nome de exemplo não é aceito como nome de produto", () => {
  it("recusa o marcador e aceita nome real", () => {
    for (const v of ["XPTO", "Produto novo XPTO", "produto xpto"])
      expect(() => assertRealProductName(v)).toThrow(
        "product_name_placeholder",
      );
    for (const v of ["Jarra de vidro", "Xpto Cargo", "Jarra XPTO 500 ml"])
      expect(() => assertRealProductName(v)).not.toThrow();
  });
});

describe("tarefas das raias do pedido de compra", () => {
  const roles = { art: "operator", ocp: "operator" } as const;
  const labels = (name: string) =>
    laneRequirements([{ id: "i1", name }], roles).map((r) => r.label);

  it("produto com nome real: título e nome", () => {
    expect(labels("Jarra de vidro")).toContain(
      "Faca (die cut) · Jarra de vidro",
    );
  });

  it("nome ausente ou de exemplo: só o título, nas oito tarefas", () => {
    for (const name of ["Produto novo XPTO", "XPTO", "", "  "]) {
      const out = labels(name);
      expect(out).toHaveLength(8);
      expect(out).toEqual([
        "Faca (die cut)",
        "Foto em alta resolução",
        "MOQ confirmado (peças)",
        "Prazo de produção confirmado (dias)",
        "Arte",
        "Validação da arte pela Wellmix",
        "Certificado (Inmetro)",
        "Arte final com o selo",
      ]);
    }
  });

  it("rótulo antigo gravado com o marcador aparece só com o título", () => {
    const t = translator("pt");
    expect(
      requirementLabel(t, {
        key: "die_cut__i1",
        label: "Faca (die cut) · Produto novo XPTO",
      }),
    ).toBe("Faca (die cut)");
    expect(
      requirementLabel(t, {
        key: "die_cut__i1",
        label: "Faca (die cut) · Jarra de vidro",
      }),
    ).toBe("Faca (die cut) · Jarra de vidro");
  });
});
