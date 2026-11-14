import { describe, expect, it } from "vitest";
import {
  bookingLotPending,
  incompleteBookingItems,
  missingItemFields,
} from "@/lib/booking-lots";
import { pageOfIndex } from "@/lib/table-tools";

/*
 * Lista de pendências do fechamento do Book (pedido do dono, 14/11/2026):
 * os itens incompletos na ordem da tabela, identificados pelo nome e pelo
 * código (sem os dois, pela linha), com os campos que faltam. Sai da mesma
 * validação que trava "Fechar e analisar": nenhuma exigência nova, e a mesma
 * contagem do "Falta para fechar".
 */
type Item = Parameters<typeof incompleteBookingItems>[0][number];

const complete = {
  incoterm: "FOB",
  currency: "USD",
  price: 1.25,
  masterCartonQty: 48,
  innerQty: 12,
  netWeightPcKg: 0.3,
  grossWeightPcKg: 0.35,
  cbmPerCarton: 0.12,
  lengthCm: 10,
  widthCm: 8,
  heightCm: 20,
  capacityMl: 350,
  sizeText: null,
  packageType: "color box",
  material: "glass",
  moq: 1000,
  ncm: "7013.37.00",
};

const item = (position: number, extra: Record<string, unknown> = {}): Item =>
  ({
    id: `item-${position}`,
    position,
    itemNumber: null,
    factoryItemCode: null,
    productName: null,
    description: null,
    ...complete,
    ...extra,
  }) as unknown as Item;

describe("lista de pendências do fechamento do Book", () => {
  const items = [
    item(0, { productName: "Porta retrato", factoryItemCode: "E4-01" }),
    // Vários campos faltando no mesmo item.
    item(1, {
      productName: "Copo de vidro",
      factoryItemCode: "GL-02",
      price: null,
      cbmPerCarton: null,
      ncm: "",
    }),
    // Sem nome nem código: identificado pela linha.
    item(2, { heightCm: null }),
    // Só a descrição e o nº do item: viram nome e código.
    item(3, {
      description:
        "  Glass   jar with a very long description text that goes on and on forever  ",
      itemNumber: "17",
      material: " ",
    }),
    // Tamanho em texto vale como capacidade (a mesma regra do fechamento).
    item(4, { capacityMl: null, sizeText: "8X10", moq: null }),
  ];
  const pending = bookingLotPending(
    { supplierId: "s1", bookingDate: "2026-10-13" },
    items as never,
  );
  const list = incompleteBookingItems(items, pending);

  it("os mesmos itens e a mesma contagem da validação que trava o fechamento", () => {
    expect(list.map((i) => i.itemId)).toEqual([
      "item-1",
      "item-2",
      "item-3",
      "item-4",
    ]);
    expect(list).toHaveLength(pending.items.size);
    for (const entry of list) {
      const source = items.find((i) => i.id === entry.itemId)!;
      expect(entry.fields).toEqual(missingItemFields(source));
    }
  });

  it("todos os campos que faltam no mesmo item, na ordem da validação", () => {
    expect(list[0]).toEqual({
      itemId: "item-1",
      name: "Copo de vidro",
      code: "GL-02",
      line: 2,
      fields: ["price", "cbmPerCarton", "ncm"],
    });
    expect(list[3].fields).toEqual(["moq"]);
  });

  it("identifica pelo nome e pelo código; sem os dois, pela linha", () => {
    expect(list[1]).toMatchObject({ name: null, code: null, line: 3 });
    // Sem nome, a descrição (encurtada, sem espaços repetidos); sem código, o nº do item.
    expect(list[2].name).toBe(
      "Glass jar with a very long description text that goes on an…",
    );
    expect(list[2].name!.length).toBeLessThanOrEqual(60);
    expect(list[2].code).toBe("17");
  });

  it("item completo não entra; sem pendências, a lista fica vazia", () => {
    expect(list.map((i) => i.itemId)).not.toContain("item-0");
    const done = [item(0), item(1)];
    expect(
      incompleteBookingItems(
        done,
        bookingLotPending({ supplierId: "s", bookingDate: "d" }, done as never),
      ),
    ).toEqual([]);
  });
});

describe("página da linha na tabela", () => {
  it("a página (base 0) da posição na lista filtrada", () => {
    expect(pageOfIndex(0, 15)).toBe(0);
    expect(pageOfIndex(14, 15)).toBe(0);
    expect(pageOfIndex(15, 15)).toBe(1);
    expect(pageOfIndex(31, 15)).toBe(2);
    expect(pageOfIndex(-1, 15)).toBe(0);
  });
});
