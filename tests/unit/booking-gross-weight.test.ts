import { describe, expect, it } from "vitest";
import {
  BookingWeightError,
  bookingItemPatch,
  bookingItemPatches,
  bulkValueValid,
  grossWeightFactor,
  importedWeights,
} from "@/lib/booking-lots";
import { BOOKING_WEIGHT_GUARD_SQL } from "@/lib/db/supabase-sql";
import type { BookingItem } from "@/lib/db";

/*
 * Peso bruto do item do book (dono, 25/11/2026): maior que o líquido (também
 * no banco) e a fórmula "=*1,07" (o líquido do item vezes o número).
 */
const item = (net: number | null, gross: number | null) =>
  ({ netWeightPcKg: net, grossWeightPcKg: gross }) as unknown as BookingItem;

describe("peso bruto do book", () => {
  it("lê a fórmula", () => {
    expect(grossWeightFactor("=*1,07")).toBe(1.07);
    expect(grossWeightFactor("= * 1.07")).toBe(1.07);
    expect(grossWeightFactor("=x1,1")).toBe(1.1);
    expect(grossWeightFactor("1,07")).toBeNull();
    expect(() => grossWeightFactor("=+1")).toThrow(BookingWeightError);
    expect(() => grossWeightFactor("=*")).toThrow(BookingWeightError);
  });

  it("a fórmula usa o peso líquido do item", () => {
    expect(
      bookingItemPatch(item(2, null), "grossWeightPcKg", "=*1,07"),
    ).toEqual({ grossWeightPcKg: 2.14 });
    expect(() =>
      bookingItemPatch(item(null, null), "grossWeightPcKg", "=*1,07"),
    ).toThrow("booking_gross_formula");
  });

  it("recusa bruto menor ou igual ao líquido", () => {
    expect(() =>
      bookingItemPatch(item(2, null), "grossWeightPcKg", "2"),
    ).toThrow("booking_gross_not_above_net");
    expect(() =>
      bookingItemPatch(item(2, null), "grossWeightPcKg", "=*1"),
    ).toThrow("booking_gross_not_above_net");
    expect(() =>
      bookingItemPatch(item(null, 2), "netWeightPcKg", "2,5"),
    ).toThrow("booking_gross_not_above_net");
    expect(bookingItemPatch(item(2, null), "grossWeightPcKg", "2,1")).toEqual({
      grossWeightPcKg: 2.1,
    });
  });

  it("em massa: líquido e bruto juntos, o bruto pela fórmula do novo líquido", () => {
    expect(
      bookingItemPatches(item(1, 1.5), [
        ["grossWeightPcKg", "=*1,1"],
        ["netWeightPcKg", "3"],
      ]),
    ).toEqual({ netWeightPcKg: 3, grossWeightPcKg: 3.3 });
    expect(
      bookingItemPatches(item(1, 1.5), [
        ["netWeightPcKg", "3"],
        ["grossWeightPcKg", "4"],
      ]),
    ).toEqual({ netWeightPcKg: 3, grossWeightPcKg: 4 });
  });

  it("o campo do preenchimento em massa aceita a fórmula", () => {
    expect(bulkValueValid("grossWeightPcKg", "=*1,07")).toBe(true);
    expect(bulkValueValid("grossWeightPcKg", "=*abc")).toBe(false);
    expect(bulkValueValid("netWeightPcKg", "=*1,07")).toBe(false);
  });

  it("planilha com bruto ≤ líquido entra sem o bruto", () => {
    expect(importedWeights(item(2, 2)).grossWeightPcKg).toBeNull();
    expect(importedWeights(item(2, 2.2)).grossWeightPcKg).toBe(2.2);
  });

  it("o banco tem o gatilho da mesma regra", () => {
    expect(BOOKING_WEIGHT_GUARD_SQL).toContain(
      `"grossWeightPcKg" <= new."netWeightPcKg"`,
    );
  });
});
