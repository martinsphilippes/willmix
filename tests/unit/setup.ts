import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Store isolado por arquivo de teste (modo memória em diretório temporário). */
export function withTempStore() {
  process.env.DATA_MODE = "memory";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "wellmix-test-"));
  (globalThis as { __wellmixStore?: unknown }).__wellmixStore = undefined;
}

/**
 * Assina o documento do pedido como a página faz (docs/ORDER_SIGNATURE.md):
 * a Wellmix na etapa "Pedido criado", o fornecedor no começo da Preparação.
 */
export async function signOrderAs(
  user: import("@/lib/db").User,
  orderId: string,
) {
  const s = await import("@/lib/services/order-signature");
  const view = await s.getOrderSignatureView(user, orderId);
  if (!view) throw new Error("order_document_not_visible");
  return s.signOrderDocument(user, orderId, {
    name: user.name,
    agree: true,
    hash: view.hash,
  });
}
