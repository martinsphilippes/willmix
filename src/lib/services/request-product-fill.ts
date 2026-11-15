import "server-only";
import { productNameText, type Translate } from "@/i18n";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore, type Product, type User } from "@/lib/db";
import { effectiveMoq } from "@/lib/moq";
import { realName } from "@/lib/placeholder-name";
import { buildProductSpec, productSpecLabels } from "@/lib/product-spec";
import type { ProductFill } from "@/components/request-product-fields";
import { availableStockByProduct } from "./containers";
import { lastPurchaseTexts } from "./last-purchase";
import { catalogShowcasePhotos } from "./documents";
import { productOptionLabel } from "./product-search";
import { variantsByProduct } from "./product-variants";
import { variantSpecData } from "./variant-sales";
import { cbmFromDimensions } from "@/lib/logistics/cbm";
import { sankhyaCartons } from "@/lib/integrations/sankhya-carton";

/**
 * Dados da ficha que preenchem a nova solicitação ao escolher o produto
 * (sem preço nem fornecedor para o cliente; a Wellmix vê o preço da última
 * compra): nome, descrição, especificação, fotos do
 * cadastro, estoque, pedido mínimo e variações.
 *
 * Antes a página montava isto para o catálogo inteiro (~15 mil produtos, a
 * página saía com 15 MB); desde a auditoria de performance (14/11/2026) a
 * página monta só o do produto já escolhido, e o campo de busca pede o de
 * cada produto escolhido a /api/products/fill. As regras são as mesmas.
 */
export async function requestProductFills(
  user: User,
  t: Translate,
  products: readonly Product[],
): Promise<ProductFill[]> {
  if (!products.length) return [];
  const ids = products.map((p) => p.id);
  const [showcase, stockByProduct, masterSheets, variants, lastPurchase] =
    await Promise.all([
      // Fotos do cadastro que aparecem ao escolher o produto (o cliente abre só estas).
      catalogShowcasePhotos(ids),
      availableStockByProduct(),
      // Pedido mínimo: o da ficha mestre (gravada com orderId = id do produto), senão o do cadastro.
      getStore().list("purchase_sheets", { filter: { orderId: ids } }),
      // Variações ativas (produto com variações exige escolher uma).
      variantsByProduct(ids),
      // Preço da última compra ao fornecedor: só a Wellmix vê.
      isWellmix(user)
        ? lastPurchaseTexts(t, products)
        : Promise.resolve(new Map<string, string>()),
    ]);
  const sheetMoq = new Map(masterSheets.map((s) => [s.orderId, s.moq]));
  const sheetOf = new Map(masterSheets.map((s) => [s.orderId, s]));
  const positive = (n: number | null | undefined) =>
    n !== null && n !== undefined && Number.isFinite(n) && n > 0 ? n : null;
  /** Caixa master do produto: cadastro, senão ficha mestre (programação pela quantidade). */
  const localCarton = (p: Product) => {
    const sheet = sheetOf.get(p.id);
    return {
      masterCartonQty:
        positive(p.masterBoxQty) ?? positive(sheet?.masterCartonQty),
      cbmPerCarton:
        positive(p.cbm) ??
        positive(
          cbmFromDimensions(p.boxLengthCm, p.boxWidthCm, p.boxHeightCm),
        ) ??
        positive(sheet?.cbmPerCarton),
    };
  };
  // Faltou caixa ou CBM no portal: busca no Sankhya na hora (volumes
  // alternativos, só leitura) os produtos que vieram de lá. A carga de
  // produtos grava os mesmos valores no cadastro.
  const live = await sankhyaCartons(
    products
      .filter((p) => {
        const c = localCarton(p);
        return p.sankhyaCode && (!c.masterCartonQty || !c.cbmPerCarton);
      })
      .map((p) => p.sankhyaCode),
  );
  const cartonOf = (p: Product) => {
    const local = localCarton(p);
    const erp = p.sankhyaCode ? live.get(p.sankhyaCode) : undefined;
    const masterCartonQty =
      local.masterCartonQty ?? positive(erp?.masterBoxQty);
    return {
      masterCartonQty,
      // O CBM do Sankhya é o da caixa dele: só vale para a mesma quantidade.
      cbmPerCarton:
        local.cbmPerCarton ??
        (erp?.masterBoxQty === masterCartonQty ? positive(erp?.cbm) : null),
    };
  };
  const specLabels = productSpecLabels(t);
  // Estoque: o cliente vê só "em estoque"; quantidades ficam para a Wellmix.
  const qty = (n: number) => n.toLocaleString(t.intl);
  const stockFor = (productId: string): ProductFill["stock"] => {
    const st = stockByProduct.get(productId);
    if (!st) return { available: false, detail: null };
    if (!isWellmix(user)) return { available: true, detail: null };
    const parts = [
      t("reqProduct.inStockQty", { qty: qty(st.quantity), unit: st.unit }),
      st.inTransit > 0
        ? t("reqProduct.inTransit", { qty: qty(st.inTransit) })
        : null,
    ];
    return { available: true, detail: parts.filter(Boolean).join(" · ") };
  };
  return products.map((p) => ({
    id: p.id,
    stock: stockFor(p.id),
    moq: effectiveMoq(null, sheetMoq.get(p.id), p.moq),
    ...cartonOf(p),
    lastPurchase: lastPurchase.get(p.id) ?? null,
    // Cada variação com o próprio mínimo (variação > ficha mestre > cadastro),
    // a especificação montada com os dados dela e a foto (sem preço nem fornecedor).
    variants: (variants.get(p.id) ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      moq: effectiveMoq(v.moq, sheetMoq.get(p.id), p.moq),
      masterCartonQty:
        v.masterBoxQty && v.masterBoxQty > 0
          ? v.masterBoxQty
          : cartonOf(p).masterCartonQty,
      cbmPerCarton: v.cbm && v.cbm > 0 ? v.cbm : cartonOf(p).cbmPerCarton,
      specification: variantSpecificationText(t, p, v, specLabels),
      photoDocumentId: v.photoDocumentId,
    })),
    photos: (showcase.get(p.id) ?? []).map((ph) => ({
      documentId: ph.documentId,
      caption: ph.caption?.trim() || productNameText(t, p.name),
    })),
    // "Produto sem nome" no campo para o nome de exemplo.
    label: productOptionLabel(t, p),
    ...productTexts(t, p),
  }));
}

