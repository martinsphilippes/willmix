import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Condição de pagamento, início da produção e fatura no cadastro de quem pode
 * ser o fornecedor do pedido (docs/PARTNER_FAMILIES.md, decisão 1): Trading,
 * Supplier e Factory vencem a cotação de compra e viram o fornecedor, então
 * também gravam as três configurações. Os outros tipos continuam de fora.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { PARTY_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
const { getSettings } = await import("@/lib/settings");
const terms = await import("@/lib/services/supplier-terms");
const sig = await import("@/lib/services/order-signature");
const inv = await import("@/lib/services/supplier-invoice");
type User = import("@/lib/db").User;
type PartyType = import("@/lib/db/schema").PartyType;

let admin: User;
let operator: User;
const ids: Partial<Record<PartyType, string>> = {};

async function newParty(type: PartyType, name: string) {
  const party = await getStore().create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    type,
    name,
    country: "CN",
    email: null,
    phone: null,
    taxId: null,
    notes: null,
    active: true,
    city: null,
    contactName: null,
    wechat: null,
    operationMode: null,
    radar: null,
  });
  return party.id;
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  ids.trading = await newParty("trading", "Trading Ningbo");
  ids.supplier_partner = await newParty("supplier_partner", "Supplier Yiwu");
  ids.factory = await newParty("factory", "Factory Shantou");
  ids.agency = await newParty("agency", "Agente Guangzhou");
});

const ORDER_SUPPLIERS = ["trading", "supplier_partner", "factory"] as const;
const terms40x60 = [
  { percent: 40, base: "shipped" as const, days: 30 },
  { percent: 60, base: "delivered" as const, days: 120 },
];

describe("Trading, Supplier e Factory: as três configurações do fornecedor", () => {
  it.each(ORDER_SUPPLIERS)("%s grava a condição de pagamento", async (type) => {
    const saved = await terms.saveSupplierPaymentTerms(operator, ids[type]!, {
      terms: terms40x60,
      note: null,
    });
    expect(saved.paymentTerms).toEqual(terms40x60);
  });

  it.each(ORDER_SUPPLIERS)(
    "%s grava o início da produção e a fatura (só o administrador)",
    async (type) => {
      const id = ids[type]!;
      await expect(
        sig.setSupplierProductionStartDays(operator, id, 5),
      ).rejects.toThrow();
      await expect(
        inv.setSupplierInvoiceDays(operator, id, 20),
      ).rejects.toThrow();

      await sig.setSupplierProductionStartDays(admin, id, 5);
      await inv.setSupplierInvoiceDays(admin, id, 20);
      const settings = await getSettings();
      expect(settings.productionStartDaysBySupplier?.[id]).toBe(5);
      expect(await inv.invoiceDaysFor(id)).toBe(20);

      // Vazio volta ao padrão das Configurações.
      await sig.setSupplierProductionStartDays(admin, id, null);
      await inv.setSupplierInvoiceDays(admin, id, null);
      const cleared = await getSettings();
      expect(cleared.productionStartDaysBySupplier?.[id]).toBeUndefined();
      expect(await inv.invoiceDaysFor(id)).toBe(cleared.invoiceDays);
    },
  );

  it("quem não pode ser o fornecedor do pedido continua de fora", async () => {
    for (const id of [ids.agency!, "cliente-joao"]) {
      await expect(
        terms.saveSupplierPaymentTerms(admin, id, {
          terms: terms40x60,
          note: null,
        }),
      ).rejects.toThrow("not_supplier");
      await expect(
        sig.setSupplierProductionStartDays(admin, id, 5),
      ).rejects.toThrow("order_not_found");
      await expect(inv.setSupplierInvoiceDays(admin, id, 20)).rejects.toThrow(
        "not_supplier",
      );
    }
  });
});
