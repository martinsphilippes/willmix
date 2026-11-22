/*
 * Amostra aprovada (docs/SUPPLIER_SAMPLING.md): o produto e o pedido de
 * compra só saem depois dela. Nos testes que seguem para o produto, o
 * responsável sobe uma foto e envia, e a Wellmix aprova.
 *
 * Importe depois de `withTempStore()`.
 */
import type { User } from "@/lib/db";

export async function approveSample(admin: User, requestId: string) {
  const { getStore } = await import("@/lib/db");
  const sampling = await import("@/lib/services/supplier-request-sampling");
  const store = getStore();
  const request = (await store.get("supplier_requests", requestId))!;
  const suppliers = await store.list("users", {
    filter: { role: "supplier" },
  });
  const owner =
    suppliers.find((u) => u.partyId === request.supplierId) ??
    ({ ...suppliers[0], partyId: request.supplierId } as User);
  await sampling.addSamplingFile(owner, requestId, {
    file: new File([new Uint8Array([137, 80, 78, 71, 1])], "amostra.png", {
      type: "image/png",
    }),
    uploadedFileId: null,
  });
  await sampling.submitSampling(owner, requestId, null);
  return sampling.reviewSampling(admin, requestId, "approve", null);
}

/**
 * Amostra aprovada dentro da cotação de compra (dono, 22/11/2026;
 * docs/SUPPLIER_SAMPLING.md): só vence quem tem a amostra de todos os
 * produtos aprovada. O fornecedor da resposta sobe uma foto e envia, e a
 * Wellmix aprova. O conhecido do produto (dispensado) fica como está.
 */
export async function approveQuoteSample(quoteId: string, responseId: string) {
  const { getStore } = await import("@/lib/db");
  const sampling = await import("@/lib/services/quote-sampling");
  const store = getStore();
  const quote = (await store.get("purchase_quotes", quoteId))!;
  const response = (await store.get("purchase_quote_responses", responseId))!;
  const admin = (await store.list("users", { filter: { role: "admin" } }))[0];
  const suppliers = await store.list("users", {
    filter: { role: "supplier" },
  });
  const owner =
    suppliers.find((u) => u.partyId === response.supplierId) ??
    ({ ...suppliers[0], partyId: response.supplierId } as User);
  const known = await sampling.knownQuoteProducts(quote, response.supplierId);
  for (const item of quote.items) {
    if (known.has(item.productId)) continue;
    await sampling.addQuoteSamplingFile(owner, quoteId, item.productId, {
      file: new File([new Uint8Array([137, 80, 78, 71, 1])], "amostra.png", {
        type: "image/png",
      }),
      uploadedFileId: null,
    });
    await sampling.submitQuoteSampling(owner, quoteId, item.productId, null);
    await sampling.reviewQuoteSampling(
      admin,
      quoteId,
      item.productId,
      responseId,
      "approve",
      null,
    );
  }
}
