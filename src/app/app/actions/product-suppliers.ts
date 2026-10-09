"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { requireUser, run, str } from "./helpers";

/*
 * Fornecedores do produto (vários por produto). Tudo só Wellmix; quem
 * responde uma cotação entra sozinho (services/product-suppliers.ts).
 */

const ID = z.string().min(1).max(64);
const CODE = z.string().max(60);

function ids(form: FormData) {
  return {
    productId: ID.parse(str(form, "productId")),
    supplierId: ID.parse(str(form, "supplierId")),
  };
}

const back = (productId: string) =>
  `/app/products/${encodeURIComponent(productId)}`;

/** Acrescenta um fornecedor cadastrado ao produto (com o código dele, se souber). */
export async function addProductSupplierAction(form: FormData) {
  const user = await requireUser();
  const productId = ID.parse(str(form, "productId"));
  await run(back(productId), async () => {
    assertWellmix(user);
    const { supplierId } = ids(form);
    const code = CODE.parse(str(form, "supplierSku"));
    const { addProductSupplier } =
      await import("@/lib/services/product-suppliers");
    await addProductSupplier(user, productId, supplierId, code || null);
    return `${back(productId)}?suppliers=added#suppliers`;
  });
}

/** Código do item na fábrica de um fornecedor do produto. */
export async function setProductSupplierCodeAction(form: FormData) {
  const user = await requireUser();
  const productId = ID.parse(str(form, "productId"));
  await run(back(productId), async () => {
    assertWellmix(user);
    const { supplierId } = ids(form);
    const code = CODE.parse(str(form, "supplierSku"));
    const { setProductSupplierCode } =
      await import("@/lib/services/product-suppliers");
    await setProductSupplierCode(user, productId, supplierId, code || null);
    return `${back(productId)}?suppliers=saved#suppliers`;
  });
}

/** Torna o fornecedor o principal do produto (ficha mestre e código). */
export async function setMainSupplierAction(form: FormData) {
  const user = await requireUser();
  const productId = ID.parse(str(form, "productId"));
  await run(back(productId), async () => {
    assertWellmix(user);
    const { supplierId } = ids(form);
    const { setMainSupplier } =
      await import("@/lib/services/product-suppliers");
    await setMainSupplier(user, productId, supplierId);
    return `${back(productId)}?suppliers=main#suppliers`;
  });
}

/** Tira o fornecedor da lista do produto (o principal não sai). */
export async function removeProductSupplierAction(form: FormData) {
  const user = await requireUser();
  const productId = ID.parse(str(form, "productId"));
  await run(back(productId), async () => {
    assertWellmix(user);
    const { supplierId } = ids(form);
    const { removeProductSupplier } =
      await import("@/lib/services/product-suppliers");
    await removeProductSupplier(user, productId, supplierId);
    return `${back(productId)}?suppliers=removed#suppliers`;
  });
}
