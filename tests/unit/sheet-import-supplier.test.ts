import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Importar a ficha técnica com o fornecedor escolhido no formulário: cada
 * Booking que sobe fica ligado a esse fornecedor (o principal de cada
 * produto), qualquer que seja o nome escrito na planilha; nenhum fornecedor
 * novo é cadastrado; fornecedor que não existe ou está inativo é recusado.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/product-sheet-import");
const { listBookingRows } = await import("@/lib/services/booking");
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
];
const sheet = (rows: Array<[sku: string, supplier: string, desc: string]>) =>
  new File(
    [
      xlsxBytes([
        {
          name: "SUPPLIER INFO",
          cells: [
            HEADER,
            ...rows.map(([sku, supplier, desc]) => [
              sku,
              supplier,
              "Z9-999",
              desc,
              "4",
              "12",
              "0.225",
              "0.0183",
              "White",
              "1200",
            ]),
          ],
        },
      ]),
    ],
    "feira.xlsx",
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );

const suppliers = () =>
  getStore().list("parties", { filter: { type: "supplier" } });

describe("fornecedor escolhido ao importar a ficha", () => {
  it("liga todos os produtos e as linhas do Booking ao fornecedor escolhido, sem cadastrar o da planilha", async () => {
    const before = (await suppliers()).length;
    const result = await svc.importProductSheet(
      admin,
      sheet([
        ["S-1", "Loja Que Nao Existe", "VASE"],
        ["S-2", "Outra Loja Qualquer", "CUP"],
      ]),
      { lineId, mode: "booking", supplierId: "fornecedor-a" },
    );
    expect(result.summary).toMatchObject({
      created: 2,
      errors: 0,
      suppliersCreated: 0,
      bookingCreated: 2,
    });
    expect((await suppliers()).length).toBe(before);
    const ids = result.results.map((r) => r.productId!);
    for (const id of ids)
      expect((await getStore().get("products", id))?.supplierId).toBe(
        "fornecedor-a",
      );
    // A coluna Fornecedor do Booking vem preenchida sozinha.
    const rows = (await listBookingRows(admin, {})).rows.filter((r) =>
      ids.includes(r.productId),
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.supplierId === "fornecedor-a")).toBe(true);
    // O lote guarda o fornecedor (reimportar pelo arquivo guardado o mantém).
    const batch = await getStore().get("import_batches", result.batchId);
    expect(batch?.mapping?.__supplierId).toBe("fornecedor-a");
  });

  it("sem fornecedor escolhido, vale o nome da planilha (como antes)", async () => {
    const before = (await suppliers()).length;
    const result = await svc.importProductSheet(
      admin,
      sheet([["S-9", "Loja Nova Da Planilha", "BOWL"]]),
      { lineId, mode: "products" },
    );
    expect(result.summary.suppliersCreated).toBe(1);
    expect((await suppliers()).length).toBe(before + 1);
  });

  it("recusa fornecedor que não existe, que não é fornecedor ou está inativo", async () => {
    const refuse = async (supplierId: string) => {
      try {
        await svc.importProductSheet(admin, sheet([["S-5", "X", "TRAY"]]), {
          lineId,
          mode: "booking",
          supplierId,
        });
      } catch (error) {
        return (error as Error).message;
      }
      return "ok";
    };
    expect(await refuse("nao-existe")).toBe("supplier_invalid");
    expect(await refuse("cliente-joao")).toBe("supplier_invalid");
    await getStore().update("parties", "fornecedor-b", { active: false });
    expect(await refuse("fornecedor-b")).toBe("supplier_invalid");
  });
});
