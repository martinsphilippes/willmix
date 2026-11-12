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
