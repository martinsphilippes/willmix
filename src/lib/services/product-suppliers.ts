import "server-only";
import { getStore } from "@/lib/db";
import type {
  Party,
  Product,
  ProductSupplier,
  ProductSupplierSource,
  User,
} from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";

/*
 * Vários fornecedores por produto. O principal continua em
 * `products.supplierId` (ficha mestre, código e preço de referência); a
 * tabela `product_suppliers` guarda cada fornecedor do produto com o seu
 * código do item na fábrica e o histórico das cotações. Todo fornecedor que
 * responde uma cotação do produto entra na lista sozinho.
 *
 * Isolamento: só a Wellmix vê a lista. Um fornecedor só recebe, na própria
 * ficha, os dados do vínculo dele (código, último preço e MOQ dele).
 *
 * Antes de o esquema ser publicado no Appwrite a tabela não existe: leitura
 * devolve lista vazia e o vínculo automático não derruba a cotação.
 */

export class ProductSupplierError extends Error {}

const clean = (v: string | null | undefined) => {
  const s = (v ?? "").trim();
  return s ? s : null;
};

type LinkPatch = Partial<
  Omit<
    ProductSupplier,
    "id" | "createdAt" | "updatedAt" | "productId" | "supplierId"
  >
>;

/** Fornecedores ligados ao produto (vazio se a tabela ainda não existe). */
export async function listProductSuppliers(
  productId: string,
): Promise<ProductSupplier[]> {
  try {
    return await getStore().list("product_suppliers", {
      filter: { productId },
    });
  } catch (error) {
    console.warn("[product-suppliers] list failed", error);
    return [];
  }
}

/** Produtos ligados ao fornecedor (vazio se a tabela ainda não existe). */
export async function listSupplierProducts(
  supplierId: string,
): Promise<ProductSupplier[]> {
  try {
    return await getStore().list("product_suppliers", {
      filter: { supplierId },
    });
  } catch (error) {
    console.warn("[product-suppliers] list failed", error);
    return [];
  }
}

/** Vínculos de vários produtos de uma vez (lista de produtos). */
export async function listLinksForProducts(
  productIds: string[],
): Promise<ProductSupplier[]> {
  if (!productIds.length) return [];
  try {
    return await getStore().list("product_suppliers", {
      filter: { productId: productIds },
    });
  } catch (error) {
    console.warn("[product-suppliers] list failed", error);
    return [];
  }
}

export async function productSupplierLink(
  productId: string | null | undefined,
  supplierId: string | null | undefined,
): Promise<ProductSupplier | null> {
  if (!productId || !supplierId) return null;
  try {
    const [row] = await getStore().list("product_suppliers", {
      filter: { productId, supplierId },
      limit: 1,
    });
    return row ?? null;
  } catch (error) {
    console.warn("[product-suppliers] read failed", error);
    return null;
  }
}

/**
 * Cria ou atualiza o vínculo. `patchOf` recebe o vínculo atual (ou nulo) e
 * devolve o que gravar; `source` só vale na criação.
 */
async function upsertLink(
  user: User | null,
  productId: string,
  supplierId: string,
  source: ProductSupplierSource,
  patchOf: (prev: ProductSupplier | null) => LinkPatch,
): Promise<{ link: ProductSupplier; created: boolean }> {
  const store = getStore();
  const existing = await productSupplierLink(productId, supplierId);
  if (existing)
    return {
      link: await store.update(
        "product_suppliers",
        existing.id,
        patchOf(existing),
      ),
      created: false,
    };
  try {
    const link = await store.create("product_suppliers", {
      productId,
      supplierId,
      supplierSku: null,
      price: null,
      currency: null,
      moq: null,
      leadTimeDays: null,
      source,
      lastQuoteId: null,
      lastQuotedAt: null,
      quoteCount: 0,
      selectedCount: 0,
      lastSelectedAt: null,
      createdByUserId: user?.id ?? null,
      ...patchOf(null),
    });
    return { link, created: true };
  } catch (error) {
    // Duas gravações ao mesmo tempo: o índice único barra a segunda.
    const again = await productSupplierLink(productId, supplierId);
    if (!again) throw error;
    return {
      link: await store.update("product_suppliers", again.id, patchOf(again)),
      created: false,
    };
  }
}

