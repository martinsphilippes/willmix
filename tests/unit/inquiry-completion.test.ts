import { describe, expect, it } from "vitest";
import {
  completion,
  inviteCompletion,
  quoteCompletion,
  quoteResponseCompletion,
  requestCompletion,
} from "@/lib/inquiry-completion";

/*
 * Completude de cada linha da lista de Consultas (dono, 27/11/2026): o que
 * a consulta pede, em etapas, e quanto já foi resolvido.
 */
const AT = "2026-11-27T10:00:00.000Z";
const line = (over: Record<string, unknown> = {}) => ({
  status: "open" as const,
  supplierCanDo: null,
  decidedAt: null,
  updatedAt: AT,
  sampling: null,
  samplingNeed: null,
  ...over,
});

describe("completude das consultas", () => {
  it("percentual arredondado para baixo; 100 só com tudo resolvido", () => {
    expect(completion(2, 3)).toEqual({ done: 2, total: 3, percent: 66 });
    expect(completion(0, 0).percent).toBe(0);
    expect(completion(5, 3).percent).toBe(100);
  });

  it("solicitação: resposta, decisão e, com a marca, a amostra aprovada", () => {
    expect(requestCompletion([line()]).percent).toBe(0);
    expect(
      requestCompletion([line({ status: "answered", supplierCanDo: "yes" })]),
    ).toMatchObject({ done: 1, total: 2 });
    expect(
      requestCompletion([
        line({ status: "approved", supplierCanDo: "yes", decidedAt: AT }),
      ]).percent,
    ).toBe(100);
    // Com "Necessita amostragem", falta a amostra.
    expect(
      requestCompletion([
        line({
          status: "approved",
          supplierCanDo: "yes",
          decidedAt: AT,
          samplingNeed: "yes",
        }),
      ]),
    ).toMatchObject({ done: 2, total: 3 });
    // Recusada conta como resolvida.
    expect(requestCompletion([line({ status: "declined" })]).percent).toBe(100);
  });

  it("cotação de compra: o preço de cada produto e, com a marca, a amostra", () => {
    const quote = {
      status: "open" as const,
      items: [{ productId: "p1" }, { productId: "p2" }],
    } as never;
    const response = {
      status: "answered" as const,
      prices: [{ productId: "p1", unitPrice: 1 }],
      sampling: null,
      invitedAt: AT,
    };
    expect(quoteResponseCompletion(quote, response)).toMatchObject({
      done: 1,
      total: 2,
    });
    expect(
      quoteResponseCompletion(
        { ...(quote as object), samplingNeed: "yes" } as never,
        response,
        new Set(["p2"]),
      ),
    ).toMatchObject({ done: 1, total: 3 });
    expect(
      quoteResponseCompletion(quote, { ...response, status: "declined" })
        .percent,
    ).toBe(100);
  });

  it("Wellmix: as respostas e a escolha; convite: o book enviado", () => {
    expect(
      quoteCompletion({ status: "open" }, [
        { status: "answered" },
        { status: "invited" },
      ]),
    ).toMatchObject({ done: 1, total: 3 });
    expect(
      quoteCompletion({ status: "chosen" }, [{ status: "answered" }]).percent,
    ).toBe(100);
    expect(inviteCompletion({ status: "open" }).percent).toBe(0);
    expect(inviteCompletion({ status: "answered" }).percent).toBe(100);
  });
});
