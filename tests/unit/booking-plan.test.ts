import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Booking (docs/BOOKING.md), "Quantidade planejada e previsão de vendas": a
 * quantidade planejada vem da planilha (coluna "TT PCS", somada nas cores do
 * produto), a previsão por canal é digitada, tudo pode ser mudado na tabela
 * e a quantidade planejada entra na conta ao gerar a solicitação.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/product-sheet-import");
const { listBookingRows } = await import("@/lib/services/booking");
const { saveBookingProductEdits } =
  await import("@/lib/services/booking-product-edit");
const { ensureBookingForProduct } =
  await import("@/lib/services/booking-intake");
const { bookingRequestQuantity, forecastTotalOf } =
  await import("@/lib/booking");
type User = import("@/lib/db").User;

let admin: User;
let lineId: string;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  lineId = (await getStore().list("product_lines", { orderBy: "name" }))[0].id;
});

const HEADER = [
  "SKU",
  "SUPPLIER NAME",
  "SUPPLIER STORE NO",
  "DESCRIPTION",
  "PRICE USD",
  "QTY/BOX",
  "N.W PC",
  "CBM",
  "COLOR",
  "MOQ",
  "TT PCS",
];
const line = (sku: string, desc: string, color: string, total: string) => [
  sku,
  "Yiwu Plano",
  "P1-10",
  desc,
  "4",
  "12",
  "0.225",
  "0.0183",
  color,
  "1200",
  total,
];
const file = (cells: string[][]) =>
  new File(
    [xlsxBytes([{ name: "SUPPLIER INFO", cells: [HEADER, ...cells] }])],
    "feira-plano.xlsx",
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );

const rowOf = async (productId: string) =>
  (await listBookingRows(admin)).rows.find((r) => r.productId === productId)!;

describe("quantidade planejada e previsão de vendas", () => {
  let withPlan: string;
  let withoutPlan: string;

  it("a planilha traz a quantidade planejada (TT PCS), somada nas cores do produto", async () => {
    const result = await svc.importProductSheet(
      admin,
      file([
        line("P-1", "PLAN", "White", "600"),
        line("P-1", "PLAN", "Gray", "600"),
        line("P-1", "PLAN", "Bege", "1200"),
        line("P-2", "NOPLAN", "Black", ""),
      ]),
      { lineId, namePrefix: "Quadro", mode: "booking" },
    );
    [withPlan, withoutPlan] = result.results.map((r) => r.productId!);
    const planned = await rowOf(withPlan);
    expect(planned.plannedQty).toBe(2400);
    expect(planned.forecastTotal).toBeNull();
    // Sem a coluna preenchida, fica vazio (nada inventado).
    expect((await rowOf(withoutPlan)).plannedQty).toBeNull();
  });

  it("todos os campos são digitáveis: planejada e previsão por canal, com a soma", async () => {
    const saved = await saveBookingProductEdits(admin, [
      {
        productId: withoutPlan,
        sheet: {},
        plan: {
          plannedQty: 3600,
          forecastOrder: 1000,
          forecastDistribution: 2000,
          forecastEcommerce: 500,
        },
      },
      { productId: withPlan, sheet: {}, plan: { forecastEcommerce: 300 } },
    ]);
    expect(saved).toBe(2);
    const typed = await rowOf(withoutPlan);
    expect([
      typed.plannedQty,
      typed.forecastOrder,
      typed.forecastDistribution,
      typed.forecastEcommerce,
      typed.forecastTotal,
    ]).toEqual([3600, 1000, 2000, 500, 3500]);
    // Mudar um campo não apaga os outros (a planejada da planilha fica).
    const kept = await rowOf(withPlan);
    expect([
      kept.plannedQty,
      kept.forecastEcommerce,
      kept.forecastTotal,
    ]).toEqual([2400, 300, 300]);
    // Apagar um campo.
    await saveBookingProductEdits(admin, [
      { productId: withoutPlan, sheet: {}, plan: { forecastOrder: null } },
    ]);
    expect((await rowOf(withoutPlan)).forecastTotal).toBe(2500);
    // O mesmo valor de novo não conta como mudança.
    expect(
      await saveBookingProductEdits(admin, [
        { productId: withPlan, sheet: {}, plan: { forecastEcommerce: 300 } },
      ]),
    ).toBe(0);
  });

  it("reimportar a planilha numa linha em Novo atualiza a planejada e mantém a previsão digitada", async () => {
    const { booking } = await ensureBookingForProduct(admin, {
      productId: withPlan,
      importBatchId: "lote-2",
      sourceFileName: "feira-plano-2.xlsx",
      sourceRows: "2-4",
      sourceOrder: 2,
      plannedQty: 4800,
    });
    expect(booking.plan).toEqual({ plannedQty: 4800, forecastEcommerce: 300 });
  });

  it("ao gerar a solicitação: digitada, reservada, planejada (se não ficar abaixo do mínimo), mínimo", () => {
    const q = (
      typed: number | null,
      reserved: number | null,
      planned: number | null,
      moq: number | null,
    ) =>
      bookingRequestQuantity({
        typed,
        reservedQty: reserved,
        plannedQty: planned,
        moq,
      });
    expect(q(5000, 3000, 2400, 1200)).toBe(5000);
    expect(q(null, 3000, 2400, 1200)).toBe(3000);
    expect(q(null, null, 2400, 1200)).toBe(2400);
    // Planejada abaixo do pedido mínimo não é usada: vale o mínimo.
    expect(q(null, null, 600, 1200)).toBe(1200);
    expect(q(null, null, null, 1200)).toBe(1200);
    expect(q(null, null, null, null)).toBeNull();
    expect(forecastTotalOf({})).toBeNull();
  });
});
