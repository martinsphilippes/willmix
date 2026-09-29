import "server-only";

import {
  getStore,
  type Product,
  type TaxClassification,
  type TaxSource,
  type User,
} from "@/lib/db";
import { assertRole, isWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";

/**
 * Classificação fiscal (NCM) com validação humana.
 *
 * Fluxo: produto + material + características → candidatas (heurística por
 * palavra-chave, despachante, IA quando houver, manual) → validação por
 * usuário autorizado (Wellmix ou despachante). Só a classificação "validated"
 * é copiada para `products.ncm`; sugestão nunca é tratada como definitiva.
 */

interface NcmHint {
  keywords: string[];
  ncm: string;
  description: string;
}

/** Tabela heurística mínima (capítulos/posições mais comuns nas importações da Wellmix). Sempre confirmar. */
export const NCM_HINTS: NcmHint[] = [
  {
    keywords: ["vidro", "glass", "玻璃", "jarra", "copo", "taça"],
    ncm: "7013.37",
    description: "Objetos de vidro para serviço de mesa ou cozinha",
  },
  {
    keywords: ["cerâmica", "porcelana", "ceramic", "陶瓷", "caneca"],
    ncm: "6912.00",
    description: "Louça e artigos de uso doméstico de cerâmica",
  },
  {
    keywords: ["inox", "aço inoxidável", "stainless", "不锈钢"],
    ncm: "7323.93",
    description: "Artigos de uso doméstico de aço inoxidável",
  },
  {
    keywords: [
      "alumínio",
      "aluminio",
      "aluminum",
      "铝",
      "panela",
      "frigideira",
    ],
    ncm: "7615.10",
    description: "Artigos de uso doméstico de alumínio",
  },
  {
    keywords: ["térmica", "termica", "thermos", "保温", "garrafa térmica"],
    ncm: "9617.00",
    description: "Garrafas térmicas e recipientes isotérmicos",
  },
  {
    keywords: ["brinquedo", "boneca", "toy", "doll", "玩具", "娃娃"],
    ncm: "9503.00",
    description: "Brinquedos, bonecos e modelos reduzidos",
  },
  {
    keywords: [
      "inflável",
      "inflavel",
      "piscina",
      "boia",
      "inflatable",
      "充气",
      "游泳池",
    ],
    ncm: "9506.99",
    description: "Artigos para esporte e recreação ao ar livre (infláveis)",
  },
  {
    keywords: [
      "plástico",
      "plastico",
      "pvc",
      "polipropileno",
      "plastic",
      "塑料",
    ],
    ncm: "3924.10",
    description: "Serviços de mesa e utensílios de cozinha de plástico",
  },
  {
    keywords: ["silicone", "硅胶"],
    ncm: "3924.10",
    description: "Utensílios de plástico/silicone para cozinha",
  },
  {
    keywords: ["bambu", "bamboo", "竹"],
    ncm: "4419.11",
    description: "Artigos de mesa ou cozinha de bambu",
  },
  {
    keywords: ["madeira", "wood", "木"],
    ncm: "4419.90",
    description: "Artigos de mesa ou cozinha de madeira",
  },
  {
    keywords: [
      "algodão",
      "algodao",
      "tecido",
      "toalha",
      "cotton",
      "棉",
      "毛巾",
    ],
    ncm: "6302.60",
    description: "Roupas de toucador ou cozinha de algodão",
  },
  {
    keywords: ["led", "lâmpada", "lampada", "luminária", "lamp", "灯"],
    ncm: "9405.11",
    description: "Luminárias e aparelhos de iluminação",
  },
  {
    keywords: ["bluetooth", "caixa de som", "speaker", "fone", "音箱", "耳机"],
    ncm: "8518.22",
    description: "Alto-falantes e aparelhos de som",
  },
  {
    keywords: ["mochila", "bolsa", "backpack", "bag", "背包", "包"],
    ncm: "4202.92",
    description: "Bolsas, mochilas e artigos semelhantes",
  },
];

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Candidatas por palavra-chave a partir de nome, material, categoria e especificação. Nunca definitivo. */
export function suggestNcm(
  product: Pick<Product, "name" | "material" | "category" | "specification">,
): Array<{ ncm: string; description: string; matched: string[] }> {
  const text = fold(
    [product.name, product.material, product.category, product.specification]
      .filter(Boolean)
      .join(" "),
  );
  const out: Array<{ ncm: string; description: string; matched: string[] }> =
    [];
  for (const hint of NCM_HINTS) {
    const matched = hint.keywords.filter((k) => text.includes(fold(k)));
    if (matched.length === 0) continue;
    const existing = out.find((o) => o.ncm === hint.ncm);
    if (existing) existing.matched.push(...matched);
    else out.push({ ncm: hint.ncm, description: hint.description, matched });
  }
  // Mais palavras casadas primeiro.
  return out.sort((a, b) => b.matched.length - a.matched.length);
}

export function listTaxClassifications(productId: string) {
  return getStore().list("tax_classifications", {
    filter: { productId },
    orderBy: "createdAt",
    direction: "desc",
  });
}

const canValidate = (user: User) => isWellmix(user) || user.role === "broker";

export async function addTaxCandidate(
  user: User,
  productId: string,
  input: {
    ncm: string;
    description?: string | null;
    taxes?: Record<string, number> | null;
    adminTreatment?: string | null;
    notes?: string | null;
    source: TaxSource;
    sourceRef?: string | null;
  },
): Promise<TaxClassification> {
  assertRole(user, ["admin", "operator", "broker"]);
  const ncm = input.ncm.replace(/[^\d.]/g, "");
  if (!/^\d{4}(\.\d{2}){0,2}$/.test(ncm) && !/^\d{8}$/.test(ncm))
    throw new Error("invalid_ncm");
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) throw new Error("product_not_found");
  const row = await store.create("tax_classifications", {
    productId,
    ncm,
    description: input.description ?? null,
    taxes: input.taxes ?? null,
    adminTreatment: input.adminTreatment ?? null,
    notes: input.notes ?? null,
    source: input.source,
    sourceRef: input.sourceRef ?? null,
    status: "suggested",
    suggestedByUserId: user.id,
    validatedByUserId: null,
    validatedAt: null,
  });
  await audit(
    user,
    "tax.suggest",
    "product",
    productId,
    `NCM ${ncm} (${input.source})`,
  );
  return row;
}

