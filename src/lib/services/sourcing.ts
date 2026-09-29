import "server-only";

import {
  getStore,
  PRODUCT_EXTRA_DEFAULTS,
  type MeasurementKind,
  type PhotoKind,
  type Product,
  type ProductPhoto,
  type SourcingItem,
  type SupplierVisit,
  type User,
} from "@/lib/db";
import {
  assertWellmix,
  canViewOrder,
  ForbiddenError,
} from "@/lib/auth/permissions";
import { boxCbm } from "@/lib/logistics/cbm";
import { audit } from "./audit";
import { uploadDocument } from "./documents";

/**
 * Sourcing: visitas a fornecedores, produtos encontrados e negociação,
 * fotos como evidência e promoção de item a produto do catálogo.
 * Relação: Fornecedor → Visita → Produto encontrado → Negociação (snapshot no pedido).
 */

export type VisitInput = Omit<
  SupplierVisit,
  "id" | "createdAt" | "updatedAt" | "createdByUserId"
>;
export type SourcingItemInput = Omit<
  SourcingItem,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "createdByUserId"
  | "productId"
  | "primaryPhotoDocumentId"
>;

export async function saveVisit(
  user: User,
  input: VisitInput,
  id?: string | null,
) {
  assertWellmix(user);
  const store = getStore();
  if (id) {
    const visit = await store.update("supplier_visits", id, input);
    await audit(
      user,
      "visit.update",
      "supplier_visit",
      id,
      visit.supplierName ?? visit.factoryName ?? "",
    );
    return visit;
  }
  const visit = await store.create("supplier_visits", {
    ...input,
    createdByUserId: user.id,
  });
  await audit(
    user,
    "visit.create",
    "supplier_visit",
    visit.id,
    visit.supplierName ?? visit.factoryName ?? "",
  );
  return visit;
}

export async function saveSourcingItem(
  user: User,
  input: SourcingItemInput,
  id?: string | null,
) {
  assertWellmix(user);
  const store = getStore();
  const data = { ...input, cbm: boxCbm(input) };
  if (id) {
    const item = await store.update("sourcing_items", id, data);
    await audit(user, "sourcing.update", "sourcing_item", id, item.name);
    return item;
  }
  const item = await store.create("sourcing_items", {
    ...data,
    productId: null,
    primaryPhotoDocumentId: null,
    createdByUserId: user.id,
  });
  await audit(user, "sourcing.create", "sourcing_item", item.id, item.name);
  return item;
}

/**
 * Fotos: a original é evidência e nunca é substituída. Uma imagem comercial
 * aponta para a original de que deriva (derivedFromPhotoId).
 */
export async function addPhotos(
  user: User,
  target: {
    sourcingItemId?: string | null;
    productId?: string | null;
    orderId?: string | null;
  },
  files: File[],
  kind: PhotoKind,
  options: {
    caption?: string | null;
    derivedFromPhotoId?: string | null;
    takenAt?: string | null;
  } = {},
): Promise<ProductPhoto[]> {
  const store = getStore();
  await assertPhotoAccess(user, target);
  const out: ProductPhoto[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    const doc = await uploadDocument(user, file, {
      type: "photo",
      visibility: kind === "commercial" ? "all" : "internal",
      productId: target.productId ?? null,
      sourcingItemId: target.sourcingItemId ?? null,
      orderId: target.orderId ?? null,
    });
    const existing = await store.list("product_photos", {
      filter: target.productId
        ? { productId: target.productId }
        : { sourcingItemId: target.sourcingItemId ?? "" },
      limit: 1,
    });
    const photo = await store.create("product_photos", {
      productId: target.productId ?? null,
      sourcingItemId: target.sourcingItemId ?? null,
      orderId: target.orderId ?? null,
      documentId: doc.id,
      kind,
      caption: options.caption ?? null,
      takenAt: options.takenAt ?? new Date().toISOString(),
      takenByUserId: user.id,
      derivedFromPhotoId: options.derivedFromPhotoId ?? null,
      isPrimary:
        existing.length === 0 && (kind === "original" || kind === "commercial"),
    });
    out.push(photo);
    if (photo.isPrimary) {
      if (target.productId)
        await store.update("products", target.productId, {
          primaryPhotoDocumentId: doc.id,
        });
      if (target.sourcingItemId)
        await store.update("sourcing_items", target.sourcingItemId, {
          primaryPhotoDocumentId: doc.id,
        });
    }
  }
  return out;
}

/** Fotos de produto/sourcing: só Wellmix; fotos de pedido: quem pode ver o pedido. */
async function assertPhotoAccess(
  user: User,
  target: { orderId?: string | null },
) {
  if (target.orderId) {
    const order = await getStore().get("orders", target.orderId);
    if (!order || !canViewOrder(user, order)) throw new ForbiddenError();
    return;
  }
  assertWellmix(user);
}

export async function setPrimaryPhoto(user: User, photoId: string) {
  assertWellmix(user);
  const store = getStore();
  const photo = await store.get("product_photos", photoId);
  if (!photo) throw new Error("photo_not_found");
  const siblings = await store.list("product_photos", {
    filter: photo.productId
      ? { productId: photo.productId }
      : { sourcingItemId: photo.sourcingItemId ?? "" },
  });
  for (const s of siblings) {
    if (s.isPrimary !== (s.id === photoId))
      await store.update("product_photos", s.id, {
        isPrimary: s.id === photoId,
      });
  }
  if (photo.productId)
    await store.update("products", photo.productId, {
      primaryPhotoDocumentId: photo.documentId,
    });
  if (photo.sourcingItemId)
    await store.update("sourcing_items", photo.sourcingItemId, {
      primaryPhotoDocumentId: photo.documentId,
    });
}

