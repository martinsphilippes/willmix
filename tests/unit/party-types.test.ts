import { describe, expect, it } from "vitest";
import {
  OTHER_PARTY_TYPES,
  PARTY_TYPE_SCREEN,
  canonicalPartyType,
  isOtherPartyType,
} from "@/lib/party-types";

describe("Outros parceiros", () => {
  it("clientes e fornecedores ficam de fora: têm telas próprias", () => {
    expect(OTHER_PARTY_TYPES).not.toContain("customer");
    expect(OTHER_PARTY_TYPES).not.toContain("supplier");
    expect(PARTY_TYPE_SCREEN).toEqual({
      customer: "/app/customers",
      supplier: "/app/suppliers",
    });
  });

  it("os demais tipos continuam listados", () => {
    expect([...OTHER_PARTY_TYPES]).toEqual([
      "trading",
      "factory",
      "gp",
      "agency",
      "broker",
      "shipping_line",
      "carrier",
      "legal",
      "comex",
      "logistics",
      "ocp",
      "marketing_agency",
    ]);
    expect(isOtherPartyType("agency")).toBe(true);
    expect(isOtherPartyType("supplier")).toBe(false);
    expect(isOtherPartyType("qualquer")).toBe(false);
    // Tipo criado no painel (docs/PARTNER_TYPES.md) também fica na tela.
    expect(isOtherPartyType("partner")).toBe(true);
  });
});

describe("Supplier/Trading (dono, 26/11/2026)", () => {
  it("Supplier e Trading são um tipo só: a chave antiga vale como trading", () => {
    expect(OTHER_PARTY_TYPES).not.toContain("supplier_partner");
    expect(canonicalPartyType("supplier_partner")).toBe("trading");
    expect(canonicalPartyType("trading")).toBe("trading");
    expect(canonicalPartyType("agency")).toBe("agency");
    // O cadastro antigo continua em Outros parceiros.
    expect(isOtherPartyType("supplier_partner")).toBe(true);
  });
});
