import { describe, expect, it } from "vitest";
import { z } from "zod";
import { withTempStore } from "./setup";

/*
 * Valor recusado diz QUAL campo: a volta do envio leva os nomes (?fields=)
 * e a tela aponta cada um, em vez de só "algum campo tem valor inválido".
 */
withTempStore();

const { field, invalidFieldNames, errorCode } = await import(
  "@/app/app/actions/helpers"
);
const { fieldNamesParam } = await import("@/components/action-error");

const formOf = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
};

describe("campo recusado leva o nome", () => {
  it("objeto validado: os nomes vêm do caminho do erro", () => {
    const result = z
      .object({ name: z.string().min(2), amount: z.number().positive() })
      .safeParse({ name: "x", amount: -1 });
    expect(result.success).toBe(false);
    expect(invalidFieldNames(result.error)).toEqual(["name", "amount"]);
    expect(errorCode("/x", result.error)).toBe("invalid_input");
  });

  it("um campo só, lido com field(): o nome vai junto", () => {
    const form = formOf({ leadTimeDays: "trinta" });
    let error: unknown;
    try {
      field(form, "leadTimeDays", z.coerce.number().int().positive());
    } catch (e) {
      error = e;
    }
    expect(invalidFieldNames(error)).toEqual(["leadTimeDays"]);
    expect(field(formOf({ n: "12" }), "n", z.coerce.number())).toBe(12);
  });

  it("erro que não é de validação não tem campo; nomes da URL são filtrados", () => {
    expect(invalidFieldNames(new Error("boom"))).toEqual([]);
    expect(fieldNamesParam("price,moq,<script>,a b")).toEqual(["price", "moq"]);
    expect(fieldNamesParam(undefined)).toEqual([]);
  });
});