/** Gera candidatas heurísticas que ainda não existem para o produto. */
export async function suggestTaxCandidates(user: User, productId: string) {
  assertRole(user, ["admin", "operator", "broker"]);
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) throw new Error("product_not_found");
  const existing = await listTaxClassifications(productId);
  const created: TaxClassification[] = [];
  for (const s of suggestNcm(product)) {
    if (existing.some((e) => e.ncm === s.ncm)) continue;
    created.push(
      await addTaxCandidate(user, productId, {
        ncm: s.ncm,
        description: s.description,
        source: "heuristic",
        sourceRef: `palavras: ${[...new Set(s.matched)].join(", ")}`,
      }),
    );
  }
  return created;
}

/** Validação humana: uma única classificação validada por produto; a anterior volta a candidata. */
export async function validateTaxClassification(user: User, id: string) {
  if (!canValidate(user)) throw new Error("forbidden");
  const store = getStore();
  const row = await store.get("tax_classifications", id);
  if (!row) throw new Error("not_found");
  const siblings = await listTaxClassifications(row.productId);
  for (const s of siblings) {
    if (s.id !== id && s.status === "validated")
      await store.update("tax_classifications", s.id, {
        status: "suggested",
        notes: [s.notes, "Substituída por outra classificação validada."]
          .filter(Boolean)
          .join("\n"),
      });
  }
  const now = new Date().toISOString();
  const updated = await store.update("tax_classifications", id, {
    status: "validated",
    validatedByUserId: user.id,
    validatedAt: now,
  });
  await store.update("products", row.productId, { ncm: row.ncm });
  await audit(
    user,
    "tax.validate",
    "product",
    row.productId,
    `NCM ${row.ncm} validado`,
  );
  return updated;
}

export async function rejectTaxClassification(
  user: User,
  id: string,
  note?: string | null,
) {
  if (!canValidate(user)) throw new Error("forbidden");
  const store = getStore();
  const row = await store.get("tax_classifications", id);
  if (!row) throw new Error("not_found");
  const updated = await store.update("tax_classifications", id, {
    status: "rejected",
    notes: note ?? row.notes,
    validatedByUserId: user.id,
    validatedAt: new Date().toISOString(),
  });
  if (row.status === "validated") {
    const product = await store.get("products", row.productId);
    if (product?.ncm === row.ncm)
      await store.update("products", row.productId, { ncm: null });
  }
  await audit(
    user,
    "tax.reject",
    "product",
    row.productId,
    `NCM ${row.ncm} rejeitado`,
  );
  return updated;
}
