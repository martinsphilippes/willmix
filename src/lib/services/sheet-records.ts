import "server-only";
import { getStore } from "@/lib/db";
import type { Party, Product, User } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";
import { fillLinkCode, productSupplierLink } from "./product-suppliers";

/*
 * Bloco "Fornecedor" da ficha de compra vem dos cadastros: local (cidade),
 * nº da loja e telefone do cadastro do fornecedor; código do item na fábrica
 * do cadastro do produto. A ficha nasce com esses valores e, ao ser salva,
 * completa o que o cadastro ainda não tinha (só campos vazios), para a
 * próxima ficha já vir preenchida.
 */

export const RECORD_FIELDS = [
  "location",
  "supplierStore",
  "supplierPhone",
  "factoryItemCode",
] as const;
export type RecordField = (typeof RECORD_FIELDS)[number];

type RecordValues = Partial<Record<RecordField | "supplierName", string>>;
type SheetLike = Partial<Record<RecordField, string | null>>;

const clean = (v: string | null | undefined) => {
  const s = (v ?? "").trim();
  return s ? s : null;
};

/** Valores que o cadastro tem (só os preenchidos): prevalecem na ficha. */
export function recordFields(
  supplier:
    | Pick<Party, "id" | "name" | "city" | "phone" | "storeNumber">
    | null
    | undefined,
  product: Pick<Product, "supplierSku" | "supplierId"> | null | undefined,
): RecordValues {
  const out: RecordValues = {};
  const name = clean(supplier?.name);
  const city = clean(supplier?.city);
  const store = clean(supplier?.storeNumber);
  const phone = clean(supplier?.phone);
  // Código na fábrica é do fornecedor do produto: não vai para a ficha de outro.
  const sku = productOfSupplier(supplier, product)
    ? clean(product?.supplierSku)
    : null;
  if (name) out.supplierName = name;
  if (city) out.location = city;
  if (store) out.supplierStore = store;
  if (phone) out.supplierPhone = phone;
  if (sku) out.factoryItemCode = sku;
  return out;
}

/** O produto é deste fornecedor (sem fornecedor no cadastro, não é de ninguém). */
export function productOfSupplier(
  supplier: Pick<Party, "id"> | null | undefined,
  product: Pick<Product, "supplierId"> | null | undefined,
) {
  return (
    !!product && !!product.supplierId && product.supplierId === supplier?.id
  );
}

/**
 * Produto visto por um fornecedor: o dono usa o código do produto; outro
 * fornecedor do produto (vínculo em `product_suppliers`) usa o código dele;
 * quem não é fornecedor do produto não recebe código nenhum.
 */
export function productForSupplier(
  product: Pick<Product, "supplierSku" | "supplierId"> | null | undefined,
  supplierId: string | null | undefined,
  link: { supplierId: string; supplierSku: string | null } | null | undefined,
): Pick<Product, "supplierSku" | "supplierId"> | null {
  if (!product) return null;
  if (supplierId && productOfSupplier({ id: supplierId }, product))
    return product;
  if (link && link.supplierId === supplierId)
    return { supplierId: link.supplierId, supplierSku: link.supplierSku };
  return product;
}

/** O que falta no cadastro para a ficha nascer completa. */
export function missingRecordFields(
  supplier:
    Pick<Party, "id" | "city" | "phone" | "storeNumber"> | null | undefined,
  product: Pick<Product, "supplierSku" | "supplierId"> | null | undefined,
): RecordField[] {
  const has = recordFields(
    supplier ? { ...supplier, name: "" } : null,
    product,
  );
  return RECORD_FIELDS.filter((k) =>
    k === "factoryItemCode"
      ? productOfSupplier(supplier, product) && !has[k]
      : !!supplier && !has[k],
  );
}

/** Resumo para a tela: de onde vêm os campos e o que falta cadastrar. */
export interface SheetRecords {
  supplierId: string | null;
  productId: string | null;
  /** O produto do catálogo é deste fornecedor (o código na fábrica vale aqui). */
  productApplies: boolean;
  missing: RecordField[];
  /** Valores que o cadastro tem (preenchem os campos em branco da ficha). */
  values: RecordValues;
  /** Wellmix pode completar o cadastro pela tela do parceiro/produto. */
  canEdit: boolean;
}

