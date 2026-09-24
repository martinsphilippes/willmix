import "server-only";

import { getStore, type Role, type User } from "@/lib/db";
import { WILLMIX_ROLES } from "@/lib/auth/permissions";

export interface NotifyTarget {
  /** Usuários específicos. */
  userIds?: string[];
  /** Todos os usuários ativos de um papel (opcionalmente restritos a um parceiro). */
  role?: Role | Role[];
  partyId?: string | null;
}

export interface NotifyMessage {
  subject: string;
  body: string;
  link?: string;
}

/**
 * NotificationService. Canais: in-app (sempre), e-mail e WhatsApp.
 * E-mail e WhatsApp estão em modo mock: registram a notificação com status
 * "mock" para inspeção. Quando houver provedor, substituir sendEmail/sendWhatsapp.
 */
export async function notify(target: NotifyTarget, message: NotifyMessage) {
  const store = getStore();
  const users = await resolveUsers(target);
  for (const user of users) {
    await store.create("notifications", {
      userId: user.id,
      partyId: user.partyId,
      role: user.role,
      channel: "inapp",
      subject: message.subject,
      body: message.body,
      link: message.link ?? null,
      status: "sent",
      readAt: null,
    });
    await store.create("notifications", {
      userId: user.id,
      partyId: user.partyId,
      role: user.role,
      channel: "email",
      subject: message.subject,
      body: message.body,
      link: message.link ?? null,
      status: await sendEmail(user, message),
      readAt: null,
    });
    await store.create("notifications", {
      userId: user.id,
      partyId: user.partyId,
      role: user.role,
      channel: "whatsapp",
      subject: message.subject,
      body: message.body,
      link: message.link ?? null,
      status: await sendWhatsapp(user, message),
      readAt: null,
    });
  }
  return users.length;
}

/** Atalho: avisa a equipe Willmix (admin e operadores). */
export const notifyWillmix = (message: NotifyMessage) => notify({ role: WILLMIX_ROLES }, message);

async function resolveUsers(target: NotifyTarget): Promise<User[]> {
  const store = getStore();
  const found = new Map<string, User>();
  if (target.userIds?.length) {
    for (const id of target.userIds) {
      const user = await store.get("users", id);
      if (user?.active) found.set(user.id, user);
    }
  }
  if (target.role) {
    const roles = Array.isArray(target.role) ? target.role : [target.role];
    const filter: Record<string, unknown> = { role: roles, active: true };
    if (target.partyId) filter.partyId = target.partyId;
    const users = await store.list("users", { filter });
    for (const user of users) found.set(user.id, user);
  }
  return [...found.values()];
}

async function sendEmail(user: User, message: NotifyMessage): Promise<"sent" | "mock" | "failed"> {
  // EXTERNAL DEPENDENCY PENDING: provedor de e-mail (ex.: Resend). Sem chave, modo mock.
  if (process.env.NODE_ENV !== "test") {
    console.info(`[email:mock] para ${user.email}: ${message.subject}`);
  }
  return "mock";
}

async function sendWhatsapp(user: User, message: NotifyMessage): Promise<"sent" | "mock" | "failed"> {
  // EXTERNAL DEPENDENCY PENDING: WhatsApp Business API. Modo mock.
  void user;
  void message;
  return "mock";
}
