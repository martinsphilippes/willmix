import { describe, expect, it } from "vitest";
import { parseRequestItems } from "@/app/app/actions/request-items";

/** Rascunho com dois produtos e a programação gerada, ainda sem quantidades. */
function draftForm() {
  const f = new FormData();
  for (const [i, id] of ["prod-boneca", "prod-piscina"].entries()) {
    f.append(`p${i}.productId`, id);
    f.append(`p${i}.productName`, "");
    f.append(`p${i}.description`, "");
    f.append(`p${i}.quantity`, "120");
    f.append(`p${i}.unit`, "un");
    f.append(`p${i}.schedule.count`, "2");
    f.append(`p${i}.schedule.intervalDays`, "30");
    f.append(`p${i}.schedule.firstDate`, "2027-04-01");
    f.append(`p${i}.schedule.qty.1`, "");
    f.append(`p${i}.schedule.qty.2`, "");
  }
  return f;
}

describe("rascunho reaberto com campo incompleto (dono, 18/11/2026)", () => {
  it("o envio segue estrito: programação sem quantidade é recusada", () => {
    expect(() => parseRequestItems(draftForm())).toThrow("invalid_input");
  });

  it("a leitura do rascunho mantém os produtos e a programação (com zero)", () => {
    const rows = parseRequestItems(draftForm(), { lenient: true });
    expect(rows.map((r) => r.productId)).toEqual([
      "prod-boneca",
      "prod-piscina",
    ]);
    expect(rows[0].quantity).toBe(120);
    expect(rows[0].schedule?.items.map((i) => i.quantity)).toEqual([0, 0]);
  });

  it("programação de outro produto ou quantidade inválida: a linha volta sem ela", () => {
    const f = draftForm();
    f.set("p1.schedule.for", "outro:");
    f.set("p0.quantity", "abc");
    f.set("p0.schedule.intervalDays", "0");
    expect(() => parseRequestItems(f)).toThrow();
    const rows = parseRequestItems(f, { lenient: true });
    expect(rows).toHaveLength(2);
    expect(rows[0].quantity).toBeNull();
    expect(rows[0].schedule).toBeNull();
    expect(rows[1].schedule).toBeNull();
  });
});
