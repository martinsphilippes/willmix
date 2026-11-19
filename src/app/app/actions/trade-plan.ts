"use server";

import { z } from "zod";
import { TRADE_ACTIVITY_STATUSES } from "@/lib/db/schema";
import { files, requireUser, run, str } from "./helpers";

/*
 * Plano de ação Trade (dono, 18/11/2026; docs/TRADE_COMERCIAL.md, PR 2): criar
 * e editar a ação (quem gere a carteira) e avançar a situação com a resposta
 * e as evidências (o responsável ou quem gere). As regras ficam no serviço
 * (src/lib/services/trade-plan.ts); aqui, a leitura do formulário.
 */

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const optionalId = z.union([z.literal(""), idSchema]);

/** Volta só para telas da carteira (o formulário diz de onde veio). */
function backOf(form: FormData, fallback: string): string {
  const v = str(form, "back");
  return /^\/app\/portfolio(\/[A-Za-z0-9_-]{1,64}){0,2}(\?[A-Za-z0-9_=&-]{0,200})?(#[a-z-]{1,40})?$/.test(
    v,
  )
    ? v
    : fallback;
}

const inputOf = (form: FormData) =>
  z
    .object({
      title: z.string().max(200),
      description: z.string().max(4000).nullable(),
      customerId: optionalId,
      groupId: optionalId,
      productCode: z
        .union([z.literal(""), z.string().regex(/^\d{1,20}$/)])
        .nullable(),
      productName: z.string().max(300).nullable(),
      focus: z
        .union([z.literal(""), z.string().regex(/^[a-z]{1,20}$/)])
        .nullable(),
      responsibleUserId: idSchema,
      dueDate: z.string().max(10),
    })
    .parse({
      title: str(form, "title"),
      description: str(form, "description") || null,
      customerId: str(form, "customerId"),
      groupId: str(form, "groupId"),
      productCode: str(form, "productCode") || null,
      productName: str(form, "productName") || null,
      focus: str(form, "focus") || null,
      responsibleUserId: str(form, "responsibleUserId"),
      dueDate: str(form, "dueDate"),
    });

const service = () => import("@/lib/services/trade-plan");

export async function createTradeActivityAction(form: FormData) {
  const user = await requireUser();
  await run(backOf(form, "/app/portfolio/plan#new"), async () => {
    const input = inputOf(form);
    const svc = await service();
    const created = await svc.createTradeActivity(user, {
      ...input,
      customerId: input.customerId || null,
      groupId: input.groupId || null,
      productCode: input.productCode || null,
      focus: input.focus || null,
    });
    return `/app/portfolio/plan/${created.id}?created=1`;
  });
}

export async function updateTradeActivityAction(form: FormData) {
  const user = await requireUser();
  const activityId = idSchema.parse(str(form, "activityId"));
  await run(`/app/portfolio/plan/${activityId}#edit`, async () => {
    const input = inputOf(form);
    const svc = await service();
    await svc.updateTradeActivity(user, activityId, {
      ...input,
      customerId: input.customerId || null,
      groupId: input.groupId || null,
    });
    return `/app/portfolio/plan/${activityId}?saved=1`;
  });
}

export async function setTradeActivityStatusAction(form: FormData) {
  const user = await requireUser();
  const activityId = idSchema.parse(str(form, "activityId"));
  await run(`/app/portfolio/plan/${activityId}#status`, async () => {
    const input = z
      .object({
        status: z.enum(TRADE_ACTIVITY_STATUSES),
        notes: z.string().max(4000).nullable(),
      })
      .parse({
        status: str(form, "status"),
        notes: str(form, "notes") || null,
      });
    const svc = await service();
    await svc.setTradeActivityStatus(user, activityId, {
      ...input,
      files: files(form, "files"),
    });
    return `/app/portfolio/plan/${activityId}?status=1#status`;
  });
}
