import "server-only";

import { getStore, type User } from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { BOOKING_BULK_MAX } from "@/lib/booking";
import { audit } from "./audit";
import { BookingRefusal } from "./booking";
import type { SheetInput } from "./purchase-sheet";

/*
 * Booking (docs/BOOKING.md, "Editar dados"): os dados do produto mudados
 * direto na tabela do Booking. Grava pelos mesmos caminhos da página do
 * produto, para o cadastro e a ficha mestre nunca ficarem diferentes:
 * - fornecedor: a troca do principal (setMainSupplier), como no cadastro;
 * - nome e medidas da peça: colunas do produto (com a especificação
 *   automática remontada, como no cadastro);
 * - o resto (código, local, loja, data da ficha, preço, moeda, MOQ, caixa,
 *   inner, pesos, média, CBM, cores, material, embalagem): ficha mestre, que
 *   espelha no cadastro (saveProductSheet).
 * Só a Wellmix com as telas Booking e Produtos, e só produto que tem linha
 * no Booking. Tudo é conferido antes de gravar: um valor inválido recusa o
 * envio inteiro e aponta a linha.
 */

/** O que mudou num produto (só os campos presentes mudam). */
export interface BookingProductEdit {
  productId: string;
  /** Fornecedor principal escolhido (id de uma empresa fornecedora). */
  supplierId?: string;
  name?: string;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  /** Campos da ficha mestre (já lidos e conferidos). */
  sheet: SheetInput;
  /** Campos que não deu para ler: recusa o envio, apontando a linha. */
  invalid?: string[];
}

export async function saveBookingProductEdits(
  user: User,
  edits: BookingProductEdit[],
): Promise<number> {
  assertWellmix(user);
  assertScreen(user, "booking");
  // Mudar o produto é editar o cadastro: pede também a tela Produtos.
  assertScreen(user, "products");
  if (!edits.length) return 0;
  if (edits.length > BOOKING_BULK_MAX)
    throw new BookingRefusal("booking_too_many");
  const store = getStore();
  const ids = [...new Set(edits.map((e) => e.productId))];
  const [products, bookings] = await Promise.all([
    store.list("products", { filter: { id: ids } }),
    store.list("bookings", { filter: { productId: ids } }),
  ]);
  const productOf = new Map(products.map((p) => [p.id, p]));
  const rowOf = new Map(bookings.map((b) => [b.productId, b.id]));

  // Confere tudo antes de gravar qualquer coisa.
  const supplierIds = [
    ...new Set(edits.map((e) => e.supplierId).filter((s): s is string => !!s)),
  ];
  const suppliers = supplierIds.length
    ? await store.list("parties", { filter: { id: supplierIds } })
    : [];
  const validSupplier = new Set(
    suppliers.filter((p) => p.type === "supplier").map((p) => p.id),
  );
  for (const edit of edits) {
    const rowId = rowOf.get(edit.productId) ?? null;
    // Produto sem linha no Booking não é editado por esta tela.
    if (!rowId || !productOf.has(edit.productId))
      throw new BookingRefusal("booking_not_found", rowId);
    if (edit.invalid?.length)
      throw new BookingRefusal("booking_data_invalid", rowId);
    if (edit.supplierId && !validSupplier.has(edit.supplierId))
      throw new BookingRefusal("booking_data_invalid", rowId);
    if (
      edit.name !== undefined &&
      (edit.name.trim().length < 2 || edit.name.trim().length > 160)
    )
      throw new BookingRefusal("booking_data_invalid", rowId);
  }

  const { saveProductSheet, autoProductSpec, getProductSheet } =
    await import("./product-sheet");
  const { sameSpec } = await import("@/lib/product-spec");
  let saved = 0;
  for (const edit of edits) {
    let product = productOf.get(edit.productId)!;
    let touched = false;
    // 1. Fornecedor primeiro: a troca traz os dados do novo; o que a pessoa
    //    digitou nesta mesma vez (preço, código...) vem depois e prevalece.
    if (edit.supplierId && edit.supplierId !== product.supplierId) {
      const { setMainSupplier } = await import("./product-suppliers");
      await setMainSupplier(user, product.id, edit.supplierId);
      product = (await store.get("products", product.id)) ?? product;
      touched = true;
    }
    // 2. Nome e medidas da peça (colunas do produto).
    const columns: Record<string, unknown> = {};
    if (edit.name !== undefined && edit.name.trim() !== product.name)
      columns.name = edit.name.trim();
    for (const key of ["lengthCm", "widthCm", "heightCm"] as const)
      if (edit[key] !== undefined && edit[key] !== product[key])
        columns[key] = edit[key];
    if (Object.keys(columns).length) {
      const master = await getProductSheet(product.id);
      const next = { ...product, ...columns };
      // Especificação automática (vazia ou a montada com os dados de antes)
      // acompanha; a escrita à mão fica.
      const before = autoProductSpec(product, master);
      if (!product.specification || sameSpec(product.specification, before))
        columns.specification = autoProductSpec(next, master) || null;
      const updated = await store.update("products", product.id, columns);
      await audit(
        user,
        "product.update",
        "product",
        product.id,
        `${updated.name} (Booking: dados do produto)`,
        Object.fromEntries(
          Object.keys(columns).map((k) => [
            k,
            (product as unknown as Record<string, unknown>)[k],
          ]),
        ),
        columns,
      );
      product = updated;
      touched = true;
    }
    // 3. Ficha mestre (espelha no cadastro).
    if (Object.keys(edit.sheet).length) {
      await saveProductSheet(user, product.id, edit.sheet);
      touched = true;
    }
    if (touched) saved++;
  }
  return saved;
}
