"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import {
  getStore,
  MEASUREMENT_KINDS,
  PHOTO_KINDS,
  SCHEDULE_STATUSES,
} from "@/lib/db";
import { cbmFromDimensions } from "@/lib/logistics/cbm";
import { audit } from "@/lib/services/audit";
import { parsePriceTiers } from "@/lib/services/opportunities";
import {
  addMeasurement,
  addPhotos,
  setPrimaryPhoto,
} from "@/lib/services/sourcing";
import { files, num, requireUser, run, str } from "./helpers";
import { parseCurrency } from "@/lib/currencies";

/*
 * Ficha de produto, fotos, medições, programação de compra e dados extras do
 * parceiro. Tudo só Wellmix. Fotos e medições reutilizam o serviço de sourcing.
 */

const optionalText = (max: number) => z.string().max(max).nullable();
const optionalNumber = z.number().finite().nonnegative().nullable();
const optionalInt = z.number().int().nonnegative().nullable();
const currencySchema = z
  .string()
  .regex(/^[A-Za-z]{3}$/)
  .transform((s) => s.toUpperCase())
  .nullable();

/** "2026-11-05" (input date) → ISO; vazio → null. */
function dateToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("invalid_date");
  return d.toISOString();
}

const sheetSchema = z.object({
  name: z.string().min(2).max(160),
  lineId: z.string().min(1),
  sku: optionalText(60),
  category: optionalText(80),
  specification: z.string().nullable(),
  active: z.boolean(),
  supplierId: z.string().nullable(),
  supplierSku: optionalText(60),
  price: optionalNumber,
  currency: currencySchema,
  moq: optionalInt,
  negotiatedAt: z.string().nullable(),
  material: optionalText(120),
  color: optionalText(60),
  pantone: optionalText(40),
  lengthCm: optionalNumber,
  widthCm: optionalNumber,
  heightCm: optionalNumber,
  netWeightKg: optionalNumber,
  grossWeightKg: optionalNumber,
  masterBoxQty: optionalInt,
  innerBoxQty: optionalInt,
  boxLengthCm: optionalNumber,
  boxWidthCm: optionalNumber,
  boxHeightCm: optionalNumber,
  cbm: optionalNumber,
  notes: z.string().nullable(),
});

export async function updateProductSheetAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(`/app/products/${id}`, async () => {
    assertWellmix(user);
    const store = getStore();
    const product = await store.get("products", id);
    if (!product) throw new Error("product_not_found");
    const parsed = sheetSchema.parse({
      name: str(form, "name"),
      lineId: str(form, "lineId"),
      sku: str(form, "sku") || null,
      category: str(form, "category") || null,
      specification: str(form, "specification") || null,
      // O formulário envia o hidden "off" antes do checkbox "on"; form.get() devolveria sempre "off".
      active: form.getAll("active").includes("on"),
      supplierId: str(form, "supplierId") || null,
      supplierSku: str(form, "supplierSku") || null,
      price: num(form, "price"),
      currency: str(form, "currency")
        ? parseCurrency(str(form, "currency"))
        : null,
      moq: num(form, "moq"),
      negotiatedAt: dateToIso(str(form, "negotiatedAt")),
      material: str(form, "material") || null,
      color: str(form, "color") || null,
      pantone: str(form, "pantone") || null,
      lengthCm: num(form, "lengthCm"),
      widthCm: num(form, "widthCm"),
      heightCm: num(form, "heightCm"),
      netWeightKg: num(form, "netWeightKg"),
      grossWeightKg: num(form, "grossWeightKg"),
      masterBoxQty: num(form, "masterBoxQty"),
      innerBoxQty: num(form, "innerBoxQty"),
      boxLengthCm: num(form, "boxLengthCm"),
      boxWidthCm: num(form, "boxWidthCm"),
      boxHeightCm: num(form, "boxHeightCm"),
      cbm: num(form, "cbm"),
      notes: str(form, "notes") || null,
    });
    if (!(await store.get("product_lines", parsed.lineId)))
      throw new Error("line_not_found");
    if (parsed.supplierId) {
      const supplier = await store.get("parties", parsed.supplierId);
      if (!supplier || supplier.type !== "supplier")
        throw new Error("supplier_not_found");
    }
    // CBM por caixa: das dimensões da caixa master quando existem; senão o informado.
    const cbm =
      cbmFromDimensions(
        parsed.boxLengthCm,
        parsed.boxWidthCm,
        parsed.boxHeightCm,
      ) ?? (parsed.cbm && parsed.cbm > 0 ? parsed.cbm : null);
    await store.update("products", id, { ...parsed, cbm });
    // Ficha mestre do produto (se existir) acompanha preço, caixa, medidas, cor e material.
    const { syncMasterFromProduct } =
      await import("@/lib/services/product-sheet");
    await syncMasterFromProduct(id);
    await audit(user, "product.update", "product", id, parsed.name, product, {
      ...parsed,
      cbm,
    });
    return `/app/products/${id}?saved=1`;
  });
}

