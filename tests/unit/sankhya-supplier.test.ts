import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import {
  findSankhyaSupplier,
  isSankhyaSupplierType,
  sankhyaSuppliersByCode,
} from "@/lib/sankhya-supplier";

/*
 * Fornecedor do Sankhya pelo código, de qualquer tipo que vale como
 * fornecedor (Fornecedor, Trading, Supplier, Factory). A NINGBO HOME-IN foi
 * trocada para Trading no portal e a carga seguinte criou outro Fornecedor
 * com o mesmo código (mesclados pelo dono em 26/11/2026).
 */
withTempStore();

const { getStore, PARTY_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { importContext, upsertParty } =
  await import("@/lib/integrations/sankhya-import");
type User = import("@/lib/db").User;

let admin: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("regras puras", () => {
  const parties = [
    { id: "t", type: "trading" as const, sankhyaCode: "62387" },
    { id: "c", type: "customer" as const, sankhyaCode: "62387" },
    { id: "s", type: "supplier" as const, sankhyaCode: "54134" },
    { id: "t2", type: "trading" as const, sankhyaCode: "54134" },
    { id: "f", type: "factory" as const, sankhyaCode: "0099" },
  ];

  it("os tipos que valem como fornecedor", () => {
    for (const t of ["supplier", "trading", "supplier_partner", "factory"])
      expect(isSankhyaSupplierType(t)).toBe(true);
    for (const t of ["customer", "gp", "carrier", null])
      expect(isSankhyaSupplierType(t)).toBe(false);
  });

  it("acha o Trading do código e nunca o cliente", () => {
    expect(findSankhyaSupplier(parties, "62387")?.id).toBe("t");
    expect(findSankhyaSupplier(parties, "1")).toBeUndefined();
  });

  it("com dois cadastros no código, o Fornecedor vence", () => {
    expect(findSankhyaSupplier(parties, "54134")?.id).toBe("s");
    const map = sankhyaSuppliersByCode(parties, (c) => String(Number(c)));
    expect(map.get("54134")?.id).toBe("s");
    expect(map.get("62387")?.id).toBe("t");
    expect(map.get("99")?.id).toBe("f");
  });
});

describe("carga do Sankhya", () => {
  it("atualiza o Supplier do código em vez de criar outro Fornecedor", async () => {
    const store = getStore();
    const kept = await store.create("parties", {
      ...PARTY_EXTRA_DEFAULTS,
      type: "supplier_partner",
      name: "NINGBO TESTE",
      country: "CHINA",
      email: null,
      phone: null,
      taxId: null,
      notes: null,
      sankhyaCode: "62387",
      active: true,
    });
    const party = await upsertParty(
      await importContext(admin, true),
      "partners",
      "62387",
      {
        type: "supplier",
        name: "NINGBO TESTE CO., LTD",
        taxId: null,
        sankhyaRefs: { CODPARC: 62387 },
        active: true,
      },
    );
    expect(party.id).toBe(kept.id);
    expect(party.type).toBe("supplier_partner");
    expect(party.name).toBe("NINGBO TESTE CO., LTD");
    const same = (await store.list("parties")).filter(
      (p) => p.sankhyaCode === "62387",
    );
    expect(same).toHaveLength(1);
  });
});
