import { describe, expect, it } from "vitest";
import {
  bookingCapacityShown,
  missingItemFields,
  parseCapacityMl,
  readBookingCapacity,
} from "@/lib/booking-lots";

/*
 * Capacidade do item do booking (docs/BOOKING.md): mililitros quando o
 * produto tem volume; quando a planilha traz um tamanho no lugar ("8X10",
 * "A4", como nos porta-retratos), o texto fica guardado e é ele que a coluna
 * mostra. Antes a coluna só aceitava número e o que veio da planilha sumia
 * da tela.
 */
describe("capacidade: mililitros ou tamanho", () => {
  it("lê mililitros e litros; texto não é volume", () => {
    expect(parseCapacityMl("350")).toBe(350);
    expect(parseCapacityMl("350 ml")).toBe(350);
    expect(parseCapacityMl("350ML")).toBe(350);
    expect(parseCapacityMl("1,5 L")).toBe(1500);
    expect(parseCapacityMl("0.5l")).toBe(500);
    for (const text of ["8X10", "A4", "10x15cm", "4 x 6 inch", "5R"])
      expect(parseCapacityMl(text)).toBeNull();
  });

  it("a coluna mostra os mililitros ou, sem eles, o tamanho", () => {
    expect(bookingCapacityShown({ capacityMl: 350, sizeText: null })).toBe(350);
    expect(bookingCapacityShown({ capacityMl: null, sizeText: "8X10" })).toBe(
      "8X10",
    );
    // Com os dois, vale o volume (o tamanho veio da coluna de medidas).
    expect(bookingCapacityShown({ capacityMl: 350, sizeText: "Ø12" })).toBe(
      350,
    );
    expect(
      bookingCapacityShown({ capacityMl: null, sizeText: null }),
    ).toBeNull();
    expect(
      bookingCapacityShown({ capacityMl: null, sizeText: "  " }),
    ).toBeNull();
  });

  it("digitar: número vira ml, letras viram tamanho, vazio apaga", () => {
    const empty = { capacityMl: null, sizeText: null };
    expect(readBookingCapacity("350", empty)).toEqual({
      capacityMl: 350,
      sizeText: null,
    });
    expect(readBookingCapacity("1,5 L", empty)).toEqual({
      capacityMl: 1500,
      sizeText: null,
    });
    expect(readBookingCapacity(" 8X10 ", empty)).toEqual({
      capacityMl: null,
      sizeText: "8X10",
    });
    // Trocar o tamanho por mililitros (e o contrário).
    expect(
      readBookingCapacity("500", { capacityMl: null, sizeText: "8X10" }),
    ).toEqual({ capacityMl: 500, sizeText: null });
    expect(
      readBookingCapacity("A4", { capacityMl: 500, sizeText: null }),
    ).toEqual({ capacityMl: null, sizeText: "A4" });
    // Apagar o que a coluna mostrava.
    expect(
      readBookingCapacity("", { capacityMl: null, sizeText: "8X10" }),
    ).toEqual({ capacityMl: null, sizeText: null });
    // Zero e número absurdo recusam, como nos outros campos.
    expect(() => readBookingCapacity("0", empty)).toThrow(
      "booking_item_invalid",
    );
    expect(() => readBookingCapacity("99999999999", empty)).toThrow(
      "booking_item_invalid",
    );
  });

  it("o tamanho guardado da coluna de medidas não se perde ao digitar os ml", () => {
    const withBoth = { capacityMl: 350, sizeText: "Ø12 cm" };
    expect(readBookingCapacity("400", withBoth)).toEqual({
      capacityMl: 400,
      sizeText: "Ø12 cm",
    });
    expect(readBookingCapacity("", withBoth)).toEqual({
      capacityMl: null,
      sizeText: "Ø12 cm",
    });
  });

  it("para fechar o booking, o tamanho vale como capacidade", () => {
    const base = {
      incoterm: "FOB",
      currency: "USD",
      price: 1,
      masterCartonQty: 1,
      innerQty: 1,
      netWeightPcKg: 1,
      grossWeightPcKg: 1,
      cbmPerCarton: 1,
      lengthCm: 1,
      widthCm: 1,
      heightCm: 1,
      packageType: "box",
      material: "glass",
      moq: 1,
      ncm: "7013.37.00",
    } as const;
    expect(
      missingItemFields({ ...base, capacityMl: null, sizeText: "8X10" }),
    ).toEqual([]);
    expect(
      missingItemFields({ ...base, capacityMl: 350, sizeText: null }),
    ).toEqual([]);
    expect(
      missingItemFields({ ...base, capacityMl: null, sizeText: null }),
    ).toEqual(["capacityMl"]);
    // Quem não informa o tamanho continua como antes.
    expect(missingItemFields({ ...base, capacityMl: null })).toEqual([
      "capacityMl",
    ]);
  });
});