/** Evidência de peso/medida: valor declarado (opcional), medido, unidade, foto da balança/régua. */
export async function addMeasurement(
  user: User,
  entity: "product" | "sourcing_item" | "order",
  entityId: string,
  input: {
    kind: MeasurementKind;
    declaredValue: number | null;
    measuredValue: number;
    unit: string;
    note?: string | null;
    photo?: File | null;
  },
) {
  const store = getStore();
  await assertPhotoAccess(user, {
    orderId: entity === "order" ? entityId : null,
  });
  let photoDocumentId: string | null = null;
  if (input.photo && input.photo.size > 0) {
    const doc = await uploadDocument(user, input.photo, {
      type: "photo",
      visibility: "internal",
      productId: entity === "product" ? entityId : null,
      sourcingItemId: entity === "sourcing_item" ? entityId : null,
      orderId: entity === "order" ? entityId : null,
    });
    photoDocumentId = doc.id;
  }
  const row = await store.create("measurements", {
    entity,
    entityId,
    kind: input.kind,
    declaredValue: input.declaredValue,
    measuredValue: input.measuredValue,
    unit: input.unit,
    photoDocumentId,
    measuredByUserId: user.id,
    measuredAt: new Date().toISOString(),
    note: input.note ?? null,
  });
  await audit(
    user,
    "measurement.add",
    entity,
    entityId,
    `${input.kind}: ${input.measuredValue} ${input.unit}`,
  );
  return row;
}

/**
 * Promove um item de sourcing a produto do catálogo (ou atualiza o produto já
 * vinculado). As fotos passam a valer também para o produto; o item fica
 * "promoted" e ligado ao produto. Nada do item é apagado.
 */
export async function promoteSourcingItem(
  user: User,
  itemId: string,
  options: { lineId: string; sku?: string | null },
): Promise<Product> {
  assertWellmix(user);
  const store = getStore();
  const item = await store.get("sourcing_items", itemId);
  if (!item) throw new Error("item_not_found");
  const fields = {
    supplierId: item.supplierId,
    supplierSku: item.supplierSku,
    category: item.category,
    material: item.material,
    color: item.color,
    pantone: item.pantone,
    moq: item.moq,
    price: item.price,
    currency: item.currency,
    masterBoxQty: item.masterBoxQty,
    innerBoxQty: item.innerBoxQty,
    netWeightKg: item.netWeightKg,
    grossWeightKg: item.grossWeightKg,
    widthCm: item.widthCm,
    heightCm: item.heightCm,
    lengthCm: item.lengthCm,
    boxLengthCm: item.boxLengthCm,
    boxWidthCm: item.boxWidthCm,
    boxHeightCm: item.boxHeightCm,
    cbm: boxCbm(item),
    notes: [item.conditions, item.notes].filter(Boolean).join("\n") || null,
    negotiatedAt: item.foundAt,
    sourcingItemId: item.id,
    primaryPhotoDocumentId: item.primaryPhotoDocumentId,
  };
  let product: Product;
  if (item.productId && (await store.get("products", item.productId))) {
    product = await store.update("products", item.productId, {
      ...fields,
      lineId: options.lineId,
    });
  } else {
    product = await store.create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      ...fields,
      lineId: options.lineId,
      name: item.name,
      sku: options.sku ?? null,
      specification: item.description,
      active: true,
      source: "sourcing",
    });
  }
  const photos = await store.list("product_photos", {
    filter: { sourcingItemId: item.id },
  });
  for (const photo of photos) {
    if (photo.productId !== product.id)
      await store.update("product_photos", photo.id, { productId: product.id });
  }
  const docs = await store.list("documents", {
    filter: { sourcingItemId: item.id },
  });
  for (const doc of docs) {
    if (doc.productId !== product.id)
      await store.update("documents", doc.id, { productId: product.id });
  }
  await store.update("sourcing_items", item.id, {
    status: "promoted",
    productId: product.id,
  });
  await audit(
    user,
    "sourcing.promote",
    "product",
    product.id,
    `De sourcing: ${item.name}`,
  );
  return product;
}

export async function loadSourcingItem(itemId: string) {
  const store = getStore();
  const item = await store.get("sourcing_items", itemId);
  if (!item) return null;
  const [photos, measurements, visit, supplier, documents] = await Promise.all([
    store.list("product_photos", { filter: { sourcingItemId: itemId } }),
    store.list("measurements", {
      filter: { entity: "sourcing_item", entityId: itemId },
    }),
    item.visitId
      ? store.get("supplier_visits", item.visitId)
      : Promise.resolve(null),
    item.supplierId
      ? store.get("parties", item.supplierId)
      : Promise.resolve(null),
    store.list("documents", { filter: { sourcingItemId: itemId } }),
  ]);
  return { item, photos, measurements, visit, supplier, documents };
}

export async function loadProductSheet(productId: string) {
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) return null;
  const [photos, measurements, schedules, supplier, line, documents, sourcing] =
    await Promise.all([
      store.list("product_photos", { filter: { productId } }),
      store.list("measurements", {
        filter: { entity: "product", entityId: productId },
      }),
      store.list("purchase_schedules", {
        filter: { productId },
        orderBy: "sequence",
      }),
      product.supplierId
        ? store.get("parties", product.supplierId)
        : Promise.resolve(null),
      store.get("product_lines", product.lineId),
      store.list("documents", { filter: { productId } }),
      product.sourcingItemId
        ? store.get("sourcing_items", product.sourcingItemId)
        : Promise.resolve(null),
    ]);
  return {
    product,
    photos,
    measurements,
    schedules,
    supplier,
    line,
    documents,
    sourcing,
  };
}