/**
 * Fornecedor respondeu a cotação de um produto do catálogo: entra (ou é
 * atualizado) na lista do produto com preço, moeda, prazo, MOQ e código do
 * item que ele mesmo informou. Falha aqui não derruba a cotação.
 */
export async function linkSupplierFromQuote(
  user: User | null,
  quoteId: string,
  firstAnswer: boolean,
): Promise<void> {
  try {
    const store = getStore();
    const quote = await store.get("quotes", quoteId);
    if (!quote) return;
    const request = await store.get("requests", quote.requestId);
    const productId = request?.productId;
    if (!productId) return;
    const [product, supplier, sheets] = await Promise.all([
      store.get("products", productId),
      store.get("parties", quote.supplierId),
      store.list("purchase_sheets", {
        filter: { orderId: quote.id },
        limit: 1,
      }),
    ]);
    if (!product || !supplier || supplier.type !== "supplier") return;
    const sheet = sheets[0];
    const code = clean(sheet?.factoryItemCode)?.slice(0, 60) ?? null;
    const { created } = await upsertLink(
      user,
      productId,
      supplier.id,
      "quote",
      (prev) => ({
        price: quote.price ?? prev?.price ?? null,
        currency: quote.currency ?? prev?.currency ?? null,
        leadTimeDays: quote.leadTimeDays ?? prev?.leadTimeDays ?? null,
        moq: sheet?.moq ?? prev?.moq ?? null,
        supplierSku: code ?? prev?.supplierSku ?? null,
        lastQuoteId: quote.id,
        lastQuotedAt: quote.answeredAt ?? new Date().toISOString(),
        quoteCount: (prev?.quoteCount ?? 0) + (firstAnswer || !prev ? 1 : 0),
      }),
    );
    if (created)
      await audit(
        user,
        "product.supplier_from_quote",
        "product",
        productId,
        `Fornecedor ${supplier.name} entrou no produto pela cotação`,
      );
  } catch (error) {
    console.warn("[product-suppliers] link from quote failed", error);
  }
}

