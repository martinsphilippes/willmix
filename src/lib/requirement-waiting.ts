import type { Requirement } from "@/lib/db/schema";
import { requirementLabel, type Translate } from "@/i18n";
import { blockedBy } from "@/lib/purchase-lanes";

/**
 * Pedido de compra: o item espera o anterior da raia ou do contrato (a arte
 * espera a faca e a foto em alta; a arte final, a arte validada e o
 * certificado; o sinal, as duas assinaturas). Diz o que falta. A mesma
 * regra no detalhe do pedido e no pedido no passo (docs/FLOW_MENU.md).
 */
export function laneWaiting(
  t: Translate,
  r: Requirement,
  reqs: Requirement[],
): string | null {
  if (r.status === "done") return null;
  const missing = blockedBy(r.key, reqs);
  if (!missing.length) return null;
  const labels = missing
    .map((k) => reqs.find((x) => x.key === k))
    .filter((x): x is Requirement => !!x)
    .map((x) => requirementLabel(t, x).split(" · ")[0]);
  return t("purchaseSequence.waiting", { items: labels.join(", ") });
}

/**
 * O que a tarefa ainda espera no pedido no passo (Arte, Certificação…): a
 * aprovação da arte do pedido de antes das raias espera a arte; no pedido de
 * compra, a sequência das raias. Com espera, a linha diz o que falta em vez
 * dos botões (o servidor recusaria o envio).
 */
export function stepWaiting(
  t: Translate,
  r: Requirement,
  reqs: Requirement[],
  purchase: boolean,
): string | null {
  if (r.status === "done") return null;
  if (
    r.key === "art_approval" &&
    reqs.some((x) => x.key === "art" && x.status !== "done")
  )
    return t("packaging.waitingArt");
  return purchase ? laneWaiting(t, r, reqs) : null;
}
