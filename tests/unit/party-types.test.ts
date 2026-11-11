import { describe, expect, it } from "vitest";
import {
  OTHER_PARTY_TYPES,
  PARTY_TYPE_SCREEN,
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
      "supplier_partner",
      "gp",
      "agency",
      "broker",
      "shipping_line",
      "carrier",
      "legal",
      "comex",
      "logistics",
      "ocp",
    ]);
    expect(isOtherPartyType("agency")).toBe(true);
    expect(isOtherPartyType("supplier")).toBe(false);
    expect(isOtherPartyType("qualquer")).toBe(false);
    // Tipo criado no painel (docs/PARTNER_TYPES.md) também fica na tela.
    expect(isOtherPartyType("partner")).toBe(true);
  });
});