/** Cotação escolhida: conta como compra deste fornecedor para o produto. */
export async function markSupplierSelected(
  user: User | null,
  quoteId: string,
): Promise<void> {
  try {
    const store = getStore();
    const quote = await store.get("quotes", quoteId);
    if (!quote) return;
    const request = await store.get("requests", quote.requestId);
    if (!request?.productId) return;
    if (!(await store.get("products", request.productId))) return;
    await upsertLink(
      user,
      request.productId,
      quote.supplierId,
      "quote",
      (prev) => ({
        selectedCount: (prev?.selectedCount ?? 0) + 1,
        lastSelectedAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.warn("[product-suppliers] mark selected failed", error);
  }
}

/** Linha da lista "Fornecedores deste produto". */
export interface ProductSupplierRow {
  supplier: Pick<
    Party,
    "id" | "name" | "active" | "city" | "phone" | "storeNumber"
  >;
  main: boolean;
  link: ProductSupplier | null;
  /** Código do item na fábrica deste fornecedor. */
  supplierSku: string | null;
}

/**
 * Principal primeiro, depois quem cotou por último. O principal aparece mesmo
 * sem vínculo gravado (cadastros antigos).
 */
export async function productSuppliersView(
  product: Pick<Product, "id" | "supplierId" | "supplierSku">,
): Promise<ProductSupplierRow[]> {
  const links = await listProductSuppliers(product.id);
  const ids = [
    ...new Set([
      ...(product.supplierId ? [product.supplierId] : []),
      ...links.map((l) => l.supplierId),
    ]),
  ];
  if (!ids.length) return [];
  const parties = await getStore().list("parties", { filter: { id: ids } });
  const rows: ProductSupplierRow[] = [];
  for (const id of ids) {
    const party = parties.find((p) => p.id === id);
    if (!party) continue;
    const link = links.find((l) => l.supplierId === id) ?? null;
    const main = id === product.supplierId;
    rows.push({
      supplier: {
        id: party.id,
        name: party.name,
        active: party.active,
        city: party.city ?? null,
        phone: party.phone ?? null,
        storeNumber: party.storeNumber ?? null,
      },
      main,
      link,
      supplierSku: main
        ? (clean(product.supplierSku) ?? link?.supplierSku ?? null)
        : (link?.supplierSku ?? null),
    });
  }
  return rows.sort((a, b) => {
    if (a.main !== b.main) return a.main ? -1 : 1;
    const x = a.link?.lastQuotedAt ?? "";
    const y = b.link?.lastQuotedAt ?? "";
    if (x !== y) return x < y ? 1 : -1;
    return a.supplier.name.localeCompare(b.supplier.name);
  });
}

async function supplierParty(supplierId: string): Promise<Party> {
  const party = await getStore().get("parties", supplierId);
  if (!party || party.type !== "supplier")
    throw new ProductSupplierError("supplier_not_found");
  return party;
}

async function productOrThrow(productId: string): Promise<Product> {
  const product = await getStore().get("products", productId);
  if (!product) throw new ProductSupplierError("product_not_found");
  return product;
}

/** Wellmix acrescenta um fornecedor cadastrado ao produto (com o código dele, se souber). */
export async function addProductSupplier(
  user: User,
  productId: string,
  supplierId: string,
  supplierSku: string | null,
): Promise<ProductSupplier> {
  assertWellmix(user);
  await productOrThrow(productId);
  const party = await supplierParty(supplierId);
  const sku = clean(supplierSku)?.slice(0, 60) ?? null;
  const { link, created } = await upsertLink(
    user,
    productId,
    party.id,
    "manual",
    (prev) => (sku ? { supplierSku: sku } : prev ? {} : { supplierSku: null }),
  );
  await audit(
    user,
    created ? "product.supplier_add" : "product.supplier_update",
    "product",
    productId,
    `Fornecedor do produto: ${party.name}`,
    null,
    { supplierId: party.id, supplierSku: link.supplierSku },
  );
  return link;
}

/**
 * Código do item na fábrica de um fornecedor do produto. No principal, o
 * código também é o do produto (e da ficha mestre).
 */
export async function setProductSupplierCode(
  user: User,
  productId: string,
  supplierId: string,
  supplierSku: string | null,
): Promise<void> {
  assertWellmix(user);
  const product = await productOrThrow(productId);
  const party = await supplierParty(supplierId);
  const sku = clean(supplierSku)?.slice(0, 60) ?? null;
  const store = getStore();
  if (product.supplierId === party.id) {
    await store.update("products", productId, { supplierSku: sku });
    const [master] = await store.list("purchase_sheets", {
      filter: { orderId: productId },
      limit: 1,
    });
    if (master)
      await store.update("purchase_sheets", master.id, {
        factoryItemCode: sku,
      });
  }
  await upsertLink(user, productId, party.id, "manual", () => ({
    supplierSku: sku,
  }));
  await audit(
    user,
    "product.supplier_code",
    "product",
    productId,
    `Código de ${party.name}: ${sku ?? "—"}`,
  );
}

/** Tira um fornecedor da lista do produto (o principal não sai: troque antes). */
export async function removeProductSupplier(
  user: User,
  productId: string,
  supplierId: string,
): Promise<void> {
  assertWellmix(user);
  const product = await productOrThrow(productId);
  if (product.supplierId === supplierId)
    throw new ProductSupplierError("main_supplier");
  const link = await productSupplierLink(productId, supplierId);
  if (!link) throw new ProductSupplierError("not_found");
  await getStore().remove("product_suppliers", link.id);
  await audit(
    user,
    "product.supplier_remove",
    "product",
    productId,
    `Fornecedor retirado do produto: ${supplierId}`,
    link,
    null,
  );
}

/**
 * Troca o fornecedor principal. O código do antigo fica guardado no vínculo
 * dele; o produto e o bloco Fornecedor da ficha mestre passam a ser do novo
 * (nome, local, nº da loja, telefone e código do cadastro dele). Preço, MOQ e
 * os campos do produto ficam como estão.
 */
export async function setMainSupplier(
  user: User,
  productId: string,
  supplierId: string,
): Promise<Party> {
  assertWellmix(user);
  const product = await productOrThrow(productId);
  const party = await supplierParty(supplierId);
  if (product.supplierId === party.id) return party;
  const store = getStore();
  const previous = product.supplierId;
  // O código do antigo principal fica no vínculo dele. Sem a tabela (esquema
  // ainda não publicado) a troca não acontece, para o código não se perder.
  if (previous && clean(product.supplierSku)) {
    try {
      await upsertLink(user, productId, previous, "catalog", (prev) => ({
        supplierSku: prev?.supplierSku ?? clean(product.supplierSku),
      }));
    } catch (error) {
      console.warn("[product-suppliers] keep previous main failed", error);
      throw new ProductSupplierError("schema_outdated");
    }
  } else if (previous) {
    try {
      await upsertLink(user, productId, previous, "catalog", () => ({}));
    } catch (error) {
      console.warn("[product-suppliers] keep previous main failed", error);
    }
  }
  let link: ProductSupplier | null = null;
  try {
    ({ link } = await upsertLink(
      user,
      productId,
      party.id,
      "manual",
      () => ({}),
    ));
  } catch (error) {
    // Sem a tabela, o principal muda mesmo assim (o vínculo nasce depois).
    console.warn("[product-suppliers] link new main failed", error);
  }
  const sku = link?.supplierSku ?? null;
  await store.update("products", productId, {
    supplierId: party.id,
    supplierSku: sku,
  });
  const [master] = await store.list("purchase_sheets", {
    filter: { orderId: productId },
    limit: 1,
  });
  if (master)
    await store.update("purchase_sheets", master.id, {
      supplierName: party.name.slice(0, 160),
      location: party.city?.slice(0, 80) ?? null,
      supplierStore: party.storeNumber?.slice(0, 60) ?? null,
      supplierPhone: party.phone?.slice(0, 40) ?? null,
      factoryItemCode: sku,
    });
  await audit(
    user,
    "product.main_supplier",
    "product",
    productId,
    `Fornecedor principal: ${party.name}`,
    { supplierId: previous },
    { supplierId: party.id },
  );
  return party;
}

/**
 * Produto salvo pelo formulário do cadastro: o principal (e o antigo, se
 * trocou) fica na lista com o seu código. Falha aqui não derruba o cadastro.
 */
export async function syncMainSupplierLink(
  user: User,
  before: Pick<Product, "supplierId" | "supplierSku">,
  after: Pick<Product, "supplierId" | "supplierSku">,
  productId: string,
): Promise<void> {
  try {
    if (after.supplierId)
      await upsertLink(
        user,
        productId,
        after.supplierId,
        "catalog",
        (prev) => ({
          supplierSku: clean(after.supplierSku) ?? prev?.supplierSku ?? null,
        }),
      );
    if (before.supplierId && before.supplierId !== after.supplierId)
      await upsertLink(
        user,
        productId,
        before.supplierId,
        "catalog",
        (prev) => ({
          supplierSku: prev?.supplierSku ?? clean(before.supplierSku),
        }),
      );
  } catch (error) {
    console.warn("[product-suppliers] main link sync failed", error);
  }
}

/** Código no vínculo do fornecedor, só quando ainda vazio (escrita de volta da ficha). */
export async function fillLinkCode(
  user: User,
  productId: string,
  supplierId: string,
  code: string,
): Promise<boolean> {
  const link = await productSupplierLink(productId, supplierId);
  if (!link || clean(link.supplierSku)) return false;
  try {
    await getStore().update("product_suppliers", link.id, {
      supplierSku: code.slice(0, 60),
    });
    await audit(
      user,
      "product.supplier_code_from_sheet",
      "product",
      productId,
      `Código do fornecedor completado pela ficha: ${code.slice(0, 60)}`,
    );
    return true;
  } catch (error) {
    console.warn("[product-suppliers] code write-back failed", error);
    return false;
  }
}
