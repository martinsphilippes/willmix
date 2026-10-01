"use server";

import { z } from "zod";
import {
  SHEET_CURRENCIES,
  SHEET_INCOTERMS,
  SHEET_POWER_SOURCES,
} from "@/lib/db/schema";
import {
  addSheetPhotos,
  saveSheet,
  SHEET_PHOTO_KINDS,
  type SheetInput,
} from "@/lib/services/purchase-sheet";
import { MAX_LOTS } from "@/lib/services/purchase-sheet-calc";
import { files, requireUser, run, str } from "./helpers";

/*
 * Ficha de compra (planilha COMPRAS) da Preparação. Só os campos presentes no
 * formulário mudam; o serviço ainda descarta o que o papel não pode editar.
 */

const ORDER_ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** Campo ausente = não mexe; vazio = limpa; número aceita vírgula decimal. */
function num(form: FormData, key: string, opts: { int?: boolean } = {}) {
  if (!form.has(key)) return undefined;
  const raw = String(form.get(key) ?? "")
    .trim()
    .replace(",", ".");
  if (!raw) return null;
  const schema = opts.int
    ? z.coerce.number().int().min(0).max(100_000_000)
    : z.coerce.number().min(0).max(100_000_000);
  return schema.parse(raw);
}
function text(form: FormData, key: string, max: number) {
  if (!form.has(key)) return undefined;
  const raw = String(form.get(key) ?? "").trim();
  return raw ? z.string().max(max).parse(raw) : null;
}
function choice<T extends readonly string[]>(
  form: FormData,
  key: string,
  values: T,
): T[number] | null | undefined {
  if (!form.has(key)) return undefined;
  const raw = String(form.get(key) ?? "").trim();
  return raw
    ? z.enum(values as unknown as [string, ...string[]]).parse(raw)
    : null;
}
function date(form: FormData, key: string) {
  if (!form.has(key)) return undefined;
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return null;
  return (
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .parse(raw) + "T00:00:00.000Z"
  );
}

function parseSheet(form: FormData): SheetInput {
  const input: SheetInput = {
    sheetDate: date(form, "sheetDate"),
    location: text(form, "location", 80),
    supplierName: text(form, "supplierName", 160),
    supplierStore: text(form, "supplierStore", 60),
    supplierPhone: text(form, "supplierPhone", 40),
    factoryItemCode: text(form, "factoryItemCode", 60),
    incoterm: choice(form, "incoterm", SHEET_INCOTERMS),
    currency: choice(form, "currency", SHEET_CURRENCIES),
    price: num(form, "price"),
    moq: num(form, "moq", { int: true }),
    masterCartonQty: num(form, "masterCartonQty", { int: true }),
    innerQty: num(form, "innerQty", { int: true }),
    netWeightPcKg: num(form, "netWeightPcKg"),
    grossWeightPcKg: num(form, "grossWeightPcKg"),
    cbmPerCarton: num(form, "cbmPerCarton"),
    heightCm: num(form, "heightCm"),
    widthCm: num(form, "widthCm"),
    lengthCm: num(form, "lengthCm"),
    capacityMl: num(form, "capacityMl"),
    packageType: text(form, "packageType", 120),
    colorAssortment: text(form, "colorAssortment", 200),
    material: text(form, "material", 200),
    powerSource: choice(form, "powerSource", SHEET_POWER_SOURCES),
    powerDetail: text(form, "powerDetail", 60),
    productionStartAt: date(form, "productionStartAt"),
    containerType: text(form, "containerType", 20),
    ecommerceDescription: text(form, "ecommerceDescription", 4000),
    notes: text(form, "notes", 2000),
    ncm: (() => {
      const v = text(form, "ncm", 12);
      return v
        ? z
            .string()
            .regex(/^[\d.]{4,12}$/)
            .parse(v)
        : v;
    })(),
    importTaxPercent: num(form, "importTaxPercent"),
    ipiPercent: num(form, "ipiPercent"),
  };
  if (form.has("lot1Cartons")) {
    input.lots = Array.from({ length: MAX_LOTS }, (_, i) => ({
      departureIntervalDays:
        num(form, `lot${i + 1}Interval`, { int: true }) ?? null,
      masterCartons: num(form, `lot${i + 1}Cartons`, { int: true }) ?? null,
    }));
  }
  for (const key of Object.keys(input) as (keyof SheetInput)[])
    if (input[key] === undefined) delete input[key];
  return input;
}

export async function savePurchaseSheetAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = `/app/orders/${encodeURIComponent(orderId)}/purchase-sheet`;
  await run(back, async () => {
    ORDER_ID.parse(orderId);
    const { missing } = await saveSheet(user, orderId, parseSheet(form));
    return `${back}?saved=${missing.length ? "partial" : "complete"}`;
  });
}

export async function addPurchaseSheetPhotosAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = `/app/orders/${encodeURIComponent(orderId)}/purchase-sheet`;
  await run(back, async () => {
    ORDER_ID.parse(orderId);
    const kind = z.enum(SHEET_PHOTO_KINDS).parse(str(form, "kind"));
    const photos = files(form, "photos");
    if (!photos.length) throw new Error("photo_required");
    await addSheetPhotos(user, orderId, kind, photos);
    return `${back}?photos=${kind}#photos`;
  });
}