export async function sheetRecords(
  user: User,
  supplierId: string | null | undefined,
  productId: string | null | undefined,
): Promise<SheetRecords> {
  const store = getStore();
  const [supplier, product] = await Promise.all([
    supplierId ? store.get("parties", supplierId) : null,
    productId ? store.get("products", productId) : null,
  ]);
  const link =
    supplier && product && !productOfSupplier(supplier, product)
      ? await productSupplierLink(product.id, supplier.id)
      : null;
  const seen = productForSupplier(product, supplier?.id, link);
  return {
    supplierId: supplier?.id ?? null,
    productId: product?.id ?? null,
    productApplies: productOfSupplier(supplier, seen),
    missing: missingRecordFields(supplier, seen),
    values: recordFields(supplier, seen),
    canEdit: isWellmix(user),
  };
}

/** Ficha já gravada: campos do bloco Fornecedor em branco ganham o valor do cadastro (só na tela). */
export function withRecordDefaults<T extends SheetLike>(
  sheet: T,
  records: Pick<SheetRecords, "values">,
): T {
  const out = { ...sheet };
  for (const k of RECORD_FIELDS)
    if (!clean(out[k]) && records.values[k]) out[k] = records.values[k];
  return out;
}

/**
 * Ao salvar a ficha, grava no cadastro o que ele não tinha: cidade, nº da
 * loja e telefone no fornecedor; código na fábrica no produto (só quando o
 * produto é desse fornecedor). Nunca sobrescreve o que já está cadastrado.
 * Quem pode: Wellmix ou o próprio fornecedor. Falha aqui não derruba a ficha.
 */
export async function fillRecordsFromSheet(
  user: User,
  supplierId: string | null | undefined,
  productId: string | null | undefined,
  sheet: SheetLike,
): Promise<RecordField[]> {
  if (!supplierId) return [];
  const own = user.role === "supplier" && user.partyId === supplierId;
  if (!isWellmix(user) && !own) return [];
  const store = getStore();
  const filled: RecordField[] = [];
  const supplier = await store.get("parties", supplierId);
  if (supplier && supplier.type === "supplier") {
    const patch: Partial<Party> = {};
    const location = clean(sheet.location);
    const storeNumber = clean(sheet.supplierStore);
    const phone = clean(sheet.supplierPhone);
    if (!clean(supplier.city) && location) {
      patch.city = location.slice(0, 80);
      filled.push("location");
    }
    if (!clean(supplier.storeNumber) && storeNumber) {
      patch.storeNumber = storeNumber.slice(0, 60);
      filled.push("supplierStore");
    }
    if (!clean(supplier.phone) && phone) {
      patch.phone = phone.slice(0, 40);
      filled.push("supplierPhone");
    }
    // Nº da loja é coluna nova: vai em separado, para cidade e telefone
    // entrarem mesmo antes de o esquema ser publicado.
    const { storeNumber: storePatch, ...basePatch } = patch;
    for (const [part, keys] of [
      [basePatch, ["location", "supplierPhone"] as RecordField[]],
      [storePatch ? { storeNumber: storePatch } : {}, ["supplierStore"]],
    ] as const) {
      if (!Object.keys(part).length) continue;
      try {
        await store.update("parties", supplier.id, part);
        await audit(
          user,
          "party.record_from_sheet",
          "party",
          supplier.id,
          `Cadastro completado pela ficha: ${Object.keys(part).join(", ")}`,
          null,
          part,
        );
      } catch (error) {
        // Coluna ainda não publicada ou falha de rede: a ficha já está salva.
        console.warn("[sheet-records] party write-back failed", error);
        for (const k of keys) {
          const i = filled.indexOf(k);
          if (i >= 0) filled.splice(i, 1);
        }
      }
    }
  }
  const sku = clean(sheet.factoryItemCode);
  if (productId && sku) {
    const product = await store.get("products", productId);
    // Só no produto desse fornecedor, seja quem for o usuário: produto sem
    // fornecedor não é de ninguém (a Wellmix define o dono na tela do produto).
    // Outro fornecedor do produto: o código vai para o vínculo dele (nunca para o produto).
    if (product && !productOfSupplier({ id: supplierId }, product)) {
      if (await fillLinkCode(user, product.id, supplierId, sku))
        filled.push("factoryItemCode");
    } else if (
      product &&
      !clean(product.supplierSku) &&
      productOfSupplier({ id: supplierId }, product)
    ) {
      try {
        await store.update("products", product.id, {
          supplierSku: sku.slice(0, 60),
        });
        await audit(
          user,
          "product.record_from_sheet",
          "product",
          product.id,
          `Código no fornecedor completado pela ficha: ${sku.slice(0, 60)}`,
          null,
          { supplierSku: sku.slice(0, 60) },
        );
        filled.push("factoryItemCode");
      } catch (error) {
        console.warn("[sheet-records] product write-back failed", error);
      }
    }
  }
  return filled;
}
