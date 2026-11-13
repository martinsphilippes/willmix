import { describe, expect, it } from "vitest";
import {
  dieCutHref,
  dieCutItemOf,
  dieCutProducts,
  parseLeadTime,
  parseMoq,
} from "@/lib/die-cut-step";

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