export async function addProductPhotosAction(form: FormData) {
  const user = await requireUser();
  const productId = str(form, "productId");
  await run(`/app/products/${productId}`, async () => {
    assertWellmix(user);
    const parsed = z
      .object({
        kind: z.enum(PHOTO_KINDS),
        caption: optionalText(200),
      })
      .parse({
        kind: str(form, "kind") || "original",
        caption: str(form, "caption") || null,
      });
    if (!(await getStore().get("products", productId)))
      throw new Error("product_not_found");
    const photos = files(form, "photos");
    if (photos.length === 0) throw new Error("file_required");
    const added = await addPhotos(user, { productId }, photos, parsed.kind, {
      caption: parsed.caption,
    });
    await audit(
      user,
      "product.photo.add",
      "product",
      productId,
      `${added.length} foto(s) ${parsed.kind}`,
    );
    return `/app/products/${productId}#photos`;
  });
}

export async function setPrimaryPhotoAction(form: FormData) {
  const user = await requireUser();
  const productId = str(form, "productId");
  await run(`/app/products/${productId}`, async () => {
    assertWellmix(user);
    const photoId = z.string().min(1).parse(str(form, "photoId"));
    const photo = await getStore().get("product_photos", photoId);
    if (!photo || photo.productId !== productId)
      throw new Error("photo_not_found");
    await setPrimaryPhoto(user, photoId);
    await audit(user, "product.photo.primary", "product", productId, photoId);
    return `/app/products/${productId}#photos`;
  });
}

export async function addProductMeasurementAction(form: FormData) {
  const user = await requireUser();
  const productId = str(form, "productId");
  await run(`/app/products/${productId}`, async () => {
    assertWellmix(user);
    const parsed = z
      .object({
        kind: z.enum(MEASUREMENT_KINDS),
        declaredValue: optionalNumber,
        measuredValue: z.number().finite().nonnegative(),
        unit: z.string().min(1).max(20),
        note: optionalText(500),
      })
      .parse({
        kind: str(form, "kind"),
        declaredValue: num(form, "declaredValue"),
        measuredValue: num(form, "measuredValue"),
        unit: str(form, "unit"),
        note: str(form, "note") || null,
      });
    if (!(await getStore().get("products", productId)))
      throw new Error("product_not_found");
    const [photo] = files(form, "photo");
    await addMeasurement(user, "product", productId, {
      ...parsed,
      photo: photo ?? null,
    });
    return `/app/products/${productId}#measurements`;
  });
}

