import type { Translate } from "@/i18n";
import { requirementLabel } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { blockLabelKey, stepLabelKey, type FlowBlock } from "@/lib/flow";
import { stepOfItem } from "@/lib/milestones";
import type { FlowEntityItem } from "@/lib/services/flow";

/*
 * O que está aberto de cada pedido na aba "Todos no passo" (dono,
 * 24/11/2026; docs/FLOW_MENU.md): regras puras, sem banco nem tela.
 */

/**
 * Passo do item quando ele é de outro passo (dono, 24/11/2026, opção 1): o
 * cadastro do produto do Pedido novo (Cadastros → Produtos) aparece também
 * em Pedido > Pedidos; nulo quando o item é do passo da lista.
 */
export function elsewhereOf(item: FlowEntityItem, here: string): string | null {
  if (item.kind !== "requirement") return null;
  const at = stepOfItem(item.requirement);
  return at && at !== here ? at : null;
}

/**
 * O que está aberto no passo, numa linha (dono, 24/11/2026, "linha fina"):
 * o passo de origem uma vez só ("Cadastros → Produtos: …"), cada item sem o
 * nome do produto (repetido vira "×2") e os produtos à parte, que aparecem
 * no "ver mais". O texto da linha é o resumo; nada some, só recolhe.
 */
export function openSummary(
  items: readonly FlowEntityItem[],
  t: Translate,
  here: string,
): { text: string; products: string[] } {
  const groups = new Map<string, Map<string, number>>();
  const products = new Set<string>();
  for (const item of items) {
    let where = "";
    let label: string;
    if (item.kind === "requirement") {
      // O rótulo gravado traz o produto depois de " · ".
      const full = requirementLabel(t, item.requirement);
      const cut = full.indexOf(" · ");
      label = cut < 0 ? full : full.slice(0, cut);
      if (cut >= 0) products.add(full.slice(cut + 3));
      const at = elsewhereOf(item, here);
      if (at) {
        const [block, key] = at.split("/");
        where = `${t(blockLabelKey(block as FlowBlock))} → ${t(stepLabelKey({ block: block as FlowBlock, key }))}`;
      }
    } else if (item.kind === "import")
      label = t(`importFlow.step.${item.key}` as DictionaryKey);
    else label = item.title ? t(item.title.detail, item.title.values) : "—";
    const group = groups.get(where) ?? new Map<string, number>();
    group.set(label, (group.get(label) ?? 0) + 1);
    groups.set(where, group);
  }
  // Os do próprio passo primeiro; depois os de outros passos.
  const parts = [...groups.entries()]
    .sort(([a], [b]) => (a ? 1 : 0) - (b ? 1 : 0))
    .map(([where, labels]) => {
      const list = [...labels.entries()]
        .map(([label, n]) => (n > 1 ? `${label} ×${n}` : label))
        .join(", ");
      return where ? t("flow.all.elsewhere", { where, item: list }) : list;
    });
  return { text: parts.join("; "), products: [...products] };
}
