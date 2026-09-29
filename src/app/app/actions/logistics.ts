"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { CONTAINER_STATUSES, getStore } from "@/lib/db";
import {
  addContainerItem,
  createContainer,
  removeContainerItem,
  setContainerStatus,
} from "@/lib/services/containers";
import { num, requireUser, run, str } from "./helpers";

/*
 * Containers (Wellmix): criar, mudar situação, adicionar e remover itens.
 * Toda escrita passa por aqui com zod e checagem de papel; o serviço audita
 * e mantém a fila de revisão (capacidade/peso). Erros voltam por ?error=<código>.
 */

const optional = () => z.string().nullable();
const optionalPositive = () => z.number().positive().nullable();

/** Campo type="date" (AAAA-MM-DD) → ISO ao meio-dia UTC, para o dia não mudar em nenhum fuso. */
function dateField(form: FormData, key: string): string | null {
  const v = str(form, key);
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T12:00:00.000Z`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Valida e devolve o objeto; falha vira o código curto "invalid" (traduzido na tela). */
function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error("invalid");
  return result.data;
}

const createSchema = z.object({
  code: z.string().min(1).max(40),
  type: z.string().min(1).max(20),
  customerId: optional(),
  etd: optional(),
  eta: optional(),
  notes: z.string().max(2000).nullable(),
});

export async function createContainerAction(form: FormData) {
  const user = await requireUser();
  await run("/app/containers", async () => {
    assertWellmix(user);
    const input = parse(createSchema, {
      code: str(form, "code"),
      type: str(form, "type"),
      customerId: str(form, "customerId") || null,
      etd: dateField(form, "etd"),
      eta: dateField(form, "eta"),
      notes: str(form, "notes") || null,
    });
    const container = await createContainer(user, input);
    return `/app/containers/${container.id}`;
  });
}

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(CONTAINER_STATUSES),
});

export async function setContainerStatusAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(`/app/containers/${id}`, async () => {
    assertWellmix(user);
    const input = parse(statusSchema, { id, status: str(form, "status") });
    await setContainerStatus(user, input.id, input.status);
  });
}

const itemSchema = z.object({
  containerId: z.string().min(1),
  mode: z.enum(["order", "stock"]),
  orderItemId: optional(),
  productId: optional(),
  quantity: z.number().nonnegative().nullable(),
  unitsPerBox: optionalPositive(),
  boxCount: optionalPositive(),
  cbmPerBox: optionalPositive(),
  weightPerBoxKg: z.number().nonnegative().nullable(),
});

/**
 * Adiciona um item por pedido (item do pedido → quantidade padrão do item) ou de
 * estoque (produto → quantidade obrigatória). Caixa, CBM e peso vêm da ficha do
 * produto quando vazios (regra no serviço).
 */
export async function addContainerItemAction(form: FormData) {
  const user = await requireUser();
  const containerId = str(form, "containerId");
  await run(`/app/containers/${containerId}`, async () => {
    assertWellmix(user);
    const input = parse(itemSchema, {
      containerId,
      mode: str(form, "mode"),
      orderItemId: str(form, "orderItemId") || null,
      productId: str(form, "productId") || null,
      quantity: num(form, "quantity"),
      unitsPerBox: num(form, "unitsPerBox"),
      boxCount: num(form, "boxCount"),
      cbmPerBox: num(form, "cbmPerBox"),
      weightPerBoxKg: num(form, "weightPerBoxKg"),
    });
    let orderId: string | null = null;
    let orderItemId: string | null = null;
    let productId: string | null = null;
    if (input.mode === "order") {
      if (!input.orderItemId) throw new Error("order_not_found");
      const orderItem = await getStore().get("order_items", input.orderItemId);
      if (!orderItem) throw new Error("order_not_found");
      orderId = orderItem.orderId;
      orderItemId = orderItem.id;
    } else {
      if (!input.productId) throw new Error("invalid");
      const product = await getStore().get("products", input.productId);
      if (!product) throw new Error("product_not_found");
      productId = product.id;
      if (!input.quantity || input.quantity <= 0)
        throw new Error("quantity_required");
    }
    await addContainerItem(user, input.containerId, {
      orderId,
      orderItemId,
      productId,
      quantity: input.quantity ?? 0,
      unitsPerBox: input.unitsPerBox,
      boxCount: input.boxCount,
      cbmPerBox: input.cbmPerBox,
      weightPerBoxKg: input.weightPerBoxKg,
    });
  });
}

const removeSchema = z.object({
  containerId: z.string().min(1),
  itemId: z.string().min(1),
});

export async function removeContainerItemAction(form: FormData) {
  const user = await requireUser();
  const containerId = str(form, "containerId");
  await run(`/app/containers/${containerId}`, async () => {
    assertWellmix(user);
    const input = parse(removeSchema, {
      containerId,
      itemId: str(form, "itemId"),
    });
    const item = await getStore().get("container_items", input.itemId);
    if (item && item.containerId !== input.containerId)
      throw new Error("container_not_found");
    await removeContainerItem(user, input.itemId);
  });
}