export async function savePurchaseScheduleAction(form: FormData) {
  const user = await requireUser();
  const productId = str(form, "productId");
  await run(`/app/products/${productId}`, async () => {
    assertWellmix(user);
    const store = getStore();
    const product = await store.get("products", productId);
    if (!product) throw new Error("product_not_found");
    const parsed = z
      .object({
        sequence: optionalInt,
        quantity: z.number().finite().positive(),
        unit: z.string().min(1).max(20),
        scheduledFor: z.string().nullable(),
        periodLabel: optionalText(60),
        supplierId: z.string().nullable(),
        customerId: z.string().nullable(),
        price: optionalNumber,
        currency: currencySchema,
        status: z.enum(SCHEDULE_STATUSES),
        notes: z.string().nullable(),
      })
      .parse({
        sequence: num(form, "sequence"),
        quantity: num(form, "quantity"),
        unit: str(form, "unit") || "un",
        scheduledFor: dateToIso(str(form, "scheduledFor")),
        periodLabel: str(form, "periodLabel") || null,
        supplierId: str(form, "supplierId") || null,
        customerId: str(form, "customerId") || null,
        price: num(form, "price"),
        currency: str(form, "currency")
          ? parseCurrency(str(form, "currency"))
          : null,
        status: str(form, "status") || "planned",
        notes: str(form, "notes") || null,
      });
    // Fornecedor e cliente, quando informados, precisam existir com o tipo certo.
    for (const [key, type] of [
      ["supplierId", "supplier"],
      ["customerId", "customer"],
    ] as const) {
      const partyId = parsed[key];
      if (!partyId) continue;
      const party = await store.get("parties", partyId);
      if (!party || party.type !== type) throw new Error(`${type}_not_found`);
    }
    const existing = await store.list("purchase_schedules", {
      filter: { productId },
    });
    const sequence =
      parsed.sequence ??
      existing.reduce((max, s) => Math.max(max, s.sequence), 0) + 1;
    const schedule = await store.create("purchase_schedules", {
      ...parsed,
      sequence,
      productId,
      sourcingItemId: product.sourcingItemId ?? null,
      requestId: null,
      orderId: null,
      createdByUserId: user.id,
    });
    await audit(
      user,
      "schedule.create",
      "purchase_schedule",
      schedule.id,
      `${product.name}: #${sequence} ${parsed.quantity} ${parsed.unit}`,
    );
    return `/app/products/${productId}#schedules`;
  });
}

export async function setScheduleStatusAction(form: FormData) {
  const user = await requireUser();
  const productId = str(form, "productId");
  await run(`/app/products/${productId}`, async () => {
    assertWellmix(user);
    const parsed = z
      .object({
        scheduleId: z.string().min(1),
        status: z.enum(SCHEDULE_STATUSES),
      })
      .parse({
        scheduleId: str(form, "scheduleId"),
        status: str(form, "status"),
      });
    const store = getStore();
    const schedule = await store.get("purchase_schedules", parsed.scheduleId);
    if (!schedule || schedule.productId !== productId)
      throw new Error("schedule_not_found");
    await store.update("purchase_schedules", parsed.scheduleId, {
      status: parsed.status,
    });
    await audit(
      user,
      "schedule.status",
      "purchase_schedule",
      parsed.scheduleId,
      `${schedule.status} → ${parsed.status}`,
    );
    return `/app/products/${productId}#schedules`;
  });
}

/** Campos de sourcing do parceiro (cidade, endereço, contato, WeChat); o cadastro básico segue em savePartyAction. */
export async function updatePartyExtraAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(`/app/parties/${id}`, async () => {
    assertWellmix(user);
    const store = getStore();
    const party = await store.get("parties", id);
    if (!party) throw new Error("party_not_found");
    const parsed = z
      .object({
        city: optionalText(80),
        address: optionalText(255),
        contactName: optionalText(120),
        wechat: optionalText(80),
        storeNumber: optionalText(60),
        bankBeneficiary: optionalText(160),
        bankName: optionalText(160),
        bankAccount: optionalText(80),
        bankSwift: optionalText(20),
        bankAddress: optionalText(255),
      })
      .parse({
        city: str(form, "city") || null,
        address: str(form, "address") || null,
        contactName: str(form, "contactName") || null,
        wechat: str(form, "wechat") || null,
        storeNumber: str(form, "storeNumber") || null,
        bankBeneficiary: str(form, "bankBeneficiary") || null,
        bankName: str(form, "bankName") || null,
        bankAccount: str(form, "bankAccount") || null,
        bankSwift: str(form, "bankSwift")
          ? str(form, "bankSwift").toUpperCase()
          : null,
        bankAddress: str(form, "bankAddress") || null,
      });
    // Dados bancários só vão para o banco quando mudam: editar o parceiro
    // continua funcionando mesmo antes de as colunas novas serem publicadas.
    const bankKeys = [
      "bankBeneficiary",
      "bankName",
      "bankAccount",
      "bankSwift",
      "bankAddress",
      "storeNumber",
    ] as const;
    const update: Partial<typeof parsed> = {
      city: parsed.city,
      address: parsed.address,
      contactName: parsed.contactName,
      wechat: parsed.wechat,
    };
    for (const key of bankKeys)
      if (parsed[key] !== (party[key] ?? null)) update[key] = parsed[key];
    await store.update("parties", id, update);
    await audit(
      user,
      "party.update",
      "party",
      id,
      party.name,
      {
        city: party.city,
        address: party.address,
        contactName: party.contactName,
        wechat: party.wechat,
        storeNumber: party.storeNumber ?? null,
        bankBeneficiary: party.bankBeneficiary,
        bankName: party.bankName,
        bankAccount: party.bankAccount,
        bankSwift: party.bankSwift,
        bankAddress: party.bankAddress,
      },
      parsed,
    );
    return `/app/parties/${id}?saved=1`;
  });
}

