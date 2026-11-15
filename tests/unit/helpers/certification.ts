import type { User } from "@/lib/db";

/*
 * Fase 5d (docs/MILESTONES.md): o Contrato espera o marco Certificação
 * inteiro, com os passos do cartão Certificação (memorial, selo e arte com
 * o selo; laboratório e registro só quando começados). Nos testes que percorrem o pedido de compra de
 * uma linha que exige certificação, a certificadora do pedido envia os dela,
 * a agência aplica o selo na arte e a Wellmix (o login dado) valida.
 */
export async function completeCertification(wellmix: User, orderId: string) {
  const { getStore } = await import("@/lib/db");
  const { uploadDocument } = await import("@/lib/services/documents");
  const flow = await import("@/lib/services/import-flow");
  const store = getStore();
  const order = (await store.get("orders", orderId))!;
  const [ocp] = await store.list("users", {
    filter: { role: "ocp", partyId: order.ocpId!, active: true },
  });
  const [agency] = order.agencyId
    ? await store.list("users", {
        filter: { role: "agency", partyId: order.agencyId, active: true },
      })
    : [];
  const file = async (who: User, key: string) =>
    (
      await uploadDocument(
        who,
        new File(["%PDF-1.4 cert"], `${key}.pdf`, { type: "application/pdf" }),
        { orderId, type: "import_step", visibility: "internal" },
      )
    ).id;
  const steps: Array<[string, User, string | null]> = [
    ["cert_memorial", ocp, null],
    ["cert_seal", ocp, "SELO-1"],
    ["cert_seal_art", agency ?? wellmix, null],
  ];
  for (const [key, who, value] of steps) {
    const have = (
      await store.list("import_steps", { filter: { orderId, key } })
    )[0];
    const tpl = flow.stepTemplate(key as never);
    if (have?.status === "validated") continue;
    if (have?.status !== "submitted")
      await flow.submitStep(who, orderId, key as never, {
        value,
        documentId: await file(who, key),
      });
    if (tpl.validator)
      await flow.validateStep(
        wellmix,
        orderId,
        key as never,
        "validated",
        null,
      );
  }
  // Fora de uma requisição, a sincronização pedida pelos passos fica na
  // fila: roda aqui (as Pendências e os avisos saem dela).
  const { flushMilestoneSync } =
    await import("@/lib/services/order-milestones");
  await flushMilestoneSync();
}
