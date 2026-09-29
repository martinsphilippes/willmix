"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import {
  getStore,
  MEASUREMENT_KINDS,
  PHOTO_KINDS,
  SOURCING_STATUSES,
  VISIT_STATUSES,
} from "@/lib/db";
import { audit } from "@/lib/services/audit";
import {
  addMeasurement,
  addPhotos,
  promoteSourcingItem,
  saveSourcingItem,
  saveVisit,
  setPrimaryPhoto,
  setSourcingItemStatus,
} from "@/lib/services/sourcing";
import { files, num, requireUser, run, str } from "./helpers";

/*
 * Sourcing (Wellmix): visitas, produtos encontrados, fotos por tipo,
 * evidência de peso e promoção a produto. Toda escrita passa por aqui com
 * zod e checagem de papel; o serviço audita (e, onde não audita, auditamos aqui).
 */

const optional = () => z.string().nullable();
const optionalNumber = () => z.number().nonnegative().nullable();
const CURRENCIES = ["USD", "CNY", "BRL", "EUR"] as const;

/** Campo type="date" (AAAA-MM-DD) → ISO ao meio-dia UTC, para o dia não mudar em nenhum fuso. */
function dateField(form: FormData, key: string): string | null {
  const v = str(form, key);
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T12:00:00.000Z`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Fornecedor: cadastrado (id) e/ou nome livre; o nome do cadastrado é copiado para exibição. */
async function resolveSupplier(form: FormData) {
  const store = getStore();
  const supplierId = str(form, "supplierId") || null;
  const other = str(form, "supplierName") || null;
  const party = supplierId ? await store.get("parties", supplierId) : null;
  return {
    supplierId: party ? party.id : null,
    supplierName: other ?? party?.name ?? null,
  };
}

/* ------------------------------------------------------------------------ */
/* Visitas                                                                   */
/* ------------------------------------------------------------------------ */

const visitSchema = z.object({
  supplierId: optional(),
  supplierName: optional(),
  factoryName: optional(),
  city: optional(),
  address: optional(),
  location: optional(),
  visitedAt: z.string().min(1),
  participants: optional(),
  notes: optional(),
  nextVisitAt: optional(),
  followUp: optional(),
  status: z.enum(VISIT_STATUSES),
});

export async function saveVisitAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id") || null;
  await run(
    id ? `/app/sourcing/visits/${id}` : "/app/sourcing/visits/new",
    async () => {
      assertWellmix(user);
      const supplier = await resolveSupplier(form);
      const parsed = visitSchema.parse({
        ...supplier,
        factoryName: str(form, "factoryName") || null,
        city: str(form, "city") || null,
        address: str(form, "address") || null,
        location: str(form, "location") || null,
        visitedAt: dateField(form, "visitedAt") ?? "",
        participants: str(form, "participants") || null,
        notes: str(form, "notes") || null,
        nextVisitAt: dateField(form, "nextVisitAt"),
        followUp: str(form, "followUp") || null,
        status: str(form, "status") || "done",
      });
      if (!parsed.supplierId && !parsed.supplierName && !parsed.factoryName)
        throw new Error("supplier_required");
      const visit = await saveVisit(user, parsed, id);
      return `/app/sourcing/visits/${visit.id}`;
    },
  );
}

/* ------------------------------------------------------------------------ */
/* Produtos encontrados                                                      */
/* ------------------------------------------------------------------------ */

const itemSchema = z.object({
  visitId: optional(),
  supplierId: optional(),
  supplierName: optional(),
  lineId: optional(),
  category: optional(),
  name: z.string().min(1).max(160),
  description: optional(),
  supplierSku: optional(),
  material: optional(),
  color: optional(),
  pantone: optional(),
  price: optionalNumber(),
  currency: z.enum(CURRENCIES).nullable(),
  moq: z.number().int().nonnegative().nullable(),
  masterBoxQty: z.number().int().nonnegative().nullable(),
  innerBoxQty: z.number().int().nonnegative().nullable(),
  netWeightKg: optionalNumber(),
  grossWeightKg: optionalNumber(),
  widthCm: optionalNumber(),
  heightCm: optionalNumber(),
  lengthCm: optionalNumber(),
  boxLengthCm: optionalNumber(),
  boxWidthCm: optionalNumber(),
  boxHeightCm: optionalNumber(),
  conditions: optional(),
  notes: optional(),
  foundAt: optional(),
  city: optional(),
  location: optional(),
  status: z.enum(SOURCING_STATUSES),
});

export async function saveSourcingItemAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id") || null;
  const visitId = str(form, "visitId") || null;
  const back = id
    ? `/app/sourcing/items/${id}`
    : `/app/sourcing/items/new${visitId ? `?visitId=${encodeURIComponent(visitId)}` : ""}`;
  await run(back, async () => {
    assertWellmix(user);
    const store = getStore();
    const current = id ? await store.get("sourcing_items", id) : null;
    if (id && !current) throw new Error("item_not_found");
    const supplier = await resolveSupplier(form);
    const requestedStatus = str(form, "status") || "draft";
    const parsed = itemSchema.parse({
      ...supplier,
      visitId: visitId && (await store.get("supplier_visits", visitId))
        ? visitId
        : (current?.visitId ?? null),
      lineId: str(form, "lineId") || null,
      category: str(form, "category") || null,
      name: str(form, "name"),
      description: str(form, "description") || null,
      supplierSku: str(form, "supplierSku") || null,
      material: str(form, "material") || null,
      color: str(form, "color") || null,
      pantone: str(form, "pantone") || null,
      price: num(form, "price"),
      currency: str(form, "currency") || null,
      moq: num(form, "moq"),
      masterBoxQty: num(form, "masterBoxQty"),
      innerBoxQty: num(form, "innerBoxQty"),
      netWeightKg: num(form, "netWeightKg"),
      grossWeightKg: num(form, "grossWeightKg"),
      widthCm: num(form, "widthCm"),
      heightCm: num(form, "heightCm"),
      lengthCm: num(form, "lengthCm"),
      boxLengthCm: num(form, "boxLengthCm"),
      boxWidthCm: num(form, "boxWidthCm"),
      boxHeightCm: num(form, "boxHeightCm"),
      conditions: str(form, "conditions") || null,
      notes: str(form, "notes") || null,
      foundAt: dateField(form, "foundAt") ?? new Date().toISOString(),
      city: str(form, "city") || null,
      location: str(form, "location") || null,
      // Promovido continua promovido: a ficha do catálogo é a fonte a partir daí.
      status: current?.status === "promoted" ? "promoted" : requestedStatus,
    });
    // CBM é sempre recalculado das dimensões da caixa master (nunca digitado aqui).
    const item = await saveSourcingItem(user, { ...parsed, cbm: null }, id);
    const photos = files(form, "photos");
    if (photos.length > 0) {
      await addPhotos(user, { sourcingItemId: item.id }, photos, "original");
      await audit(
        user,
        "sourcing.photo.add",
        "sourcing_item",
        item.id,
        `original: ${photos.length} foto(s)`,
      );
    }
    return `/app/sourcing/items/${item.id}`;
  });
}

const photoSchema = z.object({
  itemId: z.string().min(1),
  kind: z.enum(PHOTO_KINDS),
  caption: z.string().max(200).nullable(),
  derivedFromPhotoId: optional(),
});

export async function addSourcingPhotosAction(form: FormData) {
  const user = await requireUser();
  const itemId = str(form, "itemId");
  await run(`/app/sourcing/items/${itemId}`, async () => {
    assertWellmix(user);
    const parsed = photoSchema.parse({
      itemId,
      kind: str(form, "kind") || "original",
      caption: str(form, "caption") || null,
      derivedFromPhotoId: str(form, "derivedFromPhotoId") || null,
    });
    const store = getStore();
    const item = await store.get("sourcing_items", parsed.itemId);
    if (!item) throw new Error("item_not_found");
    const photos = files(form, "photos");
    if (photos.length === 0) throw new Error("no_photos");
    let derivedFromPhotoId: string | null = null;
    if (parsed.kind === "commercial") {
      // A imagem comercial sempre aponta para a original de que deriva (do mesmo item).
      const origin = parsed.derivedFromPhotoId
        ? await store.get("product_photos", parsed.derivedFromPhotoId)
        : null;
      if (
        !origin ||
        origin.sourcingItemId !== item.id ||
        origin.kind !== "original"
      )
        throw new Error("commercial_needs_original");
      derivedFromPhotoId = origin.id;
    }
    const added = await addPhotos(
      user,
      { sourcingItemId: item.id, productId: item.productId },
      photos,
      parsed.kind,
      { caption: parsed.caption, derivedFromPhotoId },
    );
    if (added.length === 0) throw new Error("no_photos");
    await audit(
      user,
      "sourcing.photo.add",
      "sourcing_item",
      item.id,
      `${parsed.kind}: ${added.length} foto(s)`,
    );
  });
}

export async function setPrimaryPhotoAction(form: FormData) {
  const user = await requireUser();
  const itemId = str(form, "itemId");
  await run(`/app/sourcing/items/${itemId}`, async () => {
    assertWellmix(user);
    const { photoId } = z
      .object({ photoId: z.string().min(1) })
      .parse({ photoId: str(form, "photoId") });
    const photo = await getStore().get("product_photos", photoId);
    if (!photo || photo.sourcingItemId !== itemId)
      throw new Error("photo_not_found");
    await setPrimaryPhoto(user, photoId);
    await audit(
      user,
      "sourcing.photo.primary",
      "sourcing_item",
      itemId,
      `Foto principal: ${photo.kind}`,
    );
  });
}

const measurementSchema = z.object({
  kind: z.enum(MEASUREMENT_KINDS),
  declaredValue: optionalNumber(),
  measuredValue: z.number().nonnegative(),
  unit: z.string().min(1).max(10),
  note: optional(),
});

export async function addSourcingMeasurementAction(form: FormData) {
  const user = await requireUser();
  const itemId = str(form, "itemId");
  await run(`/app/sourcing/items/${itemId}`, async () => {
    assertWellmix(user);
    const item = await getStore().get("sourcing_items", itemId);
    if (!item) throw new Error("item_not_found");
    const parsed = measurementSchema.parse({
      kind: str(form, "kind"),
      declaredValue: num(form, "declaredValue"),
      measuredValue: num(form, "measuredValue"),
      unit: str(form, "unit"),
      note: str(form, "note") || null,
    });
    const [photo] = files(form, "photo");
    await addMeasurement(user, "sourcing_item", item.id, {
      ...parsed,
      photo: photo ?? null,
    });
  });
}

export async function promoteSourcingItemAction(form: FormData) {
  const user = await requireUser();
  const itemId = str(form, "itemId");
  await run(`/app/sourcing/items/${itemId}`, async () => {
    assertWellmix(user);
    const lineId = str(form, "lineId");
    if (!lineId) throw new Error("line_required");
    const store = getStore();
    if (!(await store.get("product_lines", lineId)))
      throw new Error("line_required");
    const parsed = z
      .object({ lineId: z.string().min(1), sku: z.string().max(60).nullable() })
      .parse({ lineId, sku: str(form, "sku") || null });
    await promoteSourcingItem(user, itemId, parsed);
  });
}

export async function discardSourcingItemAction(form: FormData) {
  const user = await requireUser();
  const itemId = str(form, "itemId");
  await run(`/app/sourcing/items/${itemId}`, async () => {
    assertWellmix(user);
    await setSourcingItemStatus(user, itemId, "discarded");
  });
}
