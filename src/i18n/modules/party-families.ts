/**
 * Dicionário do módulo "party-families" (seção "Grupo de produto (família)"
 * do cadastro do parceiro, no lugar das "Linhas atendidas";
 * docs/PARTNER_FAMILIES.md): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "partyFamilies.title": "Grupo de produto (família)",
  "partyFamilies.hint":
    "Selecione os grupos de produto (famílias) atendidos por este parceiro.",
  "partyFamilies.search": "Buscar por nome ou código",
  "partyFamilies.selected": "Selecionadas ({n})",
  "partyFamilies.none": "Nenhuma família selecionada.",
  "partyFamilies.noMatch": "Nenhuma família com esse nome ou código.",
  "partyFamilies.code": "Cód. {code}",
  "partyFamilies.inactive": "(inativa no Sankhya)",
  "partyFamilies.remove": "Tirar {name}",
  "partyFamilies.save": "Gravar as famílias",
  "partyFamilies.saved": "Famílias gravadas.",
  "partyFamilies.empty":
    "O cadastro de famílias ainda está vazio: ele vem do Sankhya (o 1º nível dos grupos de produto, o mesmo da Nova solicitação).",
  "partyFamilies.sync": "Atualizar do Sankhya",
  "partyFamilies.synced": "Famílias atualizadas do Sankhya: {n}.",
  "partyFamilies.syncedAt": "Atualizado do Sankhya em {date}.",
  "partyFamilies.error.family_unknown":
    "Uma das famílias marcadas não está no cadastro. Recarregue a página e marque de novo.",
  "partyFamilies.error.family_party_type":
    "Este tipo de parceiro não tem grupo de produto (família).",
  "partyFamilies.error.families_sankhya_unavailable":
    "Não foi possível ler as famílias do Sankhya agora. Tente de novo em alguns minutos.",
};

export const en: Record<keyof typeof pt, string> = {
  "partyFamilies.title": "Product group (family)",
  "partyFamilies.hint":
    "Select the product groups (families) this partner supplies.",
  "partyFamilies.search": "Search by name or code",
  "partyFamilies.selected": "Selected ({n})",
  "partyFamilies.none": "No family selected.",
  "partyFamilies.noMatch": "No family with that name or code.",
  "partyFamilies.code": "Code {code}",
  "partyFamilies.inactive": "(inactive in Sankhya)",
  "partyFamilies.remove": "Remove {name}",
  "partyFamilies.save": "Save families",
  "partyFamilies.saved": "Families saved.",
  "partyFamilies.empty":
    "The family registry is still empty: it comes from Sankhya (the first level of product groups, the same as in New request).",
  "partyFamilies.sync": "Update from Sankhya",
  "partyFamilies.synced": "Families updated from Sankhya: {n}.",
  "partyFamilies.syncedAt": "Updated from Sankhya on {date}.",
  "partyFamilies.error.family_unknown":
    "One of the selected families is not in the registry. Reload the page and select again.",
  "partyFamilies.error.family_party_type":
    "This partner type has no product group (family).",
  "partyFamilies.error.families_sankhya_unavailable":
    "Could not read the families from Sankhya right now. Try again in a few minutes.",
};

export const zh: Record<keyof typeof pt, string> = {
  "partyFamilies.title": "产品组（系列）",
  "partyFamilies.hint": "选择该合作伙伴供应的产品组（系列）。",
  "partyFamilies.search": "按名称或代码搜索",
  "partyFamilies.selected": "已选择（{n}）",
  "partyFamilies.none": "未选择任何系列。",
  "partyFamilies.noMatch": "没有该名称或代码的系列。",
  "partyFamilies.code": "代码 {code}",
  "partyFamilies.inactive": "（在 Sankhya 中已停用）",
  "partyFamilies.remove": "移除 {name}",
  "partyFamilies.save": "保存系列",
  "partyFamilies.saved": "系列已保存。",
  "partyFamilies.empty":
    "系列目录仍为空：它来自 Sankhya（产品组的第一层，与新申请相同）。",
  "partyFamilies.sync": "从 Sankhya 更新",
  "partyFamilies.synced": "已从 Sankhya 更新系列：{n}。",
  "partyFamilies.syncedAt": "于 {date} 从 Sankhya 更新。",
  "partyFamilies.error.family_unknown":
    "所选系列中有一个不在目录中。请刷新页面后重新选择。",
  "partyFamilies.error.family_party_type": "该合作伙伴类型没有产品组（系列）。",
  "partyFamilies.error.families_sankhya_unavailable":
    "暂时无法从 Sankhya 读取系列。请几分钟后再试。",
};
