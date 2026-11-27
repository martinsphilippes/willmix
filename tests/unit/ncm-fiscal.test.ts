import { describe, expect, it } from "vitest";
import {
  NCM_FISCAL_COLUMNS,
  ncmDigits,
  ncmFiscalFrom,
  ncmFiscalNote,
  ncmFiscalQuery,
  wellmixSku,
} from "@/lib/ncm-fiscal";

/*
 * Campos fiscais pelo NCM (dono, 27/11/2026; docs/PRODUCT_REGISTRATION.md,
 * seção "Campos fiscais pelo NCM"): por coluna, o valor da maioria dos
 * produtos do Sankhya com o mesmo NCM (empate: o mais recente), os ativos
 * primeiro. E o SKU da Wellmix: "WX" + CODPROD.
 */
describe("campos fiscais pelo NCM", () => {
  it("o NCM só com os 8 dígitos", () => {
    expect(ncmDigits("7009.92.00")).toBe("70099200");
    expect(ncmDigits("70099200")).toBe("70099200");
    expect(ncmDigits("7009.92")).toBeNull();
    expect(ncmDigits(null)).toBeNull();
  });

  it("a consulta só leva o NCM limpo e as colunas da lista", () => {
    const sql = ncmFiscalQuery("7009.92.00", ["CSTIPIENT", "DROP TABLE X"]);
    expect(sql).toBe(
      "SELECT TOP 300 CODPROD, ATIVO, CSTIPIENT FROM TGFPRO WHERE NCM IN ('70099200', '7009.92.00') ORDER BY CODPROD DESC",
    );
    expect(() => ncmFiscalQuery("7009'; --")).toThrow();
    expect(() => ncmFiscalQuery("70099200", ["XPTO"])).toThrow();
    // Origem, "Usado como" e a exceção da TIPI dependem do item, não do NCM.
    expect(NCM_FISCAL_COLUMNS).toContain("CSTIPIENT");
    expect(NCM_FISCAL_COLUMNS).not.toContain("ORIGPROD");
    expect(NCM_FISCAL_COLUMNS).not.toContain("USOPROD");
    expect(NCM_FISCAL_COLUMNS).not.toContain("CODEXNCM");
  });

  it("por coluna, a maioria; empate, o mais recente; vazio não conta", () => {
    const fiscal = ncmFiscalFrom(
      "70099200",
      [
        {
          codprod: 10,
          ativo: "S",
          cstipient: 0,
          grupopis: "A",
          perccmtnac: 13.45,
        },
        {
          CODPROD: 30,
          ATIVO: "S",
          CSTIPIENT: 0,
          GRUPOPIS: "B",
          PERCCMTNAC: " ",
        },
        { CODPROD: 20, ATIVO: "S", CSTIPIENT: 49, GRUPOPIS: null },
        { CODPROD: 40, ATIVO: "N", CSTIPIENT: 3, GRUPOPIS: "C" },
      ],
      ["CSTIPIENT", "GRUPOPIS", "PERCCMTNAC", "CSTIPISAI"],
    );
    expect(fiscal).toEqual({
      ncm: "70099200",
      products: 3,
      inactiveOnly: false,
      values: { CSTIPIENT: "0", GRUPOPIS: "B", PERCCMTNAC: "13.45" },
      counts: { CSTIPIENT: 2, GRUPOPIS: 1, PERCCMTNAC: 1 },
    });
  });

  it("sem ativo, valem os inativos; sem nenhum, nada vai", () => {
    const inactive = ncmFiscalFrom("70099200", [
      { CODPROD: 5, ATIVO: "N", CSTIPIENT: 3 },
    ]);
    expect(inactive).toMatchObject({
      products: 1,
      inactiveOnly: true,
      values: { CSTIPIENT: "3" },
    });
    const none = ncmFiscalFrom("70099200", []);
    expect(none).toMatchObject({ products: 0, values: {} });
    expect(ncmFiscalNote(none, "70099200")).toBe(
      "nenhum produto com o NCM 70099200 no Sankhya: campos fiscais só pelos valores fixos",
    );
    expect(ncmFiscalNote(inactive, "70099200")).toBe(
      "fiscal do NCM 70099200 (1 produto(s), só inativos): CSTIPIENT=3",
    );
    expect(ncmFiscalNote(null, null)).toContain("sem NCM");
  });

  it("o SKU da Wellmix é WX + CODPROD", () => {
    expect(wellmixSku(25253)).toBe("WX25253");
    expect(wellmixSku(" 31001 ")).toBe("WX31001");
  });
});
