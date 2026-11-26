import type { PartyType } from "@/lib/db/schema";
import { FAMILY_PARTY_TYPES } from "@/lib/party-families";

/*
 * O fornecedor do Sankhya (FORNECEDOR = S) no portal, pelo código (CODPARC).
 *
 * O cadastro que a Wellmix troca de Fornecedor para Trading, Supplier ou
 * Factory continua sendo o daquele código: a carga o encontra e o atualiza,
 * sem mudar o tipo, em vez de criar outro Fornecedor com o mesmo código. Foi
 * assim que a NINGBO HOME-IN ficou duplicada (Trading desde 17/11/2026 e um
 * Fornecedor novo na carga de 20/11/2026; mesclados pelo dono em 26/11/2026).
 */

/**
 * Tipos que valem como o fornecedor do Sankhya: os mesmos da cotação de
 * compra (Fornecedor, Trading, Supplier e Factory), que vencem e viram o
 * fornecedor da solicitação e do pedido (docs/PARTNER_FAMILIES.md).
 */
export const SANKHYA_SUPPLIER_TYPES: readonly PartyType[] = FAMILY_PARTY_TYPES;

export const isSankhyaSupplierType = (type: string | null | undefined) =>
  !!type && (SANKHYA_SUPPLIER_TYPES as readonly string[]).includes(type);

type Coded = { type: PartyType; sankhyaCode?: string | null };

/** Com dois cadastros no mesmo código, o Fornecedor vence (como era antes). */
const better = <T extends Coded>(current: T | undefined, next: T) =>
  !current || (current.type !== "supplier" && next.type === "supplier");

/** O cadastro do fornecedor de um código do Sankhya (nenhum: indefinido). */
export function findSankhyaSupplier<T extends Coded>(
  parties: readonly T[],
  code: string,
  key: (code: string) => string = (c) => c,
): T | undefined {
  let found: T | undefined;
  for (const p of parties)
    if (
      p.sankhyaCode &&
      isSankhyaSupplierType(p.type) &&
      key(p.sankhyaCode) === code &&
      better(found, p)
    )
      found = p;
  return found;
}

/** Código do Sankhya → cadastro do fornecedor, um por código. */
export function sankhyaSuppliersByCode<T extends Coded>(
  parties: readonly T[],
  key: (code: string) => string = (c) => c,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const p of parties) {
    if (!p.sankhyaCode || !isSankhyaSupplierType(p.type)) continue;
    const k = key(p.sankhyaCode);
    if (better(map.get(k), p)) map.set(k, p);
  }
  return map;
}
