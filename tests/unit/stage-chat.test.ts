import { describe, expect, it } from "vitest";
import { STAGE_PARTY_FIELD, stageChat } from "@/lib/stage-chat";

/*
 * Mensagem na linha de cada etapa do pedido: a Wellmix fala com a empresa
 * responsável (ou é levada a designar o parceiro); quem é de fora fala só com
 * a Wellmix (nunca direto com outra empresa).
 */

const order = {
  customerId: "cliente-joao",
  supplierId: "fornecedor-a",
  agencyId: "agencia-1",
  brokerId: null,
  shippingLineId: "cia-1",
  carrierId: null,
  comexId: null,
  logisticsId: null,
  ocpId: null,
};

describe("conversa da linha da etapa", () => {
  it("Wellmix: a empresa do papel responsável", () => {
    expect(stageChat(order, "supplier", true)).toEqual({
      kind: "party",
      partyId: "fornecedor-a",
    });
    expect(stageChat(order, "customer", true)).toEqual({
      kind: "party",
      partyId: "cliente-joao",
    });
    expect(stageChat(order, "agency", true)).toEqual({
      kind: "party",
      partyId: "agencia-1",
    });
    expect(stageChat(order, "shipping_line", true)).toEqual({
      kind: "party",
      partyId: "cia-1",
    });
  });

  it("Wellmix: parceiro ainda não designado leva a designar", () => {
    expect(stageChat(order, "broker", true)).toEqual({ kind: "unassigned" });
    expect(stageChat(order, "carrier", true)).toEqual({ kind: "unassigned" });
  });

  it("Wellmix responsável (ou sem papel): sem conversa", () => {
    expect(stageChat(order, "operator", true)).toBeNull();
    expect(stageChat(order, "admin", true)).toBeNull();
    expect(stageChat(order, null, true)).toBeNull();
    expect(stageChat(order, "legal", true)).toBeNull();
  });

  it("quem é de fora fala só com a Wellmix, qualquer que seja a etapa", () => {
    for (const role of ["supplier", "agency", "customer", "operator"] as const)
      expect(stageChat(order, role, false)).toEqual({ kind: "wellmix" });
  });

  it("todo papel de empresa tem o campo dele no pedido", () => {
    expect(Object.keys(STAGE_PARTY_FIELD).sort()).toEqual(
      [
        "agency",
        "broker",
        "carrier",
        "comex",
        "customer",
        "logistics",
        "ocp",
        "marketing_agency",
        "shipping_line",
        "supplier",
      ].sort(),
    );
  });
});