/* ------------------------------------------------------------------------ */
/* Segunda Onda: faixas de preço e demanda de cliente                        */
/* ------------------------------------------------------------------------ */

/** Faixas negociadas da ficha (base da oportunidade de compra). Texto "quantidade;preço" por linha. */
export async function saveProductPriceTiersAction(form: FormData) {
  const user = await requireUser();
  const productId = str(form, "productId");
  await run(`/app/products/${productId}`, async () => {
    assertWellmix(user);
    const store = getStore();
    const product = await store.get("products", productId);
    if (!product) throw new Error("product_not_found");
    const tiers = parsePriceTiers(
      z.string().max(5000).parse(str(form, "tiers")),
    );
    await store.update("products", productId, {
      priceTiers: tiers.length ? tiers : null,
    });
    await audit(
      user,
      "product.priceTiers",
      "product",
      productId,
      `${product.name}: ${tiers.length} faixa(s)`,
      { priceTiers: product.priceTiers },
      { priceTiers: tiers },
    );
    const qty = num(form, "qty");
    return `/app/products/${productId}${qty ? `?qty=${qty}` : ""}#opportunity`;
  });
}

/** Faixas negociadas no item de sourcing; copiadas para a ficha ao promover. */
export async function saveSourcingPriceTiersAction(form: FormData) {
  const user = await requireUser();
  const itemId = str(form, "itemId");
  await run(`/app/sourcing/items/${itemId}`, async () => {
    assertWellmix(user);
    const store = getStore();
    const item = await store.get("sourcing_items", itemId);
    if (!item) throw new Error("item_not_found");
    const tiers = parsePriceTiers(
      z.string().max(5000).parse(str(form, "tiers")),
    );
    await store.update("sourcing_items", itemId, {
      priceTiers: tiers.length ? tiers : null,
    });
    await audit(
      user,
      "sourcing.priceTiers",
      "sourcing_item",
      itemId,
      `${item.name}: ${tiers.length} faixa(s)`,
      { priceTiers: item.priceTiers },
      { priceTiers: tiers },
    );
    return `/app/sourcing/items/${itemId}#tiers`;
  });
}

/** Vincula (ou desvincula) o item de sourcing à solicitação do cliente que o motivou. */
export async function linkSourcingItemRequestAction(form: FormData) {
  const user = await requireUser();
  const itemId = str(form, "itemId");
  await run(`/app/sourcing/items/${itemId}`, async () => {
    assertWellmix(user);
    const store = getStore();
    const item = await store.get("sourcing_items", itemId);
    if (!item) throw new Error("item_not_found");
    const requestId = z
      .string()
      .max(80)
      .nullable()
      .parse(str(form, "requestId") || null);
    if (requestId) {
      const request = await store.get("requests", requestId);
      if (!request) throw new Error("request_not_found");
      // Só solicitações sem produto do catálogo (ou já apontando para o produto deste item).
      if (request.productId && request.productId !== item.productId)
        throw new Error("request_has_product");
    }
    await store.update("sourcing_items", itemId, { requestId });
    await audit(
      user,
      "sourcing.request",
      "sourcing_item",
      itemId,
      `${item.name}: ${item.requestId ?? "—"} → ${requestId ?? "—"}`,
      { requestId: item.requestId },
      { requestId },
    );
    return `/app/sourcing/items/${itemId}#tiers`;
  });
}
