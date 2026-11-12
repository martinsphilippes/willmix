import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Tabela fiscal carregada depois de fechar o booking (docs/BOOKING.md, "NCM do
 * item"): a análise do Superplan dos bookings fechados é refeita sozinha, só
 * onde o II ou o IPI de algum item mudou.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/booking-lots");
const fs = await import("@/lib/services/fiscal");
type User = import("@/lib/db").User;

let admin: User;

function tecCsv(glassIi = "18") {
  const rows = ["NCM;DESCRIÇÃO;TEC (%)"];
  for (let i = 0; i < 600; i++) rows.push(`${10000000 + i * 7};Item ${i};10`);
  rows.push(`7013.37.00;Outros objetos de vidro;${glassIi}`);
  return new TextEncoder().encode(rows.join("\n"));
}
function tipiCsv() {
  const rows = ["NCM;EX;DESCRIÇÃO;ALÍQUOTA (%)"];
  for (let i = 0; i < 600; i++) rows.push(`${10000000 + i * 7};;Item ${i};5`);
  rows.push("7013.37.00;;-- Outros;9,75");
  return new TextEncoder().encode(rows.join("\n"));
}

async function closedLot(number: number, ncm: string) {
  const store = getStore();
  const lot = await store.create("booking_lots", {
    number,
    status: "closed",
    supplierId: null,
    businessType: null,
    fileName: "b.xlsx",
    itemCount: 1,
  } as never);
  const item = await store.create("booking_items", {
    lotId: lot.id,
    factoryItemCode: `GL-${number}`,
    description: "Glass cup",
    price: 5,
    currency: "USD",
    masterCartonQty: 24,
    cbmPerCarton: 0.08,
    grossWeightPcKg: 0.4,
    ncm,
    analysis: null,
  } as never);
  // Análise feita antes de haver tabela fiscal: II e IPI contam 0.
  await svc.reanalyzeBookingLot(admin, lot.id, null);
  return { lot, item };
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("tabela fiscal carregada: refaz a análise dos bookings", () => {
  it("refaz só os bookings cujo II ou IPI mudou", async () => {
    const store = getStore();
    const glass = await closedLot(9001, "70133700");
    const other = await closedLot(9002, "99999999");
    const before = (await store.get("booking_items", glass.item.id))!.analysis!;
    expect(before.inputs?.ncmFound).toBe(false);
    const otherAt = (await store.get("booking_items", other.item.id))!.analysis!
      .at;

    await fs.importFiscalFile(admin, "tec", tecCsv(), "tec.csv", "upload");
    await fs.importFiscalFile(admin, "tipi", tipiCsv(), "tipi.csv", "upload");
    const r = await fs.refreshBookingAnalyses(null);
    expect(r).toMatchObject({ lots: 1, items: 1 });

    const after = (await store.get("booking_items", glass.item.id))!.analysis!;
    expect(after.inputs).toMatchObject({
      ncmFound: true,
      iiPct: 18,
      ipiPct: 9.75,
    });
    expect(after.byUserId).toBe("system");
    expect(after.at).not.toBe(before.at);
    // NCM fora da tabela: nada mudou, a análise fica como estava.
    expect(
      (await store.get("booking_items", other.item.id))!.analysis!.at,
    ).toBe(otherAt);

    // Carregar de novo a mesma tabela não refaz nada; mudar o II refaz.
    expect(await fs.refreshBookingAnalyses(null)).toMatchObject({ lots: 0 });
    await fs.importFiscalFile(admin, "tec", tecCsv("20"), "tec.csv", "upload");
    expect(await fs.refreshBookingAnalyses(admin)).toMatchObject({ lots: 1 });
    expect(
      (await store.get("booking_items", glass.item.id))!.analysis!.inputs
        ?.iiPct,
    ).toBe(20);
  });

  it("rascunho e cancelado ficam de fora", async () => {
    const store = getStore();
    const { lot, item } = await closedLot(9003, "70133700");
    await store.update("booking_lots", lot.id, { status: "cancelled" });
    await store.update("booking_items", item.id, {
      analysis: {
        ...(await store.get("booking_items", item.id))!.analysis!,
        inputs: null,
      },
    });
    expect(await fs.refreshBookingAnalyses(null)).toMatchObject({ lots: 0 });
  });
});