const dims = (a: number | null, b: number | null, c: number | null) =>
  a !== null && b !== null && c !== null ? `${a} × ${b} × ${c}` : null;

/**
 * Nome, descrição e especificação da ficha (o que a Nova solicitação mostra
 * do produto escolhido). O servidor usa a mesma conta ao gravar: produto do
 * catálogo não tem esses textos editados na tela (dono, 15/11/2026).
 */
export function productTexts(
  t: Translate,
  p: Product,
): Pick<ProductFill, "productName" | "description" | "specification"> {
  return {
    // Nome de exemplo ("Produto novo XPTO"): nada no nome e na descrição da
    // solicitação (quem pede preenche).
    productName: realName(p.name) ?? "",
    description: [realName(p.name), p.category].filter(Boolean).join(" — "),
    // A especificação do cadastro (montada com os dados ou escrita à mão)
    // vale; produto antigo sem ela: os dados das colunas.
    specification: p.specification?.trim()
      ? [
          p.category ? `${t("catalog.category")}: ${p.category}` : null,
          p.specification.trim(),
        ]
          .filter(Boolean)
          .join("\n")
      : [
          p.category ? `${t("catalog.category")}: ${p.category}` : null,
          p.material ? `${t("catalog.material")}: ${p.material}` : null,
          p.color ? `${t("catalog.color")}: ${p.color}` : null,
          p.pantone ? `${t("catalog.pantone")}: ${p.pantone}` : null,
          dims(p.lengthCm, p.widthCm, p.heightCm)
            ? `${t("catalog.dimensions")}: ${dims(p.lengthCm, p.widthCm, p.heightCm)}`
            : null,
          p.netWeightKg !== null
            ? `${t("catalog.netWeight")}: ${p.netWeightKg}`
            : null,
          p.masterBoxQty !== null
            ? `${t("catalog.masterBoxQty")}: ${p.masterBoxQty}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
  };
}

/** Especificação de uma variação (categoria + dados da variação). */
export function variantSpecificationText(
  t: Translate,
  p: Product,
  v: Parameters<typeof variantSpecData>[0],
  specLabels = productSpecLabels(t),
): string {
  return [
    p.category ? `${t("catalog.category")}: ${p.category}` : null,
    buildProductSpec(variantSpecData(v), specLabels),
  ]
    .filter(Boolean)
    .join("\n");
}
