import "server-only";
import { getStore } from "@/lib/db";
import type { Party, Product, User } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";

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

function productOfSupplier(
  supplier: Pick<Party, "id"> | null | undefined,
  product: Pick<Product, "supplierId"> | null | undefined,
) {
  return (
    !!product && (!product.supplierId || product.supplierId === supplier?.id)
  );
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
  missing: RecordField[];
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
  return {
    supplierId: supplier?.id ?? null,
    productId: product?.id ?? null,
    missing: missingRecordFields(supplier, product),
    canEdit: isWellmix(user),
  };
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
    if (Object.keys(patch).length) {
      try {
        await store.update("parties", supplier.id, patch);
        await audit(
          user,
          "party.record_from_sheet",
          "party",
          supplier.id,
          `Cadastro completado pela ficha: ${Object.keys(patch).join(", ")}`,
          null,
          patch,
        );
      } catch {
        // Coluna ainda não publicada ou falha de rede: a ficha já está salva.
        filled.length = 0;
      }
    }
  }
  const sku = clean(sheet.factoryItemCode);
  if (productId && sku) {
    const product = await store.get("products", productId);
    // Só no produto desse fornecedor (ou sem fornecedor), seja quem for o usuário.
    if (
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
      } catch {
        /* idem */
      }
    }
  }
  return filled;
}
