"use server";

import { z } from "zod";
import { ATTENDANCE_CHANNELS } from "@/lib/db/schema";
import { ForbiddenError } from "@/lib/auth/permissions";
import { files, requireUser, run, str } from "./helpers";

/*
 * Carteira e atendimento (dono, 18/11/2026; docs/TRADE_COMERCIAL.md): registrar
 * o atendimento (quem atendeu), gerar outro link e cancelar; e, para quem gere
 * a carteira, grupos econômicos, responsável do cliente e o código do vendedor
 * do Sankhya no login (só o administrador). As regras ficam no serviço
 * (src/lib/services/portfolio.ts); aqui, a leitura do formulário.
 */

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const optionalId = z.union([z.literal(""), idSchema]);

/** "AAAA-MM-DDTHH:MM" do campo de data e hora, no horário de Brasília (sem horário de verão desde 2019). */
function brasiliaIso(value: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(value);
  if (!m) throw new Error("occurred_invalid");
  return `${m[1]}T${m[2]}:00-03:00`;
}

const service = () => import("@/lib/services/portfolio");

export async function registerAttendanceAction(form: FormData) {
  const user = await requireUser();
  const customerId = idSchema.parse(str(form, "customerId"));
  const back = `/app/portfolio/${customerId}#register`;
  await run(back, async () => {
    const svc = await service();
    if (!svc.canUsePortfolio(user)) throw new ForbiddenError();
    const channel = str(form, "channel");
    if (!(ATTENDANCE_CHANNELS as readonly string[]).includes(channel))
      throw new Error("channel_invalid");
    const input = z
      .object({
        summary: z.string().max(4000),
        nextStep: z.string().max(2000).nullable(),
      })
      .parse({
        summary: str(form, "summary"),
        nextStep: str(form, "nextStep") || null,
      });
    const created = await svc.registerAttendance(user, {
      customerId,
      channel: channel as (typeof ATTENDANCE_CHANNELS)[number],
      occurredAt: brasiliaIso(str(form, "occurredAt")),
      summary: input.summary,
      nextStep: input.nextStep,
      files: files(form, "files"),
    });
    return `/app/portfolio/${customerId}?registered=${created.id}#att-${created.id}`;
  });
}

export async function renewAttendanceLinkAction(form: FormData) {
  const user = await requireUser();
  const customerId = idSchema.parse(str(form, "customerId"));
  const attendanceId = idSchema.parse(str(form, "attendanceId"));
  await run(`/app/portfolio/${customerId}#att-${attendanceId}`, async () => {
    const svc = await service();
    await svc.renewAttendanceLink(user, attendanceId);
    return `/app/portfolio/${customerId}?renewed=${attendanceId}#att-${attendanceId}`;
  });
}

export async function cancelAttendanceAction(form: FormData) {
  const user = await requireUser();
  const customerId = idSchema.parse(str(form, "customerId"));
  const attendanceId = idSchema.parse(str(form, "attendanceId"));
  await run(`/app/portfolio/${customerId}#att-${attendanceId}`, async () => {
    const svc = await service();
    await svc.cancelAttendance(user, attendanceId);
    return `/app/portfolio/${customerId}?cancelled=1#history`;
  });
}

/** Grupo e responsável escolhido do cliente (quem gere a carteira). */
export async function saveCustomerPortfolioAction(form: FormData) {
  const user = await requireUser();
  const customerId = idSchema.parse(str(form, "customerId"));
  await run(`/app/portfolio/${customerId}#manage`, async () => {
    const svc = await service();
    const groupId = optionalId.parse(str(form, "groupId")) || null;
    const ownerUserId = optionalId.parse(str(form, "ownerUserId")) || null;
    await svc.setCustomerGroup(user, customerId, groupId);
    await svc.setCustomerOwner(user, customerId, ownerUserId);
    return `/app/portfolio/${customerId}?saved=1#manage`;
  });
}

const groupInput = (form: FormData) =>
  z
    .object({
      name: z.string().max(160),
      notes: z.string().max(2000).nullable(),
      ownerUserId: optionalId,
    })
    .parse({
      name: str(form, "name"),
      notes: str(form, "notes") || null,
      ownerUserId: str(form, "ownerUserId"),
    });

export async function createCustomerGroupAction(form: FormData) {
  const user = await requireUser();
  await run("/app/portfolio/groups#new", async () => {
    const svc = await service();
    const input = groupInput(form);
    const group = await svc.createCustomerGroup(user, {
      name: input.name,
      notes: input.notes,
      ownerUserId: input.ownerUserId || null,
    });
    return `/app/portfolio/groups/${group.id}?created=1`;
  });
}

export async function updateCustomerGroupAction(form: FormData) {
  const user = await requireUser();
  const groupId = idSchema.parse(str(form, "groupId"));
  await run(`/app/portfolio/groups/${groupId}`, async () => {
    const svc = await service();
    const input = groupInput(form);
    await svc.updateCustomerGroup(user, groupId, {
      name: input.name,
      notes: input.notes,
      ownerUserId: input.ownerUserId || null,
    });
    return `/app/portfolio/groups/${groupId}?saved=1`;
  });
}

export async function archiveCustomerGroupAction(form: FormData) {
  const user = await requireUser();
  const groupId = idSchema.parse(str(form, "groupId"));
  const archived = str(form, "archived") === "1";
  await run(`/app/portfolio/groups/${groupId}`, async () => {
    const svc = await service();
    await svc.setCustomerGroupArchived(user, groupId, archived);
    return `/app/portfolio/groups/${groupId}?${archived ? "archived" : "restored"}=1`;
  });
}

export async function addCustomerToGroupAction(form: FormData) {
  const user = await requireUser();
  const groupId = idSchema.parse(str(form, "groupId"));
  const customerId = idSchema.parse(str(form, "customerId"));
  await run(`/app/portfolio/groups/${groupId}#customers`, async () => {
    const svc = await service();
    await svc.setCustomerGroup(user, customerId, groupId);
    return `/app/portfolio/groups/${groupId}?added=1#customers`;
  });
}

export async function removeCustomerFromGroupAction(form: FormData) {
  const user = await requireUser();
  const groupId = idSchema.parse(str(form, "groupId"));
  const customerId = idSchema.parse(str(form, "customerId"));
  await run(`/app/portfolio/groups/${groupId}#customers`, async () => {
    const svc = await service();
    await svc.setCustomerGroup(user, customerId, null);
    return `/app/portfolio/groups/${groupId}?removed=1#customers`;
  });
}

/** Código do vendedor do Sankhya (CODVEND) no login da equipe: só o administrador. */
export async function saveSellerCodeAction(form: FormData) {
  const user = await requireUser();
  const userId = idSchema.parse(str(form, "userId"));
  await run(`/app/team/${userId}#seller`, async () => {
    const svc = await service();
    await svc.setUserSellerCode(user, userId, str(form, "sellerCode") || null);
    return `/app/team/${userId}?saved=seller_code#seller`;
  });
}
